import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  Navigation,
  staticClasses,
  showModal,
  ConfirmModal,
  TextField,
  ToggleField,
  Dropdown,
  ModalRoot,
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
import { ReactNode, useEffect, useRef, useState } from "react";

const downloadManifest = callable<[], {success: boolean, status_code: number, status_text: string, error: string}>("download_ludusavi_manifest");
const updateRclone = callable<[], {success: boolean, status_code: number, status_text: string, error: string}>("update_rclone");

function Content() {
  const [downloadingRclone, setDownloadingRclone] = useState<boolean>(false);
  const defaultCloudDirectory = "CustomCloud-Backup"
  const [cloudDirectory, setCloudDirectory] = useState<string>(defaultCloudDirectory);
  const tempCloudDirectory = useRef<string>("");
  const configModalOpen = useRef<boolean>(false);
  const [configLoading, setConfigLoading] = useState<boolean>(false);

  useEffect(() =>
  {
      async function getCloudDirectory()
      {
        let cloudDirectoryFromSettings = await call<[key: string], string>("get_global_setting","cloud_directory");

        if(cloudDirectoryFromSettings != "") setCloudDirectory(cloudDirectoryFromSettings)
      }

      getCloudDirectory()

  }, [])

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
            showModal(
              <ConfirmModal
                strTitle="Cloud directory"
                onOK={async () => {
                  setCloudDirectory(tempCloudDirectory.current)

                  call<[key: string, value: any], any>("set_global_setting","cloud_directory", tempCloudDirectory.current);
                }}
                onMiddleButton={async () => {
                  showModal(
                    <ConfirmModal
                        strTitle="Warning"
                        strDescription="Reset cloud directory to default?"
                        bDestructiveWarning={true}
                        onOK={async () => {
                          setCloudDirectory(defaultCloudDirectory)

                          call<[key: string, value: any], any>("set_global_setting","cloud_directory", defaultCloudDirectory);
                        }}
                        />
                    )
                }}
                strMiddleButtonText="Reset to default"
                >
                <TextField 
                  defaultValue={cloudDirectory}
                  onChange={(e) => {tempCloudDirectory.current = e.target.value}}
                />
              </ConfirmModal>
            )
          }}
        >
          {"Set cloud directory"}
        </ButtonItem>
        <ButtonItem
          layout="below"
          onClick={async () => {
            let selectedRemote = "onedrive"

            function renderPrompt(promptData: any)
            {
              setConfigLoading(true);

              // Apparently lowercase e error is a fatal situation, meanwhile capital E error allows for trying again
              let fatalError = promptData["error"];

              console.log("Output:",promptData);
              if(fatalError != undefined) return alertModal(fatalError,"Warning",true);

              let errorMessage = promptData["Error"];

              if(errorMessage != "") return alertModal(errorMessage,"Warning",false,promptData["State"],promptData["Result"]);

              let modal;
              let modalTitle = "Rclone Config";

              let optionData = promptData["Option"];

              if(promptData["State"] == "") return alertModal("Configuration complete",modalTitle,true);

              let examples = optionData["Examples"];

              switch(optionData["Type"])
              {
                case "bool":
                  let yesOption = examples.find((option: any) => option["Value"] == "true");
                  let noOption = examples.find((option: any) => option["Value"] == "false");

                  modal = (<ConfirmModal
                    strTitle={modalTitle}
                    strDescription={
                      <div style = {{
                          whiteSpace: "pre-wrap",
                          wordWrap: "break-word"
                      }}>
                        {optionData["Help"]}
                      </div>
                    }
                    bDestructiveWarning={true}
                    strOKButtonText={yesOption["Help"]}
                    strCancelButtonText={noOption["Help"]}
                    onOK={async () => {
                      setConfigLoading(true);
                      call<[remote: string, state: string, result: string], any>("rclone_config_continue",selectedRemote,promptData["State"],yesOption["Value"]);
                    }}
                    onCancel={async () => {
                      setConfigLoading(true);
                      call<[remote: string, state: string, result: string], any>("rclone_config_continue",selectedRemote,promptData["State"],noOption["Value"]);
                    }}
                    />)
                  break;
                case "string":
                case "int":
                  interface ConfigStringSelectProps {
                    onOK: (result: string) => void,
                    onCancel: () => void
                  }

                  const ConfigStringSelect = ({onOK, onCancel}: ConfigStringSelectProps) => {
                    const hasExamples = Boolean(examples?.length)
                    const [customInputEnabled, setCustomInputEnabled] = useState<boolean>(!hasExamples);
                    const configTextPrompt = useRef<string>(optionData["DefaultStr"]);

                    const dropdownOptions = examples?.map((option: any) => ({data: option["Value"], label: option["Help"]}));

                    return (
                    <ConfirmModal
                    strTitle={modalTitle}
                    strDescription={
                      <div style = {{
                          whiteSpace: "pre-wrap",
                          wordWrap: "break-word"
                      }}>
                        {optionData["Help"]}
                      </div>
                    }
                    onOK={() => onOK(configTextPrompt.current)}
                    onCancel={onCancel}
                    >
                    {customInputEnabled == true ? (
                    <TextField 
                      defaultValue={configTextPrompt.current}
                      onChange={(e) => {configTextPrompt.current = e.target.value}}
                    />) : (
                      <Dropdown
                      rgOptions={dropdownOptions}
                      selectedOption={optionData["DefaultStr"]}
                      onChange={(option) => configTextPrompt.current = option.data}
                      >
                      </Dropdown>
                    )}
                    {(hasExamples == true && optionData["Exclusive"] == false) && <ToggleField
                    label="Enable custom input"
                    checked={customInputEnabled}
                    onChange={(checked) => {
                      setCustomInputEnabled(checked);

                      if(checked) configTextPrompt.current = optionData["DefaultStr"];
                    }}
                    />}
                    </ConfirmModal>
                    )
                  }

                  modal = <ConfigStringSelect
                          onOK={async (result) => {
                              setConfigLoading(true);
                              call<[remote: string, state: string, result: string], any>("rclone_config_continue",selectedRemote,promptData["State"],result);
                            }}
                            onCancel={async () => {
                              configModal.Update(alertModal("Configuration has been cancelled.",modalTitle,true));
                            }}
                          />
                  break;
                case "web":
                  modal = null;

                  Navigation.NavigateToExternalWeb(optionData["Value"]);
                  break;
                default:
                  console.error("Unknown response type:",promptData)
                  modal = alertModal("Unknown response type " + optionData["Type"] + ". Unable to continue","Warning")
                  break;
              }

              return (configLoading ? loadingModal : modal);
            }

            const loadingModal = (
              <ModalRoot
              bOKDisabled={true}
              bCancelDisabled={true}>
                Loading...
              </ModalRoot>
            )

            function alertModal(message: string,title: string,finalEvent?: boolean,state?: string, result?: string)
            {
              return <ConfirmModal
                bAlertDialog={true}
                strTitle={title}
                strDescription={message}
                onOK={async () => {
                  configModal.Close()

                  if(finalEvent) removeEventListener('config_event', handlePrompt);
                  else if(state) call<[remote: string, state?: string, result?: string], any>("rclone_config_continue",selectedRemote,state,result);
                }}
                onCancel={() => {}}
                />
            }

            function openConfigModal(modal: ReactNode)
            {
              let configModal = showModal(modal);
              configModal.ClosedPromise.then(() => configModalOpen.current = false)

              configModalOpen.current = true;

              return configModal;
            }

            let configModal = openConfigModal(loadingModal);

            function handlePrompt(promptData: any)
            {
              let promptModal = renderPrompt(promptData);
              if(promptModal)
              {
                if(configModalOpen.current == true) configModal.Update(promptModal);
                else configModal = openConfigModal(promptModal);
              }
              else configModal.Close();
            }

            addEventListener('config_event', handlePrompt);

            call<[remote: string], any>("rclone_config",selectedRemote);

          }}
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
                    title: "Decky CustomCloud",
                    body: "Manifest download complete"
                });
              }
              else if(downloadResult.status_code == 304)
              {
                //Already up to date
                toaster.toast({
                    title: "Decky CustomCloud",
                    body: "Manifest already up to date"
                });
              }
              else
              {
                //We got a problem
                toaster.toast({
                    title: "Decky CustomCloud",
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
                  title: "Decky CustomCloud",
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
                    title: "Decky CustomCloud",
                    body: "Rclone updated"
                });
              }
              else
              {
                //We got a problem
                toaster.toast({
                    title: "Decky CustomCloud",
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
                  title: "Decky CustomCloud",
                  body: "Rclone download error",
                  subtext: errorTable[downloadResult.error] ?? downloadResult.error,
                  critical: true
              });
            }
          }}
        >
          {downloadingRclone ? "Updating Rclone" : "Update Rclone" }
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
    name: "Decky CustomCloud",
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
