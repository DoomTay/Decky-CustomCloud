import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  Navigation,
  staticClasses
} from "@decky/ui";
import {
  callable,
  definePlugin,
  routerHook,
  toaster
} from "@decky/api"
import { FaCloud } from "react-icons/fa";
import CustomCloudConfig from "./customcloud-config";

const downloadManifest = callable<[], {success: boolean, status_code: number, status_text: string, error: string}>("download_ludusavi_manifest");

function Content() {
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
