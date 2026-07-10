import {
  DialogBody,
  DialogControlsSection,
  TextField,
  Dropdown,
} from "@decky/ui";
import { Fragment } from "react/jsx-runtime";

interface GamePathsProps {
    currentAppId: number,
    appIsInstalled: boolean
}

function GamePathField({currentAppId, appIsInstalled}: GamePathsProps)
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
        <TextField value={currentAppId.toString()} disabled={!appIsInstalled} />
        <Dropdown
        rgOptions= {[{data: "configsave", label: "Config + Save"},
            {data: "config", label: "Config"},
            {data: "save", label: "Save"}
        ]}
        selectedOption="configsave"
        disabled={!appIsInstalled}
        >
        </Dropdown>
        </div>
    </Fragment>
    )
}

export default function GamePaths({currentAppId, appIsInstalled}: GamePathsProps) {

    return (
    <DialogBody>
        <DialogControlsSection>
        <GamePathField
        currentAppId={currentAppId}
        appIsInstalled={appIsInstalled} />
        </DialogControlsSection>
    </DialogBody>
    );
}