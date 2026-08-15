import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  Navigation,
  staticClasses,
  showModal,
  ConfirmModal,
  TextField
} from "@decky/ui";
import {
  call,
  callable,
  definePlugin,
  routerHook,
  toaster
} from "@decky/api"
import { FaCloud } from "react-icons/fa";
import CustomCloudConfig from "./customcloud-config";
import startConfigWizard from "./rclone-wizard";
import { useState } from "react";

const PLUGIN_NAME = "Decky CustomCloud";

const downloadManifest = callable<[], {success: boolean, status_code: number, status_text: string, error: string}>("download_ludusavi_manifest");
const updateRclone = callable<[], {success: boolean, status_code: number, status_text: string, error: string}>("update_rclone");

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
    },
  };
});
