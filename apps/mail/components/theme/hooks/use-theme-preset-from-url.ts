import { useQueryState } from "nuqs";
import React from "react";
import { useEditorStore } from "@/store/editor-store";

export const useThemePresetFromUrl = () => {
  const [preset, setPreset] = useQueryState("theme");
  const applyThemePreset = useEditorStore((state) => state.applyThemePreset);

  // Apply theme preset if it exists in URL and remove it
  React.useEffect(() => {
    if (preset) {
      applyThemePreset(preset);
      setPreset(null); // Remove the preset from URL
    }
  }, [preset, setPreset, applyThemePreset]);
};
