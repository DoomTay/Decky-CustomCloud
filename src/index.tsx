import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  Navigation,
  staticClasses,
  showModal,
  ConfirmModal,
  TextField,
  ModalRoot,
  DialogHeader,
  DialogBodyText
} from "@decky/ui";
import {
  addEventListener,
  call,
  callable,
  definePlugin,
  removeEventListener,
  routerHook,
  toaster
} from "@decky/api"
import { FaCloud } from "react-icons/fa";
import CustomCloudConfig from "./customcloud-config";
import startConfigWizard from "./rclone-wizard";
import { useEffect, useState } from "react";
import { AppLifetimeNotification } from "@decky/ui/dist/globals/steam-client/GameSessions";
import { ELaunchSource } from "@decky/ui/dist/globals/steam-client/App";

const PLUGIN_NAME = "Decky CustomCloud";

const downloadManifest = callable<[], {success: boolean, status_code: number, status_text: string, error: string}>("download_ludusavi_manifest");
const updateRclone = callable<[], {success: boolean, status_code: number, status_text: string, error: string}>("update_rclone");
const getSetting = callable<[appId: number, setting: string, default_value: any], any>("get_app_setting");
let gameIsRunning = false;

function Content() {
  const [downloadingRclone, setDownloadingRclone] = useState<boolean>(false);
  const DEFAULT_CLOUD_DIRECTORY = "CustomCloud-Backup"

  return (
    <PanelSection>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => {
            Navigation.Navigate("/customcloud-config");
            Navigation.CloseSideMenus();
          }}
        >
          {"Config Settings"}
        </ButtonItem>
        <ButtonItem
          layout="below"
          onClick={async () => {
            let cloudDirectory = await call<[key: string], string>("get_global_setting","cloud_directory");
            if(cloudDirectory == "") cloudDirectory = DEFAULT_CLOUD_DIRECTORY

            showModal(
              <ConfirmModal
                strTitle="Cloud directory"
                onOK={async () => {
                  call<[key: string, value: any], any>("set_global_setting","cloud_directory", cloudDirectory);
                }}
                onMiddleButton={async () => {
                  showModal(
                    <ConfirmModal
                        strTitle="Warning"
                        strDescription="Reset cloud directory to default?"
                        bDestructiveWarning={true}
                        onOK={async () => {
                          call<[key: string, value: any], any>("set_global_setting","cloud_directory", DEFAULT_CLOUD_DIRECTORY);
                        }}
                        />
                    )
                }}
                strMiddleButtonText="Reset to default"
                >
                <TextField 
                  defaultValue={cloudDirectory}
                  onBlur={(e) => {cloudDirectory = e.target.value}}
                />
              </ConfirmModal>
            )
          }}
        >
          {"Set cloud directory"}
        </ButtonItem>
        <ButtonItem
          layout="below"
          onClick={startConfigWizard}
        >
          {"Configure Rclone"}
        </ButtonItem>
        <ButtonItem
          layout="below"
          onClick={async () => {
            let downloadResult = await downloadManifest()

            if(downloadResult.success == true)
            {
              if(downloadResult.status_code == 200)
              {
                //All good
                toaster.toast({
                    title: PLUGIN_NAME,
                    body: "Manifest download complete"
                });
              }
              else if(downloadResult.status_code == 304)
              {
                //Already up to date
                toaster.toast({
                    title: PLUGIN_NAME,
                    body: "Manifest already up to date"
                });
              }
              else
              {
                //We got a problem
                toaster.toast({
                    title: PLUGIN_NAME,
                    body: "Manifest download error",
                    subtext: downloadResult.status_code + " " + downloadResult.status_text,
                    critical: true
                });
              }
            }
            else
            {
              const errorTable: Record<string, string> = 
              {
                "ConnectionError": "Connection Error",
                "ConnectTimeout": "Timed out"
              }

              toaster.toast({
                  title: PLUGIN_NAME,
                  body: "Manifest download error",
                  subtext: errorTable[downloadResult.error] ?? downloadResult.error,
                  critical: true
              });
            }
          }}
        >
          {"Update Ludusavi manifest"}
        </ButtonItem>
        <ButtonItem
          layout="below"
          disabled={downloadingRclone}
          onClick={async () => {
            setDownloadingRclone(true);
            let downloadResult = await updateRclone()
            setDownloadingRclone(false);

            if(downloadResult.success == true)
            {
              if(downloadResult.status_code == 200)
              {
                //All good
                toaster.toast({
                    title: PLUGIN_NAME,
                    body: "Rclone updated"
                });
              }
              else
              {
                //We got a problem
                toaster.toast({
                    title: PLUGIN_NAME,
                    body: "Rclone download error",
                    subtext: downloadResult.status_code + " " + downloadResult.status_text,
                    critical: true
                });
              }
            }
            else
            {
              const errorTable: Record<string, string> = 
              {
                "ConnectionError": "Connection Error",
                "ConnectTimeout": "Timed out"
              }

              toaster.toast({
                  title: PLUGIN_NAME,
                  body: "Rclone download error",
                  subtext: errorTable[downloadResult.error] ?? downloadResult.error,
                  critical: true
              });
            }
          }}
        >
          {downloadingRclone ? "Updating Rclone" : "Update Rclone"}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
};

