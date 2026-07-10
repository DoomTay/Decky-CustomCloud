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
import { useEffect, useState } from "react";
import { FaCloudUploadAlt, FaCloudDownloadAlt, FaCog, FaSlash } from "react-icons/fa";
import GamePaths from "./customcloud-gamepaths";

interface ConfigContentProps {
    selectedGame: SingleDropdownOption | null,
    appIsInstalled: boolean,
    setSelectedGame: React.Dispatch<React.SetStateAction<SingleDropdownOption | null>>,
    setAppIsInstalled: React.Dispatch<React.SetStateAction<boolean>>
}

function ConfigContent({selectedGame, appIsInstalled, setSelectedGame, setAppIsInstalled}: ConfigContentProps)
{
    const [rcloneStatus, setRcloneStatus] = useState("idle");
    const [rcloneProgress, setRcloneProgress] = useState<number | undefined>();
    const [gameInfoText, setGameInfoText] = useState<any | undefined>();
    const [cloudUploadConfigEnabled, setCloudUploadConfigEnabled] = useState(true);
    const [cloudDownloadConfigEnabled, setCloudDownloadConfigEnabled] = useState(true);
    const [cloudUploadSaveEnabled, setCloudUploadSaveEnabled] = useState(true);
    const [cloudDownloadSaveEnabled, setCloudDownloadSaveEnabled] = useState(true);
    const [steamCloudEnabled, setSteamCloudEnabled] = useState(true);
    const [installedGames, setInstalledGames] = useState<SingleDropdownOption[]>([]);

    const CLOUD_WARNING = "Steam Cloud is enabled for this game. Therefore, it is not recommended to have this on, as downloading from your cloud may cause interference with Steam Cloud. Enable this setting anyway?";

    async function getInstalledGames()
    {
        var games = [{data: 13250, label: "Unreal Gold"},
            {data: 338930, label: "Transformers: Devastation"},
            {data: 480490, label: "Prey"},
            {data: 379720, label: "Doom (2016)"},
            {data: 1086940, label: "Baldur's Gate 3"}
        ]
        setInstalledGames(games);

        setSelectedGame(games[0]);
        updateGameInfo(games[0]);
    }

    useEffect(() =>
    {
        getInstalledGames();
    }, [])

    useEffect(() => {
        const updateRcloneProgress = (progress: number) =>
        {
            setRcloneProgress(progress)
            updateRcloneStatus();

            if(progress == 100)
            {
                console.log("Status: ", rcloneStatus)
                toaster.toast({
                    title: "Decky CustomCloud",
                    body: "Syncing complete"
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

    const updateGameInfo = async(gameSelection: SingleDropdownOption) =>
    {
        setSelectedGame(gameSelection);
        setGameInfoText(gameSelection);

        const { unregister } = SteamClient.Apps.RegisterForAppDetails(gameSelection.data, async (details) => {
            unregister();

            setSteamCloudEnabled(details.bCloudEnabledForApp)
            setAppIsInstalled(details.iInstallFolder != -1)

            const newSettings = await call<[appInfo: AppDetails], any>("get_app_settings",details);

            setCloudUploadConfigEnabled(newSettings['sync_config_after_game']);
            setCloudDownloadConfigEnabled(newSettings['sync_config_before_game']);
            setCloudUploadSaveEnabled(newSettings['sync_save_after_game']);
            setCloudDownloadSaveEnabled(newSettings['sync_save_before_game']);
        })
    }

    function setSetting(key: string, value: any)
    {
        call<[key: string, value: any], any>("set_app_setting",key, value);
    }

    useEffect(() =>
    {
        //const unregister = SteamClient.Apps;

        if(selectedGame) updateGameInfo(selectedGame);

        updateRcloneStatus();
    }, [])

    return (
    <DialogBody>
        <DialogControlsSection>
            <Dropdown
            rgOptions={installedGames}
            selectedOption={selectedGame?.data}
            onChange={updateGameInfo}
            >
            </Dropdown>
        
        </DialogControlsSection>
        <DialogControlsSection>
        <DialogControlsSectionHeader>Config Data</DialogControlsSectionHeader>
        <ToggleField
            label="Push config data to cloud after ending game"
            onChange={(checked) => {
                setCloudUploadConfigEnabled(checked);
                setSetting("sync_config_after_game", checked);
            }}
            disabled={!appIsInstalled}
            layout="inline"
            checked={cloudUploadConfigEnabled}
        >
        </ToggleField>
        {rcloneStatus != "uploading_config" ?
        (<ButtonItem
            onClick={() => {
                call<[]>("rclone_push_config");
                updateRcloneStatus();
            }}
            label="Push to cloud"
            disabled={!appIsInstalled || rcloneStatus != "idle"}
        >
        <FaCloudUploadAlt />
        </ButtonItem>
        ) : (
        <ProgressBarWithInfo
            nProgress={rcloneProgress}
            label="Push to cloud"
            sOperationText={"Uploading " + rcloneProgress + "%"}
        />
        )}
        </DialogControlsSection>
        <DialogControlsSection>
        <ToggleFieldWithWarning
            label="Pull config data from cloud when starting game"
            setter={setCloudDownloadConfigEnabled}
            configSettingFunction={setSetting}
            configSetting="sync_config_before_game"
            warning={CLOUD_WARNING}
            disabled={!appIsInstalled}
            checked={cloudDownloadConfigEnabled}
            isSteamCloudEnabled={steamCloudEnabled}
        />
        {rcloneStatus != "downloading_config" ?
        (<ButtonItem
            onClick={() => {
                call<[]>("rclone_pull_config");
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            disabled={!appIsInstalled || rcloneStatus != "idle"}
        >
            <FaCloudDownloadAlt />
        </ButtonItem>
        ) : (
        <ProgressBarWithInfo
            nProgress={rcloneProgress}
            label="Pull from cloud"
            sOperationText={"Downloading " + rcloneProgress + "%"}
        />
        )}
        </DialogControlsSection>
        <DialogControlsSection>
        <DialogControlsSectionHeader>Save Data</DialogControlsSectionHeader>
        <ToggleField
            label="Push save data to cloud after ending game"
            onChange={(checked) => {
                setCloudUploadSaveEnabled(checked);
                setSetting("sync_save_after_game", checked);
            }}
            disabled={!appIsInstalled}
            layout="inline"
            checked={cloudUploadSaveEnabled}
        >
        </ToggleField>
        {rcloneStatus != "uploading_save" ?
        (<ButtonItem
            onClick={() => {
                call<[]>("rclone_push_save");
                updateRcloneStatus();
            }}
            label="Push to cloud"
            disabled={!appIsInstalled || rcloneStatus != "idle"}
        >
        <FaCloudUploadAlt />
        </ButtonItem>
        ) : (
        <ProgressBarWithInfo
            nProgress={rcloneProgress}
            label="Push to cloud"
            sOperationText={"Uploading " + rcloneProgress + "%"}
        />
        )}
        </DialogControlsSection>
        <DialogControlsSection>
        <ToggleFieldWithWarning
            label="Pull save data from cloud when starting game"
            setter={setCloudDownloadSaveEnabled}
            configSettingFunction={setSetting}
            configSetting="sync_save_before_game"
            warning={CLOUD_WARNING}
            disabled={!appIsInstalled}
            checked={cloudDownloadSaveEnabled}
            isSteamCloudEnabled={steamCloudEnabled}
        />
        {rcloneStatus != "downloading_save" ?
        (<ButtonItem
            onClick={() => {
                call<[]>("rclone_pull_save");
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            disabled={!appIsInstalled || rcloneStatus != "idle"}
        >
            <FaCloudDownloadAlt />
        </ButtonItem>
        ) : (
        <ProgressBarWithInfo
            nProgress={rcloneProgress}
            label="Pull from cloud"
            sOperationText={"Downloading " + rcloneProgress + "%"}
        />
        )}
        </DialogControlsSection>
        <PanelSectionRow>
            <pre>
                {JSON.stringify(gameInfoText,null,"\t")}
            </pre>
        </PanelSectionRow>
    </DialogBody>
    );
}

interface ToggleFieldWithWarningProps {
    label: string,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    configSettingFunction: (setting: string, checked: boolean) => void,
    configSetting: string
    warning: string,
    disabled: boolean,
    checked: boolean,
    isSteamCloudEnabled: boolean
}

function ToggleFieldWithWarning({label, setter, configSettingFunction, configSetting, warning, disabled, checked, isSteamCloudEnabled}: ToggleFieldWithWarningProps) {
    return <ToggleField
        label={label}
        onChange={(checked) => {
            setter(checked);

            if(checked && isSteamCloudEnabled)
            {
                showModal(
                    <ConfirmModal
                    strTitle="Warning"
                    strDescription={warning}
                    onCancel={() => {
                        setter(false);

                        configSettingFunction(configSetting, false);
                    }}
                    />
                )
            }

            configSettingFunction(configSetting, checked);
        }}
        disabled={disabled}
        layout="inline"
        checked={checked}
    >
    </ToggleField>
}

export default function CustomCloudConfig() {

    const [selectedGame, setSelectedGame] = useState<SingleDropdownOption|null>(null);
    const [appIsInstalled, setAppIsInstalled] = useState(true);

    return <SidebarNavigation pages={
        [
        {
            title: "CustomCloud Config",
            content: (
                <ConfigContent
                selectedGame={selectedGame}
                appIsInstalled={appIsInstalled}
                setSelectedGame={setSelectedGame} 
                setAppIsInstalled={setAppIsInstalled} />
            ),
            visible: true,
            route: '/customcloud-config/config',
            icon: <FaCog />
        },
        {
            title: "Game Paths",
            content: (
                <GamePaths
                currentAppId={selectedGame?.data}
                appIsInstalled={appIsInstalled} />
            ),
            visible: true,
            route: '/customcloud-config/gamepaths',
            icon: <FaSlash />
        }
        ]
    } />;
};