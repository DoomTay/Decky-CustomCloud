import decky
import asyncio
import json
import os
import glob
import tempfile
from path_helper import PathHelper
from datetime import datetime

runtime_dir = os.environ["DECKY_PLUGIN_RUNTIME_DIR"]
rclone_path = os.path.join(runtime_dir,"rclone")
log_dir = os.environ["DECKY_PLUGIN_LOG_DIR"]

class Rclone:
    active_jobs = set()

    @classmethod
    async def start_rcd(cls,app_id):
        decky.logger.info("Starting rclone RC daemon")
        timestamp = datetime.now().strftime('%Y-%m-%d %H.%M.%S')

        await asyncio.create_subprocess_exec(rclone_path, "rcd", "--rc-no-auth", "--config", os.path.join(os.environ["DECKY_PLUGIN_SETTINGS_DIR"],"rclone.conf"), "-vv", f"--log-file={os.path.join(log_dir, f'rclone-{app_id}-{timestamp}.log')}")

        await asyncio.sleep(1)
    
    @classmethod
    async def stop_rcd(cls):
        decky.logger.info("Shutting down rclone RC daemon")
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
    async def kill_all_jobs(cls):
        decky.logger.info("Killing all running rclone jobs")

        for task in Rclone.active_jobs:
            task.cancel()

        await asyncio.gather(*Rclone.active_jobs, return_exceptions=True)

        Rclone.active_jobs.clear()
        
        active_rclone_jobs = (await cls.rc_get_result("job/list")).get("runningIds",[])

        batch_jobs = []
        
        for job in active_rclone_jobs:
            params = {
                "_path": "job/stop",
                "jobid": job
            }

            batch_jobs.append(params)

        batch_json = json.dumps({"inputs": batch_jobs})

        await cls.rc_get_result("job/batch", ["--json", batch_json])

        await asyncio.sleep(0.5)

    @staticmethod
    def split_filter(path):
        normalized_path = path.replace("\\","/")

        first_asterisk_index = normalized_path.find("*")

        end_of_base_path = normalized_path.rfind("/",0,first_asterisk_index)

        base_path = normalized_path[:end_of_base_path]
        filter = normalized_path[end_of_base_path:]
        if filter.endswith("*"): filter += "*"

        return base_path,filter
    
    @classmethod
    async def push_paths(cls,paths,game_backup_path,folder_prefix,exclude_paths=[]):
        async def process_single_path(full_target_path,path):
            decky.logger.info(f"Processing {path['path']}")

            resolved_path = PathHelper.resolve_path(path['path'])

            if "*" in path["path"]:
                base_path, filter = cls.split_filter(resolved_path)

                filter_json=json.dumps({
                    "IncludeRule": [f"{filter}"],
                })

                copy_job = await cls.rc_command("sync/sync", [f"srcFs={base_path}", f"dstFs=customcloud-remote:{full_target_path}", f"_filter={filter_json}", f"_group=customcloud_upload"])

            else:
                excludes = get_excludes(resolved_path)
                excludes.append("/.original-path")

                if os.path.isdir(resolved_path):
                    args = [f"srcFs={resolved_path}", f"dstFs=customcloud-remote:{full_target_path}"]

                    filter_json=json.dumps({
                        "ExcludeRule": excludes
                    })
                    args.extend([f"_filter={filter_json}", f"_group=customcloud_upload"])

                    copy_job = await cls.rc_command("sync/sync", args)
                else:
                    _, filename = os.path.split(resolved_path)

                    drive, srcRemote = os.path.splitdrive(resolved_path)
                    if ":" in drive: drive = f"//?/{drive}/"
                    srcRemote = srcRemote.lstrip(r'\/').replace('\\', '/')

                    args = [f"srcFs={drive if drive else '/'}", f"srcRemote={srcRemote}", "dstFs=customcloud-remote:",f"dstRemote={full_target_path}/{filename}"]

                    args.extend([f"_group=customcloud_upload"])

                    copy_job = await cls.rc_command("operations/copyfile", args)

            await copy_job.wait()

            if glob.glob(resolved_path):
                decky.logger.info(f"Creating path marker in {full_target_path}")
                
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False) as marker_file:
                    marker_file.write(path["path"])
                    marker_file.close()

                    drive, srcRemote = os.path.splitdrive(marker_file.name)
                    if ":" in drive: drive = f"//?/{drive}/"
                    srcRemote = srcRemote.lstrip(r'\/').replace('\\', '/')

                    config_json = json.dumps({
                        "CheckSum": True
                    })

                    marker_job = await cls.rc_command("operations/copyfile", [f"srcFs={drive if drive else '/'}", f"srcRemote={srcRemote}", "dstFs=customcloud-remote:", f"dstRemote={full_target_path}/.original-path", f"_config={config_json}", f"_group=customcloud_rcat"])

                    await marker_job.wait()

                    if os.path.exists(marker_file.name):
                        os.remove(marker_file.name)
                    
                    decky.logger.info(f"Path marker created")
            else: decky.logger.warning(f"{resolved_path} does not exist on local disk")

        def get_excludes(original_path):
            relative_exclude_paths = []

            for exclude_path in exclude_paths:
                resolved_exclude_path = PathHelper.resolve_path(exclude_path)
                if original_path not in resolved_exclude_path: continue

                relative_exclude_path = os.path.relpath(resolved_exclude_path,original_path)

                if os.path.isdir(resolved_exclude_path): relative_exclude_path += "/**"

                relative_exclude_paths.append(f"/{relative_exclude_path}".replace("\\","/"))

            return relative_exclude_paths
        
        tasks = [process_single_path(f"{game_backup_path}/{folder_prefix}-{i}", path) for i, path in enumerate(paths)]

        for task in tasks:
            new_task = asyncio.create_task(task)
            new_task.add_done_callback(Rclone.active_jobs.discard)
            Rclone.active_jobs.add(new_task)

    @classmethod
    async def pull_paths(cls,folders_to_pull,exclude_paths=[]):
        async def get_original_path(folder):
            with tempfile.TemporaryDirectory() as marker_dir:
                drive, dstRemote = os.path.splitdrive(marker_dir)
                if ":" in drive: drive = f"//?/{drive}/"
                dstRemote = dstRemote.lstrip(r'\/').replace('\\', '/')

                marker_config_json = json.dumps({
                    "NoUpdateModtime": True,
                    "IgnoreTimes": True,
                    "NoCheckDest": True
                })

                marker_job = await cls.rc_command("operations/copyfile", ["srcFs=customcloud-remote:",  f"srcRemote={folder['Path']}/.original-path", f"dstFs={drive if drive else '/'}", f"dstRemote={dstRemote}/.original-path", f"_config={marker_config_json}", f"_group=customcloud_cat"])

                await marker_job.wait()

                marker_file = os.path.join(marker_dir,".original-path")

                if not os.path.exists(marker_file): return ""

                with open (marker_file, "r", encoding="utf-8") as marker_contents:
                    original_path = marker_contents.read()

            return original_path

        async def remote_is_dir(path):
            result = await cls.rc_get_result("operations/list",["fs=customcloud-remote:",f"remote={path}"])

            entries_except_original = [entry for entry in result["list"] if entry['Name'] != ".original-path"]

            # If a path points to only a single file, then there would only be one entry after filtering out .original-path
            return (len(entries_except_original) > 1 or (len(entries_except_original) == 1 and entries_except_original[0]["IsDir"] == True))

        async def pull_folder(folder):
            decky.logger.info(f"Processing {folder['Path']}")

            original_path = await get_original_path(folder)
            if original_path == "": return
            decky.logger.info(f"Got original path for {folder['Path']}. Beginning download")

            resolved_path = PathHelper.resolve_path(original_path)

            config_json = json.dumps({
                "NoUpdateDirModtime": True,
            })
            
            filter_rules = {
                "ExcludeRule": ["/.original-path"],
            }
            
            if "*" in resolved_path:
                base_path, filter = cls.split_filter(resolved_path)

                filter_rules["IncludeRule"] = [f"{filter}"]

                filter_json=json.dumps(filter_rules)

                sync_job = await cls.rc_command("sync/sync", [f"srcFs=customcloud-remote:{folder['Path']}", f"dstFs={base_path}", f"_filter={filter_json}", f"_group=customcloud_download"])
            else:
                if (await remote_is_dir(folder['Path'])):
                    args = [f"srcFs=customcloud-remote:{folder['Path']}", f"dstFs={resolved_path}"]

                    for exclude_path in exclude_paths:
                        resolved_exclude_path = PathHelper.resolve_path(exclude_path)
                        if resolved_path not in resolved_exclude_path: continue

                        relative_exclude_path = os.path.relpath(resolved_exclude_path,resolved_path)

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

                        if os.path.isdir((os.path.join(resolved_path,cutoff_point))): cutoff_point += "/**"

                        filter_rules["ExcludeRule"].append(f"/{cutoff_point}")

                    filter_json=json.dumps(filter_rules)

                    args.extend([f"_filter={filter_json}", f"_group=customcloud_download"])

                    sync_job = await cls.rc_command("sync/sync", args)
                else:
                    _, filename = os.path.split(resolved_path)

                    drive, dstRemote = os.path.splitdrive(resolved_path)
                    if ":" in drive: drive = f"//?/{drive}/"

                    dstRemote = dstRemote.replace("\\","/")

                    args = ["srcFs=customcloud-remote:",f"srcRemote={folder['Path']}/{filename}", f"dstFs={drive if drive else '/'}", f"dstRemote={dstRemote}"]

                    filter_json=json.dumps(filter_rules)

                    args.extend([f"_filter={filter_json}", f"_group=customcloud_download"])

                    sync_job = await cls.rc_command("operations/copyfile", args)

            await sync_job.wait()

            decky.logger.info(f"{folder['Path']} downloaded")
        tasks = [pull_folder(folder) for folder in folders_to_pull]

        for task in tasks:
            new_task = asyncio.create_task(task)
            new_task.add_done_callback(Rclone.active_jobs.discard)
            Rclone.active_jobs.add(new_task)

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