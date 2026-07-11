import {
  DialogBody,
  DialogControlsSection,
  TextField,
  Dropdown,
} from "@decky/ui";
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
                gridTemplateColumns: "2fr 200px",
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
    appIsInstalled: boolean
}

export default function GamePaths({paths, setGamePaths, appIsInstalled}: GamePathsProps) {

    return (
    <DialogBody>
        <DialogControlsSection>
        {paths.map((path) => (
        <GamePathField
        value={path}
        disabled={!appIsInstalled}
        onChange={(newPath) => {
                setGamePaths([newPath])
            }
        } />
        ))}
        </DialogControlsSection>
    </DialogBody>
    );
}