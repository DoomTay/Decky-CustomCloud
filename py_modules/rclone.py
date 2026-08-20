import decky
import asyncio
import json
import os
import tempfile
from datetime import datetime

runtime_dir = os.environ["DECKY_PLUGIN_RUNTIME_DIR"]
rclone_path = os.path.join(runtime_dir,"rclone")
log_dir = os.environ["DECKY_PLUGIN_LOG_DIR"]

class Rclone:
    active_jobs = 0

    @classmethod
    async def start_rcd(cls,app_id):
        timestamp = datetime.now().strftime('%Y-%m-%d %H.%M.%S')

        await asyncio.create_subprocess_exec(rclone_path, "rcd", "--rc-no-auth", "--config", os.path.join(os.environ["DECKY_PLUGIN_SETTINGS_DIR"],"rclone.conf"), "-vv", f"--log-file={os.path.join(log_dir, f'rclone-{app_id}-{timestamp}.log')}")

        await asyncio.sleep(1)
    
    @classmethod
    async def stop_rcd(cls):
        print("Shutting down rclone RC daemon")
        await cls.rc_command("core/quit")

    @classmethod
    async def rc_get_result(cls,command,args=[]):
        rc_command = await asyncio.create_subprocess_exec(rclone_path, "rc", command, *args, stdout=asyncio.subprocess.PIPE)
        stdout, _ = await rc_command.communicate()

        return json.loads(stdout.decode())

    @classmethod
    async def rc_command(cls,command,args=[]):
        return await asyncio.create_subprocess_exec(rclone_path, "rc", command, *args)

    @classmethod
    async def track_job(cls,job_id):
        job_progress = await cls.rc_get_result("job/status",[f"jobid={job_id}"])

        while job_progress["finished"] == False:
            job_progress = await cls.rc_get_result("job/status",[f"jobid={job_id}"])

            await asyncio.sleep(0.5)

    @classmethod
    def decrease_job_count(cls,task=None):
        Rclone.active_jobs -= 1

    @classmethod
    async def push_paths(cls,paths,game_backup_path,folder_prefix,exclude_paths=[]):
        async def process_single_path(full_target_path,path):
            sync_job_done = False
            marker_created = False

            def check_both_tasks_completed():
                if sync_job_done is True and marker_created is True: cls.decrease_job_count()

            def sync_job_completed(task):
                nonlocal sync_job_done
                sync_job_done = True
                check_both_tasks_completed()

            Rclone.active_jobs += 1
            decky.logger.info(f"Processing {path['path']}")

            if "*" in path["path"]:
                normalized_path = path["path"].replace("\\","/")

                first_asterisk_index = normalized_path.find("*")

                end_of_base_path = normalized_path.rfind("/",0,first_asterisk_index)

                base_path = normalized_path[:end_of_base_path]
                filter = normalized_path[end_of_base_path:]

                if filter.endswith("*"): filter += "*"

                filter_json=json.dumps({
                    "IncludeRule": [f"{filter}"],
                })

                copy_job = await cls.rc_get_result("sync/sync", [f"srcFs={base_path}", f"dstFs=customcloud-remote:{full_target_path}", f"_filter={filter_json}", f"_group=customcloud_upload", "_async=true"])

            else:
                excludes = get_excludes(path["path"])
                excludes.append("/.original-path")

                if os.path.isdir(path['path']):
                    args = [f"srcFs={path['path']}", f"dstFs=customcloud-remote:{full_target_path}"]

                    filter_json=json.dumps({
                        "ExcludeRule": excludes
                    })
                    args.extend([f"_filter={filter_json}"])

                    args.extend([f"_group=customcloud_upload", "_async=true"])

                    copy_job = await cls.rc_get_result("sync/sync", args)
                else:
                    _, filename = os.path.split(path['path'])

                    drive, srcRemote = os.path.splitdrive(path['path'])
                    if ":" in drive: drive = f"//?/{drive}/"
                    srcRemote = srcRemote.lstrip(r'\/').replace('\\', '/')

                    args = [f"srcFs={drive if drive else '/'}", f"srcRemote={srcRemote}", "dstFs=customcloud-remote:",f"dstRemote={full_target_path}/{filename}"]

                    args.extend([f"_group=customcloud_upload", "_async=true"])

                    copy_job = await cls.rc_get_result("operations/copyfile", args)

            copy_job = asyncio.create_task(cls.track_job(copy_job["jobid"]))
            
            copy_job.add_done_callback(sync_job_completed)

            decky.logger.info(f"Creating path marker in {full_target_path}")
            
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False) as marker_file:
                marker_file.write(path["path"])
                marker_file.close()

                drive, srcRemote = os.path.splitdrive(marker_file.name)
                if ":" in drive: drive = f"//?/{drive}/"
                srcRemote = srcRemote.lstrip(r'\/').replace('\\', '/')

                marker_job = await cls.rc_command("operations/copyfile", [f"srcFs={drive if drive else '/'}",  f"srcRemote={srcRemote}", "dstFs=customcloud-remote:", f"dstRemote={full_target_path}/.original-path", f"_group=customcloud_rcat"])

                await marker_job.wait()

                if os.path.exists(marker_file.name):
                    os.remove(marker_file.name)

                marker_created = True
                check_both_tasks_completed()
                
                decky.logger.info(f"Path marker created")

        def get_excludes(original_path):
            relative_exclude_paths = []

            for exclude_path in exclude_paths:
                if original_path not in exclude_path: continue

                relative_exclude_path = os.path.relpath(exclude_path,original_path)

                if os.path.isdir(exclude_path): relative_exclude_path += "/**"

                relative_exclude_paths.append(f"/{relative_exclude_path}".replace("\\","/"))

            return relative_exclude_paths
        
        tasks = [process_single_path(f"{game_backup_path}/{folder_prefix}-{i}", path) for i, path in enumerate(paths)]

        for task in tasks:
            asyncio.create_task(task)

    @classmethod
    async def pull_paths(cls,game_backup_path,folder_prefix,exclude_paths=[]):
        folder_list = (await cls.rc_get_result("operations/list",[f"fs=customcloud-remote:", f"remote={game_backup_path}", f"_group=customcloud_list"]))["list"]

        folders_to_pull = [folder for folder in folder_list if folder["Name"].startswith(f"{folder_prefix}-")]

        async def get_original_path(folder):
            with tempfile.TemporaryDirectory() as marker_dir:
                drive, dstRemote = os.path.splitdrive(marker_dir)
                if ":" in drive: drive = f"//?/{drive}/"
                dstRemote = dstRemote.lstrip(r'\/').replace('\\', '/')

                marker_job = await cls.rc_command("operations/copyfile", ["srcFs=customcloud-remote:",  f"srcRemote={folder['Path']}/.original-path", f"dstFs={drive if drive else '/'}", f"dstRemote={dstRemote}/.original-path", f"_group=customcloud_cat"])

                await marker_job.wait()

                marker_file = os.path.join(marker_dir,".original-path")

                with open (marker_file, "r", encoding="utf-8") as marker_contents:
                    original_path = marker_contents.read()

            return original_path

        async def remote_is_dir(path):
            result = await cls.rc_get_result("operations/list",["fs=customcloud-remote:",f"remote={path}"])

            entries_except_original = [entry for entry in result["list"] if entry['Name'] != '.original-path']

            # If a path points to only a single file, then there would only be one entry after filtering out .original-path
            return (len(entries_except_original) > 1 or (len(entries_except_original) == 1 and entries_except_original[0]["IsDir"] == True))

        async def pull_folder(folder):
            Rclone.active_jobs += 1

            original_path = await get_original_path(folder)

            filter_rules = {
                "ExcludeRule": ["/.original-path"],
            }
            
            if "*" in original_path:
                normalized_path = original_path.replace("\\","/")

                first_asterisk_index = normalized_path.find("*")

                end_of_base_path = normalized_path.rfind("/",0,first_asterisk_index)

                base_path = normalized_path[:end_of_base_path]
                filter = normalized_path[end_of_base_path:]

                if filter.endswith("*"): filter += "*"

                filter_rules["IncludeRule"] = [f"{filter}"]

                filter_json=json.dumps(filter_rules)

                sync_job = await cls.rc_get_result("sync/sync", [f"srcFs=customcloud-remote:{folder['Path']}", f"dstFs={base_path}", f"_filter={filter_json}", f"_group=customcloud_download", "_async=true"])
            else:
                if (await remote_is_dir(folder['Path'])):
                    args = [f"srcFs=customcloud-remote:{folder['Path']}", f"dstFs={original_path}"]

                    for exclude_path in exclude_paths:
                        if original_path not in exclude_path: continue

                        relative_exclude_path = os.path.relpath(exclude_path,original_path)

                        path_split = relative_exclude_path.split(os.path.sep)
                        path_depths = ["/".join(path_split[:i + 1]) for i,_ in enumerate(path_split)]

                        batch_jobs = []

                        for depth in path_depths:
                            params = {
                                "_path": "operations/list",
                                "fs": "customcloud-remote:",
                                "remote": f"{folder['Path']}/{depth}",
                                "opt": {"noModTime": True},
                            }

                            batch_jobs.append(params)

                        batch_json = json.dumps({"inputs": batch_jobs, "_group": f"customcloud_depth_check"})

                        depth_check_result = (await cls.rc_get_result("job/batch", ["--json", batch_json]))["results"]

                        cutoff_index, _ = next((i,depth) for i,depth in enumerate(depth_check_result) if depth.get("status") == 404 or len(depth.get("list",[])) == 0)
                        cutoff_point = path_depths[cutoff_index]

                        if os.path.isdir((os.path.join(original_path,cutoff_point))): cutoff_point += "/**"

                        filter_rules["ExcludeRule"].append(f"/{cutoff_point}")

                    filter_json=json.dumps(filter_rules)

                    args.extend([f"_filter={filter_json}", f"_group=customcloud_download", "_async=true"])

                    sync_job = await cls.rc_get_result("sync/sync", args)
                else:
                    _, filename = os.path.split(original_path)

                    drive, dstRemote = os.path.splitdrive(original_path)
                    if ":" in drive: drive = f"//?/{drive}/"

                    args = ["srcFs=customcloud-remote:",f"srcRemote={folder['Path']}/{filename}", f"dstFs={drive if drive else '/'}", f"dstRemote={dstRemote}"]

                    filter_json=json.dumps(filter_rules)

                    args.extend([f"_filter={filter_json}", f"_group=customcloud_download", "_async=true"])

                    sync_job = await cls.rc_get_result("operations/copyfile", args)

            sync_task = asyncio.create_task(cls.track_job(sync_job["jobid"]))

            sync_task.add_done_callback(cls.decrease_job_count)
        tasks = [pull_folder(folder) for folder in folders_to_pull]

        for task in tasks:
            asyncio.create_task(task)

    @classmethod
    async def push_data(cls,type: str, app_paths: list,base_backup_path: str,game_folder: str,push_configsaves: bool):
        game_backup_path = f"{base_backup_path}/{game_folder}"
        exclude_type = "save" if "config" else "config"

        paths = [path for path in app_paths if path["type"] == type]

        exclude_paths = [path["path"] for path in app_paths if path["type"] == exclude_type]

        decky.logger.info(f"Preparing to upload {type} data to {game_backup_path}")

        await cls.push_paths(paths,game_backup_path,type,exclude_paths)

        if push_configsaves:
            configsave_paths = [path for path in app_paths if path["type"] == "configsave"]

            if len(configsave_paths) > 0: 
                decky.logger.info(f"Preparing to upload config+save data to {game_backup_path}")

                await cls.push_paths(configsave_paths,game_backup_path,"configsave")