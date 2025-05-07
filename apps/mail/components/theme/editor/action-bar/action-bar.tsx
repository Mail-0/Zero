"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { parseCssInput } from "@/components/theme/utils/parse-css-input";

import { ThemeSaveDialog } from "@/components/theme/editor/theme-save-dialog";
import { authClient } from "@/lib/auth-client";
import { useThemeActions } from "@/components/theme/hooks/use-theme-actions";
import { usePostHog } from "posthog-js/react";
import { useThemePresetStore } from "@/store/theme-preset-store";
import { toast } from "sonner";

export function ActionBar() {
  const {
    themeState,
    setThemeState,
    applyThemePreset,
    hasThemeChangedFromCheckpoint,
  } = useEditorStore();
  const [cssImportOpen, setCssImportOpen] = useState(false);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shareAfterSave, setShareAfterSave] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const { data: session } = authClient.useSession();

  const { createTheme, isCreatingTheme } = useThemeActions();
  const posthog = usePostHog();
  
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const { getPreset } = useThemePresetStore();

  const handleCssImport = (css: string) => {
    const { lightColors, darkColors } = parseCssInput(css);
    const styles = {
      ...themeState.styles,
      light: { ...themeState.styles.light, ...lightColors },
      dark: { ...themeState.styles.dark, ...darkColors },
    };

    setThemeState({
      ...themeState,
      styles,
    });

    toast("CSS imported", {
      description: "Your custom CSS has been imported successfully",
    });
  };

  const handleSaveClick = (options?: { shareAfterSave?: boolean }) => {
    setSaveDialogOpen(true);
    if (options?.shareAfterSave) {
      setShareAfterSave(true);
    }
  };

  const saveTheme = async (themeName: string) => {
    const themeData = {
      name: themeName,
      styles: themeState.styles,
    };

    try {
      const theme = await createTheme(themeData);
      posthog.capture("CREATE_THEME", {
        theme_id: theme?.id,
        theme_name: theme?.name,
      });
      if (!theme) return;
      applyThemePreset(theme?.id || themeState.preset || "default");
      if (shareAfterSave) {
        handleShareClick(theme?.id);
        setShareAfterSave(false);
      }
      setTimeout(() => {
        setSaveDialogOpen(false);
      }, 50);
    } catch (error) {
      console.error(
        "Save operation failed (error likely handled by hook):",
        error
      );
    }
  };

  const handleShareClick = async (id?: string) => {
    if (hasThemeChangedFromCheckpoint()) {
      handleSaveClick({ shareAfterSave: true });
      return;
    }

    const presetId = id ?? themeState.preset;
    const currentPreset = presetId ? getPreset(presetId) : undefined;

    if (!currentPreset) {
      setShareUrl(`https://tweakcn.com/editor/theme`);
      setShareDialogOpen(true);
      return;
    }

    const isSavedPreset = !!currentPreset && currentPreset.source === "SAVED";

    posthog.capture("SHARE_THEME", {
      theme_id: id,
      theme_name: currentPreset?.label,
      is_saved: isSavedPreset,
    });

    const url = isSavedPreset
      ? `https://tweakcn.com/themes/${id}`
      : `https://tweakcn.com/editor/theme?theme=${id}`;

    setShareUrl(url);
    setShareDialogOpen(true);
  };

  return (
    <div className="border-b">
      <div className="flex h-14 items-center justify-end gap-4 px-4">
  
      </div>

      <ThemeSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={saveTheme}
        isSaving={isCreatingTheme}
      />
    </div>
  );
}
