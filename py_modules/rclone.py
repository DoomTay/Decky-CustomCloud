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
    @classmethod
    async def start_rcd(cls,app_id):
        timestamp = datetime.now().strftime('%Y-%m-%d %H.%M.%S')

        await asyncio.create_subprocess_exec(rclone_path, "rcd", "--rc-no-auth", "--config", os.path.join(os.environ["DECKY_PLUGIN_SETTINGS_DIR"],"rclone.conf"), "-vv", f"--log-file={os.path.join(log_dir, f'rclone-{app_id}-{timestamp}.log')}")

        await asyncio.sleep(1)
    
    @classmethod
    async def stop_rcd(cls):
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
    async def push_paths(cls,paths,game_backup_path,folder_prefix,get_excludes_function=None):
        async def process_single_path(i,path):
            full_target_path = f"{game_backup_path}/{folder_prefix}-{i}"

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

                copy_job = await cls.rc_command("sync/sync", [f"srcFs={base_path}", f"dstFs=customcloud-remote:{full_target_path}", f"_filter={filter_json}", f"_group=customcloud_upload"])

            else:
                excludes = get_excludes_function(path["path"]) if get_excludes_function else []

                if os.path.isdir(path['path']):
                    args = [f"srcFs={path['path']}", f"dstFs=customcloud-remote:{full_target_path}"]

                    if len(excludes) > 0:
                        filter_json=json.dumps({
                            "ExcludeRule": excludes
                        })
                        args.extend([f"_filter={filter_json}"])

                    args.extend([f"_group=customcloud_upload"])

                    copy_job = await cls.rc_command("sync/sync", args)
                else:
                    _, filename = os.path.split(path['path'])

                    drive, srcRemote = os.path.splitdrive(path['path'])
                    if ":" in drive: drive = f"//?/{drive}/"
                    srcRemote = srcRemote.lstrip(r'\/').replace('\\', '/')

                    args = [f"srcFs={drive if drive else '/'}", f"srcRemote={srcRemote}", "dstFs=customcloud-remote:",f"dstRemote={full_target_path}/{filename}"]

                    args.extend([f"_group=customcloud_upload"])

                    copy_job = await cls.rc_command("operations/copyfile", args)

            await copy_job.wait()

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
                
                decky.logger.info(f"Path marker created")

                    
        
        tasks = [process_single_path(i, path) for i, path in enumerate(paths)]

        await asyncio.gather(*tasks)

    @classmethod
    async def pull_paths(cls,game_backup_path,folder_prefix,exclude_prefix=None):
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

        async def pull_folder(folder):
            original_path = await get_original_path(folder)

            filter_rules = {
                "ExcludeRule": ["/.original-path"],
            }

            config_json = json.dumps({
                "DryRun": True
            })

            if "*" in original_path:
                normalized_path = original_path.replace("\\","/")

                first_asterisk_index = normalized_path.find("*")

                end_of_base_path = normalized_path.rfind("/",0,first_asterisk_index)

                base_path = normalized_path[:end_of_base_path]
                filter = normalized_path[end_of_base_path:]

                if filter.endswith("*"): filter += "*"

                filter_rules["IncludeRule"] = [f"{filter}"]

                filter_json=json.dumps(filter_rules)

                await cls.rc_command("sync/sync", [f"srcFs=customcloud-remote:{folder['Path']}", f"dstFs={base_path}", f"_filter={filter_json}", f"_config={config_json}", f"_group=customcloud_download"])
            else:
                if os.path.isdir(original_path):
                    args = [f"srcFs=customcloud-remote:{folder['Path']}", f"dstFs={original_path}"]

                    if exclude_prefix:
                        exclude_path_tasks = [get_original_path(folder) for folder in folder_list if folder["Name"].startswith(f"{exclude_prefix}-")]

                        exclude_paths = await asyncio.gather(*exclude_path_tasks)

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

                    args.extend([f"_filter={filter_json}", f"_config={config_json}", f"_group=customcloud_download"])

                    await cls.rc_command("sync/sync", args)
                else:
                    _, filename = os.path.split(original_path)

                    drive, dstRemote = os.path.splitdrive(original_path)
                    if ":" in drive: drive = f"//?/{drive}/"

                    args = ["srcFs=customcloud-remote:",f"srcRemote={folder['Path']}/{filename}", f"dstFs={drive if drive else '/'}", f"dstRemote={dstRemote}"]

                    filter_json=json.dumps(filter_rules)

                    args.extend([f"_filter={filter_json}", f"_config={config_json}", f"_group=customcloud_download"])

                    await cls.rc_command("operations/copyfile", args)
        tasks = [pull_folder(folder) for folder in folders_to_pull]

        await asyncio.gather(*tasks)

    @classmethod
    async def push_config(cls,app_paths: list,base_backup_path: str,game_folder: str,push_configsaves: bool):
        game_backup_path = f"{base_backup_path}/{game_folder}"

        config_paths = [path for path in app_paths if path["type"] == "config"]

        def get_save_excludes(original_path):
            save_paths = [path["path"] for path in app_paths if path["type"] == "save"]
            relative_save_paths = []

            for save_path in save_paths:
                if original_path not in save_path: continue

                relative_save_path = os.path.relpath(save_path,original_path)

                if os.path.isdir(save_path): relative_save_path += "/**"

                relative_save_paths.append(relative_save_path.replace("\\","/"))

            return relative_save_paths

        decky.logger.info(f"Preparing to upload config data to {game_backup_path}")

        await cls.push_paths(config_paths,game_backup_path,"config",get_save_excludes)

        if push_configsaves:
            configsave_paths = [path for path in app_paths if path["type"] == "configsave"]

            if len(configsave_paths) > 0: 
                decky.logger.info(f"Preparing to upload config+save data to {game_backup_path}")

                await cls.push_paths(configsave_paths,game_backup_path,"configsave")

    @classmethod
    async def push_save(cls,app_paths: list,base_backup_path: str,game_folder: str,push_configsaves: bool):
        game_backup_path = f"{base_backup_path}/{game_folder}"

        save_paths = [path for path in app_paths if path["type"] == "save"]

        def get_config_excludes(original_path):
            config_paths = [path["path"] for path in app_paths if path["type"] == "config"]
            relative_config_paths = []

            for config_path in config_paths:
                if original_path not in config_path: continue

                relative_config_path = os.path.relpath(config_path,original_path)

                if os.path.isdir(config_path): relative_config_path += "/**"

                relative_config_paths.append(relative_config_path.replace("\\","/"))

            return relative_config_paths

        decky.logger.info(f"Preparing to upload save data to {game_backup_path}")

        await cls.push_paths(save_paths,game_backup_path,"save",get_config_excludes)

        if push_configsaves:
            configsave_paths = [path for path in app_paths if path["type"] == "configsave"]

            if len(configsave_paths) > 0: 
                decky.logger.info(f"Preparing to upload config+save data to {game_backup_path}")

                await cls.push_paths(configsave_paths,game_backup_path,"configsave")