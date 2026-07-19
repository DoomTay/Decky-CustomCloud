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
import GamePaths, { GamePathSetting } from "./customcloud-gamepaths";

interface ConfigContentProps {
    selectedGame: SingleDropdownOption | null,
    appIsInstalled: boolean,
    setSelectedGame: React.Dispatch<React.SetStateAction<SingleDropdownOption | null>>,
    setAppIsInstalled: React.Dispatch<React.SetStateAction<boolean>>,
    setGamePaths: React.Dispatch<React.SetStateAction<GamePathSetting[]>>,
    setLoadingPaths: React.Dispatch<React.SetStateAction<boolean>>
}

function ConfigContent({selectedGame, appIsInstalled, setSelectedGame, setAppIsInstalled, setGamePaths, setLoadingPaths}: ConfigContentProps)
{
    const [rcloneStatus, setRcloneStatus] = useState("idle");
    const [rcloneProgress, setRcloneProgress] = useState<number | undefined>();
    const [rcloneEta, setRcloneEta] = useState<number>(0);
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
            {data: 1086940, label: "Baldur's Gate 3"},
            {data: 3017860, label: "Doom: The Dark Ages"},
            {data: 736260, label: "Baba Is You"},
            {data: 235460, label: "Metal Gear Rising"},
            {data: 238210, label: "System Shock 2"},
            {data: 413410, label: "Danganronpa 1"}
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

    const updateGameInfo = async(gameSelection: SingleDropdownOption) =>
    {
        setSelectedGame(gameSelection);

        const { unregister } = SteamClient.Apps.RegisterForAppDetails(gameSelection.data, async (details) => {
            unregister();

            setSteamCloudEnabled(details.bCloudEnabledForApp)
            setAppIsInstalled(details.iInstallFolder != -1)

            setLoadingPaths(true);
            const newSettings = await call<[appInfo: AppDetails], any>("get_app_settings",details);

            setCloudUploadConfigEnabled(newSettings['sync_config_after_game']);
            setCloudDownloadConfigEnabled(newSettings['sync_config_before_game']);
            setCloudUploadSaveEnabled(newSettings['sync_save_after_game']);
            setCloudDownloadSaveEnabled(newSettings['sync_save_before_game']);

            setGamePaths(newSettings['paths']);

            setGameInfoText(details);

            setLoadingPaths(false);
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
                setRcloneProgress(undefined)
                setRcloneEta(0)
                call<[]>("rclone_pull_config");
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            buttonBody={<FaCloudDownloadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={"Downloading " + rcloneProgress + "%"}
            rtEstimatedCompletionTime={(Number(new Date()) / 1000) + rcloneEta}
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
                setRcloneProgress(undefined)
                setRcloneEta(0)
                call<[]>("rclone_push_save");
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
                setRcloneProgress(undefined)
                setRcloneEta(0)
                call<[]>("rclone_pull_save");
                updateRcloneStatus();
            }}
            label="Pull from cloud"
            buttonBody={<FaCloudDownloadAlt />}
            disabled={!appIsInstalled || rcloneStatus != "idle"}
            nProgress={rcloneProgress}
            sOperationText={"Downloading " + rcloneProgress + "%"}
            rtEstimatedCompletionTime={(Number(new Date()) / 1000) + rcloneEta}
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

export default function CustomCloudConfig() {

    const [selectedGame, setSelectedGame] = useState<SingleDropdownOption|null>(null);
    const [appIsInstalled, setAppIsInstalled] = useState(true);
    const [gamePaths, setGamePaths] = useState<GamePathSetting[]>([]);
    const [loadingPaths, setLoadingPaths] = useState(false);

    useEffect(() =>
    {
        if(gamePaths.length == 0) return;

        call<[key: string, value: any], any>("set_app_setting","paths", gamePaths);
    }, [gamePaths, selectedGame])

    return <SidebarNavigation pages={
        [
        {
            title: "CustomCloud Config",
            content: (
                <ConfigContent
                selectedGame={selectedGame}
                appIsInstalled={appIsInstalled}
                setSelectedGame={setSelectedGame} 
                setAppIsInstalled={setAppIsInstalled}
                setGamePaths={setGamePaths}
                setLoadingPaths={setLoadingPaths} />
            ),
            visible: true,
            route: '/customcloud-config/config',
            icon: <FaCog />
        },
        {
            title: "Game Paths",
            content: (
                <GamePaths
                paths={gamePaths}
                setGamePaths={setGamePaths}
                loadingPaths={loadingPaths}
                setLoadingPaths={setLoadingPaths}
                appIsInstalled={appIsInstalled} />
            ),
            visible: true,
            route: '/customcloud-config/gamepaths',
            icon: <FaSlash />
        }
        ]
    } />;
};