function CloudDownloadModal({downloadConfigBeforeGame,downloadSaveBeforeGame,onClose}: {downloadConfigBeforeGame: boolean,downloadSaveBeforeGame: boolean, onClose: () => void})
{
  const [progress,setProgress] = useState<number  | undefined>();

  useEffect(() => {
    addEventListener("progress_event",updateProgress);

    call<[pull_config: boolean,pull_save: boolean], void>("rclone_pull",downloadConfigBeforeGame,downloadSaveBeforeGame);

    return () => {
      removeEventListener("progress_event",updateProgress);
    }
  },[])

  function updateProgress(newProgress: number)
  {
    console.log(newProgress);
    setProgress(newProgress);

    if(newProgress == 100) onClose();
  }

  return <ModalRoot
    bOKDisabled={true}
    bCancelDisabled={true}
    onCancel={() => {}}>
        <DialogHeader>{PLUGIN_NAME}</DialogHeader>
        <DialogBodyText>Downloading from cloud...{(progress != undefined) && `(${Math.floor(progress)}%)`}</DialogBodyText>
  </ModalRoot>
}

export default definePlugin(() => {
  routerHook.addRoute("/customcloud-config", CustomCloudConfig, {});

 /*  const contextMenuHook = showContextMenu({
    label: "CustomCloud Settings",
    context: "GameContext", 
    onClick: (contextData: any) => {
      const appId = contextData?.appid;

      if (appId) {
        Navigation.Navigate(`/sync-settings/${appId}`);
      }
    }
  });
 */

  const getRealAppID = (appId: number) =>
  {
    const lowerBits = appId & 0xFFFFFFFF;

    if(lowerBits == 0x02000000) appId = Number(BigInt(appId) >> (BigInt(32)));

    return appId;
  }

  const gameLaunchRegister = SteamClient.Apps.RegisterForGameActionStart(async (gameActionId: number, appId: string, action: string, launchSource: ELaunchSource) => {
    if(action == "LaunchApp" && gameIsRunning == false)
    {
      gameIsRunning = true;
      const appIdNum = Number(appId);
      const appIdNum = getRealAppID(Number(appId));
      const [downloadConfigBeforeGame,downloadSaveBeforeGame] = await Promise.all([getSetting(appIdNum,"sync_config_before_game",false),getSetting(appIdNum,"sync_save_before_game",false)]);
      if(downloadConfigBeforeGame || downloadSaveBeforeGame)
      {
        console.log("Initializing download");
        SteamClient.Apps.CancelGameAction(gameActionId);

        const loadingModal = showModal(
          <CloudDownloadModal
          downloadConfigBeforeGame={downloadConfigBeforeGame}
          downloadSaveBeforeGame={downloadSaveBeforeGame}
          onClose={() => {
            console.log("Download complete");
            loadingModal.Close();
            SteamClient.Apps.RunGame(appId, "", -1, launchSource);
          }
          }/>
        )
      }
    }
  })

  const stateUnregister = SteamClient.GameSessions.RegisterForAppLifetimeNotifications(async (e: AppLifetimeNotification) => {
    if(e.bRunning == false)
    {
      console.log("Ending",e.unAppID);
      gameIsRunning = false;

      const [uploadConfigAfterGame,uploadSaveAfterGame] = await Promise.all([getSetting(e.unAppID,"sync_config_after_game",true),getSetting(e.unAppID,"sync_save_after_game",true)])

      if(uploadConfigAfterGame || uploadSaveAfterGame) call<[push_config: boolean,push_save: boolean], void>("rclone_push",uploadConfigAfterGame,uploadSaveAfterGame);
    }
  })

  const configPatch = routerHook.addPatch('/library/app/:appid',
    (props) => {
      console.log("Investigating", props.children);
      return props
    })

  return {
    // The name shown in various decky menus
    name: PLUGIN_NAME,
    // The element displayed at the top of your plugin's menu
    titleView: <div className={staticClasses.Title}>Decky CustomCloud</div>,
    // The content of your plugin's menu
    content: <Content />,
    // The icon displayed in the plugin list
    icon: <FaCloud />,
    // The function triggered when your plugin unloads
    onDismount() {
      routerHook.removeRoute("/customcloud-config");
      routerHook.removePatch('/library/app/:appid',configPatch);
      gameLaunchRegister.unregister();
      stateUnregister.unregister();
    },
  };
});
