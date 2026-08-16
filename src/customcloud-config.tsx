import { call, addEventListener, removeEventListener, toaster } from "@decky/api";
import {
  PanelSectionRow,
  Dropdown,
  SingleDropdownOption,
  ToggleField,
  ButtonItem,
  SidebarNavigation,
  DialogBody,
  DialogControlsSectionHeader,
  DialogControlsSection,
  ProgressBarWithInfo,
  ConfirmModal,
  showModal
} from "@decky/ui";
import { AppDetails } from "@decky/ui/dist/globals/steam-client/App";
import { ReactNode, useEffect, useState } from "react";
import { FaCloudUploadAlt, FaCloudDownloadAlt, FaCog, FaSlash, FaFileAlt } from "react-icons/fa";
import GamePaths, { GamePathSetting } from "./customcloud-gamepaths";
import LogView from "./customcloud-logview";

export interface InitialSettings {
    "sync_config_after_game": boolean,
    "sync_config_before_game": boolean,
    "sync_save_after_game": boolean,
    "sync_save_before_game": boolean,
    "paths": GamePathSetting[],
    "game_folder": string
}

interface GameSettingsProps {
    selectedGame: number | null,
    gameDetails: AppDetails | null,
    appIsInstalled: boolean,
    initialSettings: InitialSettings,
    setInitialSettings: React.Dispatch<React.SetStateAction<InitialSettings>>,
    setSelectedGame: React.Dispatch<React.SetStateAction<number | null>>,
}

declare const collectionStore: any;

