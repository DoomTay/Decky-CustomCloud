import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  Navigation,
  staticClasses
} from "@decky/ui";
import {
  definePlugin,
  routerHook
} from "@decky/api"
import { FaShip } from "react-icons/fa";
import CustomCloudConfig from "./customcloud-config";

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
    icon: <FaShip />,
    // The function triggered when your plugin unloads
    onDismount() {
      routerHook.removeRoute("/customcloud-config");
      routerHook.removePatch('/library/app/:appid',configPatch);
    },
  };
});
