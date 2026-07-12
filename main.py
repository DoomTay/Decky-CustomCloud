import os

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky
import asyncio
import random
from settings import SettingsManager

settings_dir = os.environ["DECKY_PLUGIN_SETTINGS_DIR"]
steam_dir = os.path.join(os.environ["HOME"],".local","share","Steam")

class Plugin:
    # A normal method. It can be called from the TypeScript side using @decky/api.
    async def add(self, left: int, right: int) -> int:
        return left + right

    async def long_running(self):
        await asyncio.sleep(15)
        # Passing through a bunch of random data, just as an example
        await decky.emit("timer_event", "Hello from the backend!", True, 2)

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
            "<base>": self.app_install_path or "UNINSTALLED_GAME_PATH"
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

        self.app_settings = None
        self.sync_progress = 0
        self.status = "idle"

    async def set_default_paths(self):
        default_paths = [
           {"path": self.get_prefix_path(), "type": "configsave"},
           {"path": self.resolve_path("<winDocuments>/My Games/Game_" + str(self.current_app_id)), "type": "save"},
           {"path": self.resolve_path(os.path.join("<winAppData>","My Games","Game_" + str(self.current_app_id),"*.ini")), "type": "config"},
           {"path": self.resolve_path("<base>/saves/savedata.dat"), "type": "save"}
        ]

        if not self.app_is_installed:
            default_paths = [path for path in default_paths if "UNINSTALLED_GAME_PATH" not in path["path"]]

        self.app_settings.setSetting("paths", default_paths)
        self.app_settings.commit()

        return self.app_settings.getSetting("paths")

    async def get_app_settings(self,appInfo):
        self.app_settings = SettingsManager(name=f"settings_{appInfo['unAppID']}", settings_directory=settings_dir)
        self.current_app_id = appInfo['unAppID']
        self.app_is_installed = appInfo['iInstallFolder'] != -1
        self.app_install_path = appInfo['strInstallFolder']

        cloud_enabled_for_game = appInfo['bCloudEnabledForApp']

        if not self.app_settings.settings:
            self.app_settings.setSetting("sync_config_after_game", True)
            self.app_settings.setSetting("sync_config_before_game", not cloud_enabled_for_game)
            self.app_settings.setSetting("sync_save_after_game", True)
            self.app_settings.setSetting("sync_save_before_game", not cloud_enabled_for_game)
            self.app_settings.commit()

            await self.set_default_paths()
            
        self.app_settings.commit()

        return self.app_settings.settings
    
    async def set_app_setting(self, key, value):
        if not self.app_settings: return

        self.app_settings.setSetting(key, value)
        self.app_settings.commit()
        
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

    async def rclone_push_config(self):
        self.sync_progress = 0
        self.status = "uploading_config"

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
