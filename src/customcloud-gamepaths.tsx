import { call } from "@decky/api";
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
} from "@decky/ui";
import { FaPlus, FaTrash } from "react-icons/fa";
import { Fragment } from "react/jsx-runtime";

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
            }}
        >
        <TextField
        value={value.path}
        disabled={disabled}
        onChange={(e) => onChange({...value, path: e.target.value})} />
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
    paths: GamePathSetting[],
    setGamePaths: React.Dispatch<React.SetStateAction<GamePathSetting[]>>,
    loadingPaths: boolean,
    setLoadingPaths: React.Dispatch<React.SetStateAction<boolean>>,
    appIsInstalled: boolean
}

export default function GamePaths({paths, setGamePaths, loadingPaths, setLoadingPaths, appIsInstalled}: GamePathsProps) {
    function addPath()
    {
        setGamePaths([...paths, {path: "", type: "configsave"}]);
    }

    function deletePath(indexToRemove: number)
    {
        showModal(
            <ConfirmModal
            strTitle="Warning"
            strDescription="Delete this path?"
            bDestructiveWarning={true}
            onOK={() => setGamePaths(paths.filter((_, index) => index != indexToRemove))}
            />
        )

    }

    if(loadingPaths) return <SteamSpinner />

    return (
    <DialogBody>
        <DialogControlsSection>
        {paths.map((path, index) => (
        paths.length > 1 ? (
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
                setGamePaths((prevPaths) => 
                    prevPaths.map((p, i) => (i === index ? newPath : p))
                );
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
                setGamePaths((prevPaths) => 
                    prevPaths.map((p, i) => (i === index ? newPath : p))
                );
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
            }}
        >
        <div>
        <TextField
        label="Game Folder Name"
        >
        </TextField>
        </div>
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
                    call<[], GamePathSetting[]>("set_default_paths").then((defaultPaths) => {
                        setGamePaths(defaultPaths);
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