function GameSettings({selectedGame, gameDetails, appIsInstalled, initialSettings, setInitialSettings, setSelectedGame}: GameSettingsProps)
{
    const [rcloneStatus, setRcloneStatus] = useState<string>("idle");
    const [rcloneProgress, setRcloneProgress] = useState<number | undefined>();
    const [rcloneEta, setRcloneEta] = useState<number>(0);
    const [installedGames, setInstalledGames] = useState<SingleDropdownOption[]>([]);

    const steamCloudEnabled = gameDetails?.bCloudEnabledForApp ?? true;

    const CLOUD_WARNING = "Steam Cloud is enabled for this game. Therefore, it is not recommended to have this on, as downloading from your cloud may cause interference with Steam Cloud. Enable this setting anyway?";

    useEffect(() =>
    {
        if(installedGames.length == 0) return;

        setSelectedGame(selectedGame || installedGames[0].data);

    }, [installedGames])

    useEffect(() =>
    {
        const allGames = collectionStore.myGamesCollection.allApps.filter((app: any) => app.is_available_on_current_platform == true);

        setInstalledGames(allGames.map((app: any) => ({data: app.appid, label: app.display_name})));
    }, [])

    useEffect(() => {

        const updateRcloneProgress = (progress: number, eta: number, message: string) =>
        {
            setRcloneProgress(progress)
            setRcloneEta(eta)
            updateRcloneStatus();

            if(progress == 100)
            {
                console.log("Status: ", rcloneStatus)
                toaster.toast({
                    title: "Decky CustomCloud",
                    body: message
                });
            }
        }

        addEventListener('progress_event', updateRcloneProgress);

        return () => {
            removeEventListener('progress_event', updateRcloneProgress);

            setRcloneProgress(undefined);

            updateRcloneStatus();
            }
    }, [])

    const updateRcloneStatus = async() =>
    {
        let newStatus = await call<[], string>("get_status");

        setRcloneStatus(newStatus)
    }

    useEffect(() =>
    {
        updateRcloneStatus();
    }, [])

    return (
    <DialogBody>
        <DialogControlsSection>
            <Dropdown
            rgOptions={installedGames}
            selectedOption={selectedGame}
            onChange={(newSelection) => setSelectedGame(newSelection.data)}
            >
            </Dropdown>
        
        </DialogControlsSection>
        <DialogControlsSection>
        <DialogControlsSectionHeader>Config Data</DialogControlsSectionHeader>
        <ToggleField
            label="Push config data to cloud after ending game"
            onChange={(checked) => {
                setInitialSettings({...initialSettings, "sync_config_after_game": checked});

                setSetting("sync_config_after_game", checked);
            }}
            disabled={!appIsInstalled}
            layout="inline"
            checked={initialSettings['sync_config_after_game']}
        >
        </ToggleField>
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "uploading_config"}
            onClick={() => {
                setRcloneProgress(undefined)
                setRcloneEta(0)
                call<[push_configsaves: boolean]>("rclone_push_config",true);
                updateRcloneStatus();
            }}
            label="Push to cloud"
            buttonBody={<FaCloudUploadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={rcloneProgress != undefined ? "Uploading " + Math.floor(rcloneProgress) + "%" : "Uploading"}
            rtEstimatedCompletionTime={String(rcloneEta) + " " + (Number(new Date()) / 1000) + rcloneEta}
        />
        </DialogControlsSection>
        <DialogControlsSection>
        <ToggleFieldWithWarning
            label="Pull config data from cloud when starting game"
            onChange={(checked) => {
                setInitialSettings({...initialSettings, "sync_config_before_game": checked});

                setSetting("sync_config_before_game", checked);
            }}
            warning={CLOUD_WARNING}
            disabled={!appIsInstalled}
            checked={initialSettings['sync_config_before_game']}
            isSteamCloudEnabled={steamCloudEnabled}
        />
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "downloading_config"}
            onClick={() => {
                setRcloneProgress(undefined)
                setRcloneEta(0)
                call<[pull_configsaves: boolean]>("rclone_pull_config",true);
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            buttonBody={<FaCloudDownloadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={rcloneProgress != undefined ? "Downloading " + Math.floor(rcloneProgress) + "%" : "Downloading"}
            rtEstimatedCompletionTime={(Number(new Date()) / 1000) + rcloneEta}
        />
        </DialogControlsSection>
        <DialogControlsSection>
        <DialogControlsSectionHeader>Save Data</DialogControlsSectionHeader>
        <ToggleField
            label="Push save data to cloud after ending game"
            onChange={(checked) => {
                setInitialSettings({...initialSettings, "sync_save_after_game": checked});

                setSetting("sync_save_after_game", checked);
            }}
            disabled={!appIsInstalled}
            layout="inline"
            checked={initialSettings['sync_save_after_game']}
        >
        </ToggleField>
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "uploading_save"}
            onClick={() => {
                setRcloneProgress(undefined)
                setRcloneEta(0)
                call<[push_configsaves: boolean]>("rclone_push_save",true);
                updateRcloneStatus();
            }}
            label="Push to cloud"
            buttonBody={<FaCloudUploadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={rcloneProgress != undefined ? "Uploading " + Math.floor(rcloneProgress) + "%" : "Uploading"}
            rtEstimatedCompletionTime={(Number(new Date()) / 1000) + rcloneEta}
        />
        </DialogControlsSection>
        <DialogControlsSection>
        <ToggleFieldWithWarning
            label="Pull save data from cloud when starting game"
            onChange={(checked) => {
                setInitialSettings({...initialSettings, "sync_save_before_game": checked});

                setSetting("sync_save_before_game", checked);
            }}
            warning={CLOUD_WARNING}
            disabled={!appIsInstalled}
            checked={initialSettings['sync_save_before_game']}
            isSteamCloudEnabled={steamCloudEnabled}
        />
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "downloading_save"}
            onClick={() => {
                setRcloneProgress(undefined)
                setRcloneEta(0)
                call<[pull_configsaves: boolean]>("rclone_pull_save",true);
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            buttonBody={<FaCloudDownloadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={rcloneProgress != undefined ? "Downloading " + Math.floor(rcloneProgress) + "%" : "Downloading"}
            rtEstimatedCompletionTime={(Number(new Date()) / 1000) + rcloneEta}
        />
        </DialogControlsSection>
        <PanelSectionRow>
            <pre>
                {JSON.stringify(gameDetails,null,"\t")}
            </pre>
        </PanelSectionRow>
    </DialogBody>
    );
}

interface ButtonProgressBarSwitchProps {
    switchCondition: boolean,
    onClick: () => void,
    label: string,
    buttonBody: ReactNode
    disabled: boolean,
    nProgress: number | undefined,
    sOperationText: string,
    rtEstimatedCompletionTime?: ReactNode
}

function ButtonProgressBarSwitch({switchCondition, onClick, label, buttonBody, disabled, nProgress, sOperationText,rtEstimatedCompletionTime}: ButtonProgressBarSwitchProps) {
    return switchCondition ?
        (<ButtonItem
            onClick={onClick}
            label={label}
            disabled={disabled}
        >
            {buttonBody}
        </ButtonItem>
        ) : (
        <ProgressBarWithInfo
            nProgress={nProgress}
            label={label}
            indeterminate={nProgress != undefined || nProgress != null}
            sOperationText={sOperationText}
            rtEstimatedCompletionTime={rtEstimatedCompletionTime}
        />
    )
}

interface ToggleFieldWithWarningProps {
    label: string,
    warning: string,
    disabled: boolean,
    checked: boolean,
    onChange: (checked: boolean) => void,
    isSteamCloudEnabled: boolean
}

function ToggleFieldWithWarning({label, warning, disabled, checked, onChange, isSteamCloudEnabled}: ToggleFieldWithWarningProps) {
    return <ToggleField
        label={label}
        onChange={(checked) => {
            onChange(checked);

            if(checked && isSteamCloudEnabled)
            {
                showModal(
                    <ConfirmModal
                    strTitle="Warning"
                    strDescription={warning}
                    onCancel={() => {
                        onChange(false);
                    }}
                    />
                )
            }
        }}
        disabled={disabled}
        layout="inline"
        checked={checked}
    >
    </ToggleField>
}

export function setSetting(key: string, value: any)
{
    call<[key: string, value: any], any>("set_app_setting",key, value);
}

export default function CustomCloudConfig() {

    const [selectedGame, setSelectedGame] = useState<number|null>(null);
    const [gameDetails, setGameDetails] = useState<AppDetails|null>(null);
    const [initialSettings, setInitialSettings] = useState<InitialSettings>({
        "sync_config_after_game": true,
        "sync_config_before_game": true,
        "sync_save_after_game": true,
        "sync_save_before_game": true,
        "paths": [],
        "game_folder": ""
    })
    const [loadingPaths, setLoadingPaths] = useState(false);

    const isAShortcut = gameDetails?.strShortcutStartDir != undefined;
    const appIsInstalled = (!isAShortcut && gameDetails?.iInstallFolder != -1) || isAShortcut;

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
        if(selectedGame == null) return;

        updateGameInfo(selectedGame);
    }, [selectedGame])

    return <SidebarNavigation pages={
        [
        {
            title: "Game Settings",
            content: (
                <GameSettings
                selectedGame={selectedGame}
                gameDetails={gameDetails}
                appIsInstalled={appIsInstalled}
                initialSettings={initialSettings}
                setInitialSettings={setInitialSettings}
                setSelectedGame={setSelectedGame} />
            ),
            visible: true,
            route: '/customcloud-config/settings',
            icon: <FaCog />
        },
        {
            title: "Game Paths",
            content: (
                <GamePaths
                initialSettings={initialSettings}
                setInitialSettings={setInitialSettings}
                loadingPaths={loadingPaths}
                setLoadingPaths={setLoadingPaths}
                appIsInstalled={appIsInstalled} />
            ),
            visible: true,
            route: '/customcloud-config/gamepaths',
            icon: <FaSlash />
        },
        {
            title: "Log View",
            content: (
                <LogView />
            ),
            visible: true,
            route: '/customcloud-config/logview',
            icon: <FaFileAlt />
        }
        ]
    } />;
};