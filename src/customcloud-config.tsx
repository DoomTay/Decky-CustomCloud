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

export default function CustomCloudConfig() {


    function ConfigContent()
    {
        const [rcloneStatus, setRcloneStatus] = useState("idle");
        const [rcloneProgress, setRcloneProgress] = useState<number | undefined>()
        const [gameInfoText, setGameInfoText] = useState<AppDetails | undefined>();
        const [cloudDownloadSaveEnabled, setCloudDownloadSaveEnabled] = useState(true)

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

        function getInstalledGames()
        {
            var games = [{data: 13250, label: "Unreal Gold"},
                {data: 338930, label: "Transformers: Devastation"},
                {data: 480490, label: "Prey"},
                {data: 379720, label: "Doom (2016)"}
            ]
            return games;
        }

        var installedGames = getInstalledGames();

        const updateRcloneStatus = async() =>
        {
            let newStatus = await call<[], string>("get_status");

            setRcloneStatus(newStatus)
        }
        updateRcloneStatus();

        const updateGameInfo = async(gameSelection: SingleDropdownOption) =>
        {
            SteamClient.Apps.RegisterForAppDetails(gameSelection.data,(details) => {
                const gameInfoText = details;
                setGameInfoText(gameInfoText);
            })
        }
        useEffect(() =>
        {
            updateGameInfo(installedGames[0]);
        }, [])
    
        return (
        <DialogBody>
            <DialogControlsSection>
                <Dropdown
                rgOptions= {installedGames}
                selectedOption={installedGames[0]?.data}
                onChange={updateGameInfo}
                >
                </Dropdown>
            
            </DialogControlsSection>
            <DialogControlsSection>
            <DialogControlsSectionHeader>Config Data</DialogControlsSectionHeader>
            <ToggleField
                label="Push config data to cloud after ending game"
                disabled={gameInfoText?.iInstallFolder == -1}
                layout="inline"
                checked={true}
            >
            </ToggleField>
            {rcloneStatus != "uploading_config" ?
            (<ButtonItem
                onClick={() => {
                    call<[]>("rclone_push_config");
                    updateRcloneStatus();
                }}
                label="Push to cloud"
                disabled={gameInfoText?.iInstallFolder == -1 || rcloneStatus != "idle"}
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
            <ToggleField
                label="Pull config data from cloud when starting game"
                disabled={gameInfoText?.iInstallFolder == -1}
                layout="inline"
                checked={true}
            >
            </ToggleField>
            {rcloneStatus != "downloading_config" ?
            (<ButtonItem
                onClick={() => {
                    call<[]>("rclone_pull_config");
                    updateRcloneStatus();
                }}
                label="Pull from cloud"
                disabled={gameInfoText?.iInstallFolder == -1 || rcloneStatus != "idle"}
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
                disabled={gameInfoText?.iInstallFolder == -1}
                layout="inline"
                checked={true}
            >
            </ToggleField>
            {rcloneStatus != "uploading_save" ?
            (<ButtonItem
                onClick={() => {
                    call<[]>("rclone_push_save");
                    updateRcloneStatus();
                }}
                label="Push to cloud"
                disabled={gameInfoText?.iInstallFolder == -1 || rcloneStatus != "idle"}
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
            <ToggleField
                label="Pull save data from cloud when starting game"
                onChange={(checked) => {
                    setCloudDownloadSaveEnabled(checked)
                    if(checked && gameInfoText?.bCloudEnabledForApp)
                    {
                        showModal(
                            <ConfirmModal
                            strTitle="Warning"
                            strDescription="Steam Cloud is enabled for this game. Therefore, it is not recommended to have this on, as downloading from your cloud may cause interference with Steam Cloud. Enable this setting anyway?"
                            onCancel={() => (setCloudDownloadSaveEnabled(false))}
                            />
                        )
                    }
                }}
                disabled={gameInfoText?.iInstallFolder == -1}
                layout="inline"
                checked={cloudDownloadSaveEnabled}
            >
            </ToggleField>
            {rcloneStatus != "downloading_save" ?
            (<ButtonItem
                onClick={() => {
                    call<[]>("rclone_pull_save");
                    updateRcloneStatus();
                }}
                label="Pull from cloud"
                disabled={gameInfoText?.iInstallFolder == -1 || rcloneStatus != "idle"}
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

    return <SidebarNavigation pages={
        [
        {
            title: "CustomCloud Config",
            content: (
                <ConfigContent />
            ),
            visible: true,
            route: '/customcloud-config/config',
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
        }
        ]
    } />;
};