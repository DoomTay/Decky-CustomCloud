import os

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky
import asyncio
import random
import requests
import re
import zipfile
import tempfile
import yaml
from settings import SettingsManager

runtime_dir = os.environ["DECKY_PLUGIN_RUNTIME_DIR"]
settings_dir = os.environ["DECKY_PLUGIN_SETTINGS_DIR"]
steam_dir = os.path.join(os.environ["HOME"],".local","share","Steam")
rclone_path = os.path.join(runtime_dir,"rclone")
rclone_config_path = os.path.join(settings_dir,"rclone.conf")

class Plugin:
    async def update_rclone(self):
        decky.logger.info("Downloading Rclone")

        try:
            download = requests.get("https://downloads.rclone.org/rclone-current-linux-amd64.zip")

            if download.status_code == 200:
                with tempfile.NamedTemporaryFile() as zip_download:
                    zip_download.write(download.content)

                    with zipfile.ZipFile(zip_download.name, 'r') as zip_file:
                        info = zip_file.infolist()
                        
                        rclone_binary_pointer = next((file for file in info if file.filename.endswith("rclone")), None)

                        with zip_file.open(rclone_binary_pointer.filename) as rclone_binary:
                            with open(rclone_path,"wb") as file:
                                file.write(rclone_binary.read())
                
                decky.logger.info("Rclone downloaded")
            return {
                "success": True,
                "status_code": download.status_code,
                "status_text": download.reason
            }
        except Exception as e:
            decky.logger.error(e)

            return {
                "success": False,
                "error": type(e).__name__
            }
    
    async def download_ludusavi_manifest(self):
        current_record = await self.get_ludusavi_download_record()

        decky.logger.info("Downloading Ludusavi manifest")
        try:
            download = requests.get("https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/master/data/manifest.yaml",headers = {"If-None-Match": current_record["etag"]})

            if download.status_code == 200:
                with open(os.path.join(runtime_dir,"ludusavi_manifest.yaml"),"wb") as file:
                    file.write(download.content)

                decky.logger.info("Manifest downloaded")
                download_record = SettingsManager(name="ludusavi_download", settings_directory=runtime_dir)

                download_record.setSetting("etag", download.headers["etag"])
                download_record.commit()
            elif download.status_code == 304:
                decky.logger.info("Manifest already up to date")

            return {
                "success": True,
                "status_code": download.status_code,
                "status_text": download.reason
            }
        except Exception as e:
            decky.logger.error(e)

            return {
                "success": False,
                "error": type(e).__name__
            }
        
    async def get_ludusavi_download_record(self):
        download_record = SettingsManager(name="ludusavi_download", settings_directory=runtime_dir)

        if not download_record.settings:
            download_record.setSetting("etag", "")
            download_record.commit()

        return download_record.settings

    async def get_status(self):
        return self.status
    
    def resolve_path(self, path):
        proton_prefix = self.get_prefix_path()

        path_variable_table = {
            "<home>": os.path.join(proton_prefix),
            "C:/Users/<osUserName>": os.path.join(proton_prefix),
            "<winDocuments>": os.path.join(proton_prefix,"Documents"),
            "<winAppData>": os.path.join(proton_prefix,"AppData","Roaming"),
            "<winLocalAppData>": os.path.join(proton_prefix,"AppData","Local"),
            "<xdgConfig>": os.path.join(os.environ["HOME"],".config"),
            "<xdgData>": os.path.join(os.environ["HOME"],".local", "share"),
            "<storeUserId>": str(self.steamid3),
            "<base>": self.app_install_path or "UNINSTALLED_GAME_PATH",
            "<root>": steam_dir
        }

        for placeholder in path_variable_table:
            if placeholder in path:
                path = path.replace(placeholder,path_variable_table[placeholder])

        return os.path.normpath(path)

    def get_prefix_path(self):
        return os.path.join(steam_dir,"steamapps","compatdata",str(self.current_app_id),"pfx","drive_c","users","steamuser")

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        decky.logger.info("Hello World!")

        self.global_settings = SettingsManager(name="settings", settings_directory=settings_dir)

        if not self.global_settings.settings:
            self.global_settings.setSetting("cloud_directory", "CustomCloud-Backup")
            self.global_settings.commit()

        self.app_settings = None
        self.sync_progress = 0
        self.status = "idle"

    async def set_default_paths(self):
        default_paths = []

        manifest_path = os.path.join(runtime_dir,"ludusavi_manifest.yaml")

        if not os.path.exists(manifest_path):
            await self.download_ludusavi_manifest()

        with open (manifest_path, "r", encoding="utf-8") as file:
            decky.logger.info("Loading manifest")
            
            file_contents = file.read()
	
            decky.logger.info("Parsing manifest")
            
            pattern = r"^(\S.+:\n(?:^\s{1,10}.+\n?)*)"
            matches = re.findall(pattern, file_contents, flags=re.MULTILINE)
            
            decky.logger.info(f"Manifest parsed. Finding info for app ID {self.current_app_id}")

            possible_entry = next((game for game in matches if bool(re.search(rf"steam:\n\s+id:\s?{self.current_app_id}$", game))), None)
                
            found_entry = next(iter(yaml.safe_load(possible_entry).values()))
            
        paths = found_entry["files"]
        
        decky.logger.info(f"App found. Collating paths.")
        for possible_path,path_data in paths.items():
            resolved_path = self.resolve_path(possible_path)

            if not self.app_is_installed and "UNINSTALLED_GAME_PATH" in resolved_path:
                continue

            if any((when.get("os") == "linux" or when.get("os") == "windows" or when.get("store") == "steam") for when in path_data["when"]):
                stores = [when.get("store") for when in path_data["when"] if "store" in when]
                
                if stores and "steam" not in stores:
                    continue

                path_type = "configsave"

                if path_data.get("tags"):
                    if "config" in path_data["tags"] and "save" not in path_data["tags"]: path_type = "config"
                    elif "save" in path_data["tags"] and "config" not in path_data["tags"]: path_type = "save"

                default_paths.append({"path": resolved_path, "type": path_type})

        decky.logger.info(f"Paths found. Added to defaults.")

        self.app_settings.setSetting("paths", default_paths)
        self.app_settings.commit()

        return self.app_settings.getSetting("paths")

    async def get_app_settings(self,appInfo):
        self.app_settings = SettingsManager(name=f"settings_{appInfo['unAppID']}", settings_directory=settings_dir)
        self.current_app_id = appInfo['unAppID']
        self.app_is_installed = appInfo['iInstallFolder'] != -1
        self.app_install_path = appInfo['strInstallFolder']
        self.steamid64 = int(appInfo['strOwnerSteamID'])
        self.steamid3 = self.steamid64 - 76561197960265728

        cloud_enabled_for_game = appInfo['bCloudEnabledForApp']

        if not self.app_settings.settings:
            self.app_settings.setSetting("sync_config_after_game", True)
            self.app_settings.setSetting("sync_config_before_game", not cloud_enabled_for_game)
            self.app_settings.setSetting("sync_save_after_game", True)
            self.app_settings.setSetting("sync_save_before_game", not cloud_enabled_for_game)
            self.app_settings.commit()

            await self.set_default_paths()
            
        return self.app_settings.settings
    
    async def set_app_setting(self, key, value):
        if not self.app_settings: return

        self.app_settings.setSetting(key, value)
        self.app_settings.commit()
    
    async def get_current_app_id(self):
        return self.current_app_id
    
    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        decky.logger.info("Goodnight World!")
        pass

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        decky.logger.info("Goodbye World!")
        pass

    async def start_timer(self):
        self.loop.create_task(self.long_running())

    async def rclone_push_config(self,push_configsaves):
        self.sync_progress = 0
        self.status = "uploading_config"

        base_backup_path = self.global_settings.getSetting("cloud_directory", "CustomCloud-Backup")
        game_backup_path = os.path.join(base_backup_path,str(self.current_app_id))

        app_paths = self.app_settings.getSetting("paths","[]")

        config_paths = [path for path in app_paths if path["type"] == "config"]

        def get_save_excludes(original_path):
            save_paths = [path["path"] for path in app_paths if path["type"] == "save"]
            relative_save_paths = []

            for save_path in save_paths:
                if original_path not in save_path: continue

                relative_save_path = os.path.relpath(save_path,original_path)

                if os.path.isdir(save_path): relative_save_path += "/**"
                # if relative_save_path == "../**": continue

                relative_save_paths.append(relative_save_path.replace("\\","/"))

            return relative_save_paths

        decky.logger.info(f"Preparing to upload config data to {game_backup_path}")

        for i, config_path in enumerate(config_paths):
            full_target_path = os.path.join(game_backup_path,f"config-{i}")

            await asyncio.create_subprocess_exec(rclone_path, "mkdir", f"customcloud-remote:{full_target_path}", "--dry-run", "--config", rclone_config_path)

            if "*" in config_path["path"]:
                path_and_filter = config_path["path"].split('*', 1)

                await asyncio.create_subprocess_exec(rclone_path, "sync", path_and_filter[0], f"customcloud-remote:{full_target_path}", "--include", f"*{path_and_filter[1]}", "--dry-run", "--config", rclone_config_path)
            else:
                excludes = get_save_excludes(config_path["path"])

                args = [rclone_path, "copy", config_path["path"], f"customcloud-remote:{full_target_path}"]

                for exclude in excludes:
                    args.extend(["--exclude", exclude])

                args.extend(["--dry-run", "--config", rclone_config_path])

                await asyncio.create_subprocess_exec(*args)
                
        self.loop.create_task(self.update_progress())

    async def rclone_push_save(self):
        self.sync_progress = 0
        self.status = "uploading_save"

        self.loop.create_task(self.update_progress())
    
    async def rclone_pull_config(self):
        self.sync_progress = 0
        self.status = "downloading_config"

        self.loop.create_task(self.update_progress())

    async def rclone_pull_save(self):
        self.sync_progress = 0
        self.status = "downloading_save"

        self.loop.create_task(self.update_progress())

    async def update_progress(self):
        while self.sync_progress < 100:
            self.sync_progress += random.randint(2,25)

            self.sync_progress = min(self.sync_progress,100)

            if self.sync_progress < 100: await decky.emit("progress_event", self.sync_progress, "Task still in progress", False)
            await asyncio.sleep(1)
        
        await decky.emit("progress_event", 100, "Task complete")

        decky.logger.info("Cloud sync complete")
        self.status = "idle"

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        decky.logger.info("Migrating")
        # Here's a migration example for logs:
        # - `~/.config/decky-template/template.log` will be migrated to `decky.decky_LOG_DIR/template.log`
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME,
                                               ".config", "decky-template", "template.log"))
        # Here's a migration example for settings:
        # - `~/homebrew/settings/template.json` is migrated to `decky.decky_SETTINGS_DIR/template.json`
        # - `~/.config/decky-template/` all files and directories under this root are migrated to `decky.decky_SETTINGS_DIR/`
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template"))
        # Here's a migration example for runtime data:
        # - `~/homebrew/template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        # - `~/.local/share/decky-template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-template"))
