import { addEventListener, call, removeEventListener } from "@decky/api";
import {
    ConfirmModal,
    Dropdown,
    ModalRoot,
    Navigation,
    showModal,
    ShowModalResult,
    SingleDropdownOption,
    TextField,
    ToggleField
} from "@decky/ui";
import { ReactNode, useRef, useState } from "react";

const MODAL_TITLE = "Rclone Config Wizard";

let wizardModalOpen = false;

interface PromptData
{
    "Error": string,
    "error": string,
    "State": string,
    "Result": string,
    "Option": any
}

interface RcloneExample
{
    "Value": string,
    "Help": string
}

export default async function startConfigWizard()
{
    let selectedRemote = "";
    let lastState = "";
    let allPrompts = false;

    function renderPrompt(promptData: PromptData)
    {
        // Apparently lowercase e error is a fatal situation, meanwhile capital E error allows for trying again
        let fatalError = promptData["error"];

        console.log("Output:",promptData);
        if(fatalError != undefined) return alertModal(fatalError,"Warning",true);

        let errorMessage = promptData["Error"];

        if(errorMessage != "") return alertModal(errorMessage,"Warning",false,promptData["State"],promptData["Result"]);

        let modal;

        let optionData = promptData["Option"];

        if(promptData["State"] == "") return alertModal("Configuration complete",MODAL_TITLE,true);

        let examples = optionData["Examples"];

        switch(optionData["Type"])
        {
        case "bool":
            let yesOption = examples?.find((option: RcloneExample) => option["Value"] == "true") || {"Value": "true", "Help": "Yes"};
            let noOption = examples?.find((option: RcloneExample) => option["Value"] == "false") || {"Value": "false", "Help": "No"};

            modal = (<ConfirmModal
            strTitle={MODAL_TITLE}
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
                nextStep(promptData["State"],yesOption["Value"]);
            }}
            onCancel={async () => {
                nextStep(promptData["State"],noOption["Value"]);
            }}
            />)
            break;
        case "string":
        case "int":
            modal = <WizardStringSelect
                    optionData={optionData}
                    onOK={async (result) => {
                        nextStep(promptData["State"],result);
                    }}
                    onCancel={async () => {
                        wizardModal.Update(alertModal("Configuration has been cancelled.",MODAL_TITLE,true));
                    }}
                    />
            break;
        case "web":
            modal = null;

            Navigation.NavigateToExternalWeb(optionData["Value"]);
            break;
        default:
            console.error("Unknown response type:",promptData)
            modal = alertModal("Unknown response type " + optionData["Type"] + ". Unable to continue","Warning", true)
            break;
        }

        return modal;
    }

    const loadingModal = (
        <ModalRoot
        bOKDisabled={true}
        bCancelDisabled={true}
        onCancel={() => {}}>
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
            wizardModal.Close()

            if(finalEvent) removeEventListener('config_event', handlePrompt);
            else if(state) nextStep(state,result);
        }}
        onCancel={() => {}}
        />
    }

    function openWizardModal(modal: ReactNode)
    {
        let wizardModal = showModal(modal);
        wizardModal.ClosedPromise.then(() => wizardModalOpen = false)

        wizardModalOpen = true;

        return wizardModal;
    }

    let wizardModal: ShowModalResult;

    function handlePrompt(promptData: any)
    {
        if(promptData["State"] == "" && lastState == "")
        {
            allPrompts = true;
            return nextStep();
        }
        let promptModal = renderPrompt(promptData);
        if(promptModal)
        {
            lastState = promptData["State"];
            if(wizardModalOpen == true) wizardModal.Update(promptModal);
            else wizardModal = openWizardModal(promptModal);
        }
        else wizardModal.Close();
    }

    if(wizardModalOpen == false)
    {
        wizardModal = openWizardModal(loadingModal);

        let backendOptions = (await call<[], any>("rclone_get_backends")).sort((a: any,b: any) => (a["Description"] + " (" + a["Name"] + ")").localeCompare(b["Description"] + " (" + b["Name"] + ")")).map((option: any) => ({data: option["Name"], label: option["Description"] + " (" + option["Name"] + ")"}));

        let backendSelectionModal = <ConfirmModal
        strTitle={MODAL_TITLE}
        strDescription="Please select a backend"
        onOK={() => {
            addEventListener('config_event', handlePrompt);

            nextStep();
        }}
        onCancel={() => {
            wizardModal.Close();
        }}
        >
        <Dropdown
        rgOptions={backendOptions}
        selectedOption={backendOptions[0].data}
        onChange={(option) => selectedRemote = option.data}
        >
        </Dropdown>
        </ConfirmModal>

        wizardModal.Update(backendSelectionModal);
    }

    function nextStep(state?: string, result?: string)
    {
        wizardModal.Update(loadingModal);
        call<[remote: string, state?: string, result?: string, allPrompts?: boolean], any>("rclone_config",selectedRemote,state,result,allPrompts);
    }

}

interface WizardStringSelectProps {
    optionData: any,
    onOK: (result: string) => void,
    onCancel: () => void
}

function WizardStringSelect({optionData, onOK, onCancel}: WizardStringSelectProps) {
    const examples = optionData["Examples"];
    const hasExamples = Boolean(examples?.length)
    const [customInputEnabled, setCustomInputEnabled] = useState<boolean>(!hasExamples);
    const wizardTextPrompt = useRef<string>(optionData["DefaultStr"]);

    const dropdownOptions: SingleDropdownOption[] = examples?.map((option: RcloneExample) => ({data: option["Value"], label: option["Help"]}));

    return (
        <ConfirmModal
        strTitle={MODAL_TITLE}
        strDescription={
            <div style = {{
                whiteSpace: "pre-wrap",
                wordWrap: "break-word"
            }}>
            {optionData["Help"]}
            </div>
        }
        onOK={() => onOK(wizardTextPrompt.current)}
        onCancel={onCancel}
        >
        {customInputEnabled == true ? (
        <TextField 
            defaultValue={wizardTextPrompt.current}
            bIsPassword={optionData["IsPassword"]}
            mustBeNumeric={optionData["Type"] == "int"}
            onBlur={(e) => {wizardTextPrompt.current = e.target.value}}
        />) : (
            <Dropdown
            rgOptions={dropdownOptions}
            selectedOption={optionData["DefaultStr"]}
            onChange={(option) => wizardTextPrompt.current = option.data}
            >
            </Dropdown>
        )}
        {(hasExamples == true && optionData["Exclusive"] == false) && <ToggleField
        label="Enable custom input"
        checked={customInputEnabled}
        onChange={(checked) => {
            setCustomInputEnabled(checked);

            if(checked) wizardTextPrompt.current = optionData["DefaultStr"];
        }}
        />}
        </ConfirmModal>
    )
}