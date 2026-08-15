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
  Field,
} from "@decky/ui";
import { FaPlus, FaTrash } from "react-icons/fa";
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
            gridTemplateColumns: "1fr 45px",
            gap: "8px"
        }}>
        <Field label="Cloud game folder">
            <div
            style={{
                minWidth: "var(--gamepad-field-control-min-width, 230px)"
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