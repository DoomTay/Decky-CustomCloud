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

export default function GamePaths({currentAppId, appIsInstalled}: GamePathsProps) {

    function GamePathField()
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

    return (
    <DialogBody>
        <DialogControlsSection>
        <GamePathField />
        </DialogControlsSection>
    </DialogBody>
    );
}