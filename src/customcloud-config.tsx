import { call, addEventListener, removeEventListener, toaster, callable } from "@decky/api";
import {
  PanelSectionRow,
  Dropdown,
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
import { ReactNode, useEffect, useState } from "react";
import { FaCloudUploadAlt, FaCloudDownloadAlt, FaCog, FaSlash, FaFileAlt } from "react-icons/fa";
import GamePaths from "./customcloud-gamepaths";
import LogView from "./customcloud-logview";
import { AppSettingsProvider, useAppSettings } from "./settings";

const rclonePush = callable<[push_config: boolean,push_save: boolean], void>("rclone_push");
const rclonePull = callable<[pull_config: boolean,pull_save: boolean], void>("rclone_pull");

declare const collectionStore: any;

function GameSettings()
{
    const [rcloneStatus, setRcloneStatus] = useState<string>("idle");
    const [rcloneProgress, setRcloneProgress] = useState<number | undefined>();
    const [rcloneEta, setRcloneEta] = useState<number>(0);
    const installedGames = collectionStore.myGamesCollection.allApps.filter((app: any) => app.is_available_on_current_platform == true).map((app: any) => ({data: app.appid, label: app.display_name}));

    const { initialSettings, setSetting, gameDetails, appIsInstalled, appId, setAppId } = useAppSettings();

    const steamCloudEnabled = gameDetails?.bCloudEnabledForApp ?? true;

    const CLOUD_WARNING = "Steam Cloud is enabled for this game. Therefore, it is not recommended to have this on, as downloading from your cloud may cause interference with Steam Cloud. Enable this setting anyway?";

    useEffect(() =>
    {
        setAppId(appId || installedGames[0].data);
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
            selectedOption={appId}
            onChange={(newSelection) => setAppId(newSelection.data)}
            >
            </Dropdown>
        
        </DialogControlsSection>
        <DialogControlsSection>
        <DialogControlsSectionHeader>Config Data</DialogControlsSectionHeader>
        <ToggleField
            label="Push config data to cloud after ending game"
            onChange={(checked) => {
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
                rclonePush(true,false);
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
                rclonePull(true,false);
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
                rclonePush(false,true);
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
                rclonePull(false,true);
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

export default function CustomCloudConfig() {
    return <AppSettingsProvider>
    <SidebarNavigation pages={
        [
        {
            title: "Game Settings",
            content: (
                <GameSettings />
            ),
            visible: true,
            route: '/customcloud-config/settings',
            icon: <FaCog />
        },
        {
            title: "Game Paths",
            content: (
                <GamePaths />
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
    } />
    </AppSettingsProvider>;
};