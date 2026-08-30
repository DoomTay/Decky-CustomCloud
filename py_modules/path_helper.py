import os
import sys
if sys.platform == "win32": import winreg

is_linux = sys.platform == "linux"

class PathHelper:
    @classmethod
    def resolve_path(cls, path):
        def hkcu_lookup(path,query):
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, path)
            result, _ = winreg.QueryValueEx(key, query)
            winreg.CloseKey(key)
    
            return result
        
        steam_dir = os.path.join(os.environ["HOME"],".local","share","Steam") if is_linux else hkcu_lookup("SOFTWARE\\Valve\\Steam","SteamPath")
        proton_prefix = os.path.join(steam_dir,"steamapps","compatdata",str(cls.current_app_id),"pfx","drive_c")
        proton_user_folder = os.path.join(proton_prefix,"users","steamuser")
        steamid3 = cls.steamid64 - 76561197960265728

        path_variable_table = {
            "<home>": os.environ["HOME"] if (cls.app_is_native_linux or not is_linux) else proton_user_folder,
            "C:/Users/<osUserName>": proton_user_folder if is_linux else os.path.join("C:\\","Users",os.environ["USER"]),
            "<winDocuments>": os.path.join(proton_user_folder,"Documents") if is_linux else os.path.expandvars(hkcu_lookup("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders","Personal")),
            "<winAppData>": os.path.join(proton_user_folder,"AppData","Roaming") if is_linux else os.environ["APPDATA"],
            "<winDir>": os.path.join(proton_prefix,"windows") if is_linux else os.environ["WINDIR"],
            "<winLocalAppData>": os.path.join(proton_user_folder,"AppData","Local") if is_linux else os.environ["LOCALAPPDATA"],
            "<winPublic>": os.path.join(proton_prefix,"users","Public") if is_linux else os.environ["PUBLIC"],
            "<winProgramData>": os.path.join(proton_prefix,"ProgramData") if is_linux else os.environ["PROGRAMDATA"],
            "<xdgConfig>": os.path.join(os.environ["HOME"],".config"),
            "<xdgData>": os.path.join(os.environ["HOME"],".local", "share"),
            "<storeUserId>": str(steamid3) if ("<root>" in path or steam_dir in path) and "userdata" in path else str(cls.steamid64),
            "<base>": cls.app_install_path or "UNINSTALLED_GAME_PATH",
            "<root>": steam_dir
        }

        for placeholder in path_variable_table:
            if placeholder in path: path = path.replace(placeholder,path_variable_table[placeholder])

        return os.path.normpath(path)

    @classmethod
    def update_app_info(cls, current_app_id, app_install_path, app_is_native_linux, steamid64):
        cls.current_app_id = current_app_id
        cls.app_install_path = app_install_path
        cls.app_is_native_linux = app_is_native_linux
        cls.steamid64 = steamid64