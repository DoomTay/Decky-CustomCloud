import {
  PanelSectionRow,
  Dropdown,
  SingleDropdownOption,
  Focusable,
  ToggleField,
  ButtonItem,
  SidebarNavigation,
  DialogBody,
  DialogControlsSectionHeader,
  DialogControlsSection
} from "@decky/ui";
import { AppDetails } from "@decky/ui/dist/globals/steam-client/App";
import { useEffect, useState } from "react";
import { FaCloudUploadAlt, FaCloudDownloadAlt, FaCog } from "react-icons/fa";

export default function CustomCloudConfig() {
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

    const updateGameInfo = async(gameSelection: SingleDropdownOption) =>
    {
        SteamClient.Apps.RegisterForAppDetails(gameSelection.data,(details) => {
            const gameInfoText = details;
            setGameInfoText(gameInfoText);
        })
    }

    const [gameInfoText, setGameInfoText] = useState<AppDetails | undefined>();

    useEffect(() =>
    {
        updateGameInfo(installedGames[0]);
    }, [])

    function ConfigContent()
    {
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
                label="Push to cloud after ending game"
                layout="inline"
                checked={true}
            >
            </ToggleField>
            <ButtonItem
                onClick={() => {}}
                label="Push to cloud"
                disabled={gameInfoText?.iInstallFolder == -1}
            >
            <FaCloudUploadAlt />
            </ButtonItem>
            </DialogControlsSection>
            <DialogControlsSection>
            <ToggleField
                label="Pull from cloud when starting game"
                layout="inline"
                checked={true}
            >
            </ToggleField>
            <ButtonItem
                onClick={() => {}}
                label="Pull from cloud"
                disabled={gameInfoText?.iInstallFolder == -1}
            >
                <FaCloudDownloadAlt />
            </ButtonItem>
            </DialogControlsSection>
            <PanelSectionRow>
                <Focusable>
                    <pre>
                        {JSON.stringify(gameInfoText,null,"\t")}
                    </pre>
                </Focusable>
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
            route: '/customcloud-config/config',
            icon: <FaCog />,
        }
        ]
    } />;
};