import { call, callable } from "@decky/api";
import { AppDetails } from "@decky/ui/dist/globals/steam-client/App";
import { createContext, useContext, useEffect, useState } from "react";

export interface InitialSettings {
    "sync_config_after_game": boolean,
    "sync_config_before_game": boolean,
    "sync_save_after_game": boolean,
    "sync_save_before_game": boolean,
    "paths": GamePathSetting[],
    "game_folder": string,
    "shortcut_directory": string
}

export interface GamePathSetting {
    path: string,
    type: string
}

export const getSetting = callable<[appId: number, setting: string, default_value: any], any>("get_app_setting");

interface SettingsContextType {
    initialSettings: InitialSettings;
    setSetting: (key: keyof InitialSettings, value: any) => void;
    gameDetails: AppDetails | null;
    loadingPaths: boolean;
    setLoadingPaths: React.Dispatch<React.SetStateAction<boolean>>;
    updateGameInfo: (appId: number) => Promise<void>;
    appIsShortcut: boolean;
    appIsInstalled: boolean;
    appId: number | null;
    setAppId: React.Dispatch<React.SetStateAction<number | null>>;
}

const SettingsContext = createContext<SettingsContextType|null>(null);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [loadingPaths, setLoadingPaths] = useState<boolean>(false);
    const [gameDetails, setGameDetails] = useState<AppDetails|null>(null);
    const appIsShortcut = gameDetails?.strShortcutStartDir != undefined;
    const [appId, setAppId] = useState<number|null>(null);
    const appIsInstalled = (!appIsShortcut && gameDetails?.iInstallFolder != -1) || appIsShortcut;
    const [initialSettings, setInitialSettings] = useState<InitialSettings>({
        "sync_config_after_game": true,
        "sync_config_before_game": true,
        "sync_save_after_game": true,
        "sync_save_before_game": true,
        "paths": [],
        "game_folder": "",
        "shortcut_directory": ""
    })

    function setSetting(key: string, value: any)
    {
        setInitialSettings({...initialSettings, [key]: value});
        call<[key: string, value: any], any>("set_app_setting", key, value);
    }

    const updateGameInfo = async(appId: number) =>
    {
        const { unregister } = SteamClient.Apps.RegisterForAppDetails(appId, async (details) => {
            unregister();

            setLoadingPaths(true);

            let newSettings = await call<[appInfo: AppDetails], any>("get_app_settings",details);
            setInitialSettings(newSettings);

            setGameDetails(details);

            setLoadingPaths(false);
        })
    }

    useEffect(() =>
    {
        if(appId == null) return;

        updateGameInfo(appId);
    }, [appId])

    useEffect(() =>
    {
        async function updateAppId()
        {
            setAppId(await call<[], any>("get_current_app_id"));
        }

        updateAppId()
    }, [])

    return (
        <SettingsContext.Provider value={{ initialSettings, setSetting, gameDetails, loadingPaths, setLoadingPaths, updateGameInfo, appIsShortcut, appIsInstalled, appId, setAppId }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useAppSettings = () => {
    const settingsState = useContext(SettingsContext);

    if (settingsState === null) throw new Error("useAppSettings needs a parent SettingsContext");

    return settingsState;
}