import { call, FileSelectionType, openFilePicker } from "@decky/api";
import {
  DialogBody,
  DialogControlsSection,
  TextField,
  Dropdown,
  DialogButton,
  showModal,
  ConfirmModal,
  ButtonItem,
  SteamSpinner,
  Field
} from "@decky/ui";
import { FaInfoCircle, FaPlus, FaTrash } from "react-icons/fa";
import { Fragment } from "react/jsx-runtime";
import { InitialSettings, setSetting } from "./customcloud-config";

export interface GamePathSetting {
    path: string,
    type: string
}

interface GamePathFieldProps {
    value: GamePathSetting,
    disabled: boolean
    onChange: (newValue: GamePathSetting) => void,
}

function GamePathField({value, disabled, onChange}: GamePathFieldProps)
{
    return (
    <Fragment>
        <div
        style=
        {{
            display: "grid",
            gridTemplateColumns: "2fr 160px",
            gap: "8px"
        }}>
        <TextField
        value={value.path}
        disabled={disabled}
        onClick={async () => {
            let startingPath = value.path?.replace(/\\/g,"/") || "/home/deck";

            startingPath = await call<[path: string], string>("resolve_path",startingPath)

            let newPath = await openFilePicker(FileSelectionType.FILE,startingPath);

            onChange({...value, path: newPath.path});
        }} />
        <Dropdown
        rgOptions= {[{data: "configsave", label: "Config + Save"},
            {data: "config", label: "Config"},
            {data: "save", label: "Save"}
        ]}
        onChange={(e) => onChange({...value, type: e.data})}
        disabled={disabled}
        selectedOption={value.type}
        >
        </Dropdown>
        </div>
    </Fragment>
    )
}

interface GamePathsProps {
    initialSettings: InitialSettings,
    setInitialSettings: React.Dispatch<React.SetStateAction<InitialSettings>>,
    loadingPaths: boolean,
    setLoadingPaths: React.Dispatch<React.SetStateAction<boolean>>,
    appIsInstalled: boolean
}

export default function GamePaths({initialSettings, setInitialSettings, loadingPaths, setLoadingPaths, appIsInstalled}: GamePathsProps) {
    const gamePaths: GamePathSetting[] = initialSettings["paths"] || [];

    function addPath()
    {
        setGamePaths([...gamePaths, {path: "", type: "configsave"}]);
    }

    function setGamePaths(newPaths: GamePathSetting[])
    {
        setInitialSettings({...initialSettings, "paths": newPaths});

        setSetting("paths", newPaths);
    }

    function deletePath(indexToRemove: number)
    {
        showModal(
            <ConfirmModal
            strTitle="Warning"
            strDescription="Delete this path?"
            bDestructiveWarning={true}
            onOK={() => setGamePaths(gamePaths.filter((_, index) => index != indexToRemove))}
            />
        )
    }

    function showPlaceholderInfo()
    {
        showModal(
            <ConfirmModal
            bAlertDialog={true}
            strTitle="Path placeholders"
            strDescription={<div style = {{
                whiteSpace: "pre-wrap",
                wordWrap: "break-word"
            }}>To ensure config and save data is downloaded to the right places between devices, it is recommended to add placeholders for common roots and other variables.<br /><br />

            <code>&lt;home&gt;</code> - Home directory, e.g. /home/deck<br />
            <code>C:/Users/&lt;osUserName&gt;</code> - A more hardcoded path to a Windows user folder, using your OS profile username or in the case of Proton, "steamuser".<br />
            <code>&lt;winDocuments&gt;</code> - Windows Documents folder. Resolves to your actual Documents folder in Windows, or with Proton, the Documents folder under the prefix<br />
            <code>&lt;winAppData&gt;</code> - AppData path. Usually resolves to <code>C:\Users\(user)\AppData\Roaming</code><br />
            <code>&lt;winDir&gt;</code> - The path of the Windows folder, usually <code>C:\Windows</code><br />
            <code>&lt;winLocalAppData&gt;</code> - Local AppData path. Usually resolves to <code>C:\Users\(user)\AppData\Local</code><br />
            <code>&lt;winPublic&gt;</code> - "Public" Windows user folder resolves to <code>C:\Users\Public</code><br />
            <code>&lt;winProgramData&gt;</code> - Windows ProgramData folder. Normally resolves to <code>C:\ProgramData</code><br />
            <code>&lt;xdgConfig&gt;</code> - Linux user config folder, e.g. <code>/home/deck/.config</code><br />
            <code>&lt;xdgData&gt;</code> - Linux user data folder, e.g. <code>/home/deck/.local/share</code><br />
            <code>&lt;storeUserId&gt;</code> - Your numerical Steam ID. If it is under Steam's "userdata" folder, it will resolve to your shorter steamID3. Otherwise, it will be your 17-digit steamID64<br />
            <code>&lt;base&gt;</code> - The full path where the game itself is installed to. Can not be automatically resolved with non-Steam shortcuts.<br />
            <code>&lt;root&gt;</code> - The path where Steam itself is installed, e.g. /home/deck/.local/share/Steam or C:\Program Files\Steam<br />
            <br />
            On a Windows device, most of these will resolve to your actual paths on Windows. On a SteamOS/Linux device, they will instead resolve to Proton equivalents under a Proton prefix.</div>}
            onOK={() => {}}
            />
        )
    }

    if(loadingPaths) return <SteamSpinner />

    return (
    <DialogBody>
        <DialogControlsSection>
        {gamePaths.map((path, index) => (
        gamePaths.length > 1 ? (
        <div
            style=
            {{
                display: "grid",
                gridTemplateColumns: "1fr 45px",
                gap: "8px"
            }}
        >
        <GamePathField
        value={path}
        disabled={!appIsInstalled}
        onChange={(newPath) => {
                setGamePaths(gamePaths.map((p, i) => (i === index ? newPath : p)));
            }
        } />
        <DialogButton
        onClick={() => deletePath(index)}
        disabled={!appIsInstalled}
        style={{
            width: "45px",
            paddingLeft: "15px",
            paddingRight: "15px",
            minWidth: 0
        }}>
            <FaTrash />
        </DialogButton>
        </div>
        ) : (
        <GamePathField
        value={path}
        disabled={!appIsInstalled}
        onChange={(newPath) => {
                setGamePaths(gamePaths.map((p, i) => (i === index ? newPath : p)));
            }
        } />
        )
        ))}
        <div
        style=
        {{
            display: "grid",
            gridTemplateColumns: "1fr 45px 45px",
            gap: "8px"
        }}>
        <Field label="Cloud game folder">
            <div
            style={{
                minWidth: "var(--gamepad-field-control-min-width, 205px)"
            }}>
            <TextField
                defaultValue={initialSettings["game_folder"]}
                onBlur={(e) => {
                    setSetting("game_folder", e.target.value);
                    setInitialSettings({...initialSettings, "game_folder": e.target.value});
                    }} />
            </div>
        </Field>
        <DialogButton
        onClick={showPlaceholderInfo}
        style={{
            width: "45px",
            paddingLeft: "15px",
            paddingRight: "15px",
            minWidth: 0
        }}>
            <FaInfoCircle />
        </DialogButton>
        <DialogButton
        onClick={addPath}
        disabled={!appIsInstalled}
        style={{
            width: "45px",
            paddingLeft: "15px",
            paddingRight: "15px",
            minWidth: 0
        }}>
            <FaPlus />
        </DialogButton>
        </div>
        </DialogControlsSection>
        <ButtonItem
        label="Reset paths to defaults"
        onClick={() => {
            showModal(
            <ConfirmModal
                strTitle="Warning"
                strDescription="Reset all paths to defaults?"
                bDestructiveWarning={true}
                onOK={async () => {
                    setLoadingPaths(true);
                    call<[], any>("set_default_paths").then((defaultSettings) => {
                        setSetting("paths", defaultSettings.paths);
                        setSetting("game_folder", defaultSettings.folder);
                        setInitialSettings({...initialSettings, "paths": defaultSettings.paths, "game_folder": defaultSettings.folder});
                        setLoadingPaths(false);
                    });
                }}
                />
            )
        }}
        disabled={!appIsInstalled}>
            Reset paths
        </ButtonItem>
    </DialogBody>
    );
}