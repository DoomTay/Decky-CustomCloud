import {
  DialogBody,
  DialogControlsSectionHeader,
  DialogControlsSection,
} from "@decky/ui";

export default function GamePaths() {
    return (
    <DialogBody>
        <DialogControlsSection>
        <DialogControlsSectionHeader>Config Paths</DialogControlsSectionHeader>
        File pickers would go here
        </DialogControlsSection>
        <DialogControlsSection>
        <DialogControlsSectionHeader>Save Paths</DialogControlsSectionHeader>
        File pickers would go here
        </DialogControlsSection>
    </DialogBody>
    );
}