import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { useThemeActions } from "@/components/theme/hooks/use-theme-actions";
import { useEditorStore } from "@/store/editor-store";
import type { Theme } from "@/types/theme";
import { ThemeSaveDialog } from "./theme-save-dialog";
import { useState } from "react";

interface ThemeEditActionsProps {
  theme: Theme;
}

const ThemeEditActions: React.FC<ThemeEditActionsProps> = ({ theme }) => {
  const router = useRouter();
  const { themeState, applyThemePreset } = useEditorStore();
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleThemeEditCancel = () => {
    router.push("/editor/theme");
    applyThemePreset(themeState?.preset || "default");
  };

  const handleSaveTheme = async (newName: string) => {
    setIsSaving(true);
    const dataToUpdate: {
      id: string;
      name?: string;
      styles?: Theme["styles"];
    } = {
      id: theme.id,
    };

    if (newName !== theme.name) {
      dataToUpdate.name = newName;
    } else {
      dataToUpdate.name = theme.name;
    }

    if (themeState.styles) {
      dataToUpdate.styles = themeState.styles;
    }

    if (!dataToUpdate.name && !dataToUpdate.styles) {
      setIsNameDialogOpen(false);
      setIsSaving(false);
      return;
    }
// TODO: SAVE HERE
    // const result = await updateTheme(dataToUpdate);
    // setIsSaving(false);

    // if (result) {
    //   setIsNameDialogOpen(false);
    //   router.push("/editor/theme");
    //   applyThemePreset(result?.id || themeState?.preset || "default");
    // } else {
    //   console.error("Failed to update theme");
    // }
  };

  const handleThemeEditSave = () => {
    setIsNameDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center bg-card/80 text-card-foreground">
        <div className="flex flex-1 items-center gap-2 min-h-14 px-4">
          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-card-foreground/60">
              Editing
            </span>
          </div>
          <span className="text-sm font-semibold px-2 truncate max-w-56">
            {theme.name}
          </span>
        </div>

        <Separator orientation="vertical" className="h-8 bg-border" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-14 shrink-0 rounded-none"
                onClick={handleThemeEditCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancel changes</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-8 bg-border" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-14 shrink-0 rounded-none"
                onClick={handleThemeEditSave}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save changes</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <ThemeSaveDialog
        open={isNameDialogOpen}
        onOpenChange={setIsNameDialogOpen}
        onSave={handleSaveTheme}
        isSaving={isSaving}
        initialThemeName={theme.name}
        title="Save Theme Changes"
        description="Confirm or update the theme name before saving."
        ctaLabel="Save Changes"
      />
    </>
  );
};

export default ThemeEditActions;
