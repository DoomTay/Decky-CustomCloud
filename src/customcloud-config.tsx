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
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "uploading_config"}
            onClick={() => {
                call<[]>("rclone_push_config");
                updateRcloneStatus();
            }}
            label="Push to cloud"
            buttonBody={<FaCloudUploadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={"Uploading " + rcloneProgress + "%"}
        />
        </DialogControlsSection>
        <DialogControlsSection>
        <ToggleFieldWithWarning
            label="Pull config data from cloud when starting game"
            onChange={(checked) => {
                setCloudDownloadConfigEnabled(checked);

                setSetting("sync_config_before_game", checked);
            }}
            warning={CLOUD_WARNING}
            disabled={!appIsInstalled}
            checked={cloudDownloadConfigEnabled}
            isSteamCloudEnabled={steamCloudEnabled}
        />
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "downloading_config"}
            onClick={() => {
                call<[]>("rclone_pull_config");
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            buttonBody={<FaCloudDownloadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={"Downloading " + rcloneProgress + "%"}
        />
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
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "uploading_save"}
            onClick={() => {
                call<[]>("rclone_push_save");
                updateRcloneStatus();
            }}
            label="Push to cloud"
            buttonBody={<FaCloudUploadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={"Uploading " + rcloneProgress + "%"}
        />
        </DialogControlsSection>
        <DialogControlsSection>
        <ToggleFieldWithWarning
            label="Pull save data from cloud when starting game"
            onChange={(checked) => {
                setCloudDownloadSaveEnabled(checked);

                setSetting("sync_save_before_game", checked);
            }}
            warning={CLOUD_WARNING}
            disabled={!appIsInstalled}
            checked={cloudDownloadSaveEnabled}
            isSteamCloudEnabled={steamCloudEnabled}
        />
        <ButtonProgressBarSwitch
            switchCondition={rcloneStatus != "downloading_save"}
            onClick={() => {
                call<[]>("rclone_pull_save");
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            buttonBody={<FaCloudDownloadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={"Downloading " + rcloneProgress + "%"}
        />
        </DialogControlsSection>
        <PanelSectionRow>
            <pre>
                {JSON.stringify(gameInfoText,null,"\t")}
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
    sOperationText: string
}

function ButtonProgressBarSwitch({switchCondition, onClick, label, buttonBody, disabled, nProgress, sOperationText}: ButtonProgressBarSwitchProps) {
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
            sOperationText={sOperationText}
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