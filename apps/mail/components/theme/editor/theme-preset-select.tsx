import React, { useCallback, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ThemePreset } from "@/types/theme";
import { useEditorStore } from "@/store/editor-store";
import { getPresetThemeStyles } from "@/components/theme/utils/theme-preset-helper";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Moon,
  Search,
  Shuffle,
  Sun,
  Heart,
} from "lucide-react";
import { useTheme } from "@/providers/theme-providers";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ThemePresetSelectProps {
  presets: Record<string, ThemePreset>;
  currentPreset: string | null;
  onPresetChange: (preset: string) => void;
}

interface ColorBoxProps {
  color: string;
}

const ColorBox: React.FC<ColorBoxProps> = ({ color }) => (
  <div
    className="h-3 w-3 rounded-sm border border-muted"
    style={{ backgroundColor: color }}
  />
);

interface ThemeColorsProps {
  presetName: string;
  mode: "light" | "dark";
}

const ThemeColors: React.FC<ThemeColorsProps> = ({ presetName, mode }) => {
  const styles = getPresetThemeStyles(presetName)[mode];
  return (
    <div className="flex gap-0.5">
      <ColorBox color={styles.primary} />
      <ColorBox color={styles.accent} />
      <ColorBox color={styles.secondary} />
      <ColorBox color={styles.border} />
    </div>
  );
};

const isThemeNew = (preset: ThemePreset) => {
  if (!preset.createdAt) return false;
  const createdAt = new Date(preset.createdAt);
  const timePeriod = new Date();
  timePeriod.setDate(timePeriod.getDate() - 5);
  return createdAt > timePeriod;
};

interface ThemeControlsProps {
  onRandomize: () => void;
  onThemeToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  theme: string;
}

const ThemeControls: React.FC<ThemeControlsProps> = ({
  onRandomize,
  onThemeToggle,
  theme,
}) => (
  <div className="flex gap-1">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onThemeToggle}
        >
          {theme === "light" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">Toggle theme</p>
      </TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onRandomize}
        >
          <Shuffle className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">Random theme</p>
      </TooltipContent>
    </Tooltip>
  </div>
);

interface ThemeCycleButtonProps {
  direction: "prev" | "next";
  onClick: () => void;
}

const ThemeCycleButton: React.FC<ThemeCycleButtonProps> = ({
  direction,
  onClick,
}) => (
  <>
    <Separator orientation="vertical" className="h-8" />
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-14 shrink-0 rounded-none bg-muted/10"
          onClick={onClick}
        >
          {direction === "prev" ? (
            <ArrowLeft className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {direction === "prev" ? "Previous theme" : "Next theme"}
      </TooltipContent>
    </Tooltip>
  </>
);

const ThemePresetSelect: React.FC<ThemePresetSelectProps> = ({
  presets,
  currentPreset,
  onPresetChange,
}) => {
  const { themeState, hasUnsavedChanges } = useEditorStore();
  const { theme, toggleTheme } = useTheme();
  const mode = themeState.currentMode;
  const [search, setSearch] = useState("");

  const isSavedTheme = useCallback(
    (presetId: string) => {
      return presets[presetId]?.source === "SAVED";
    },
    [presets]
  );

  const presetNames = useMemo(
    () => ["default", ...Object.keys(presets)],
    [presets]
  );
  const value = presetNames?.find((name) => name === currentPreset);

  const filteredPresets = useMemo(() => {
    const filteredList =
      search.trim() === ""
        ? presetNames
        : Object.entries(presets)
            .filter(([_, preset]) =>
              preset.label?.toLowerCase().includes(search.toLowerCase())
            )
            .map(([name]) => name);

    // Separate saved and default themes
    const savedThemesList = filteredList.filter(
      (name) => name !== "default" && isSavedTheme(name)
    );
    const defaultThemesList = filteredList.filter(
      (name) => !savedThemesList.includes(name)
    );

    // Sort each list
    const sortThemes = (list: string[]) =>
      list.sort((a, b) => {
        const labelA = presets[a]?.label || a;
        const labelB = presets[b]?.label || b;
        return labelA.localeCompare(labelB);
      });

    // Combine saved themes first, then default themes
    return [...sortThemes(savedThemesList), ...sortThemes(defaultThemesList)];
  }, [presetNames, search, presets, isSavedTheme]);

  const currentIndex =
    useMemo(
      () => filteredPresets.indexOf(value || "default"),
      [filteredPresets, value]
    ) ?? 0;

  const randomize = useCallback(() => {
    const random = Math.floor(Math.random() * filteredPresets.length);
    if (filteredPresets[random]) {
      onPresetChange(filteredPresets[random]);
    }
  }, [onPresetChange, filteredPresets]);

  const cycleTheme = useCallback(
    (direction: "prev" | "next") => {
      const newIndex =
        direction === "next"
          ? (currentIndex + 1) % filteredPresets.length
          : (currentIndex - 1 + filteredPresets.length) %
            filteredPresets.length;
      if (filteredPresets[newIndex]) {
        onPresetChange(filteredPresets[newIndex]);
      }
    },
    [currentIndex, filteredPresets, onPresetChange]
  );

  const handleThemeToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const { clientX: x, clientY: y } = event;
    toggleTheme({ x, y });
  };

  const filteredSavedThemes = useMemo(() => {
    return filteredPresets.filter(
      (name) => name !== "default" && isSavedTheme(name)
    );
  }, [filteredPresets, isSavedTheme]);

  const filteredDefaultThemes = useMemo(() => {
    return filteredPresets.filter(
      (name) => name === "default" || !isSavedTheme(name)
    );
  }, [filteredPresets, isSavedTheme]);

  return (
    <div className="flex items-center">
      <TooltipProvider>
        <Popover>
          <PopoverTrigger className="bg-muted/10" asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full md:min-w-56 min-h-14 rounded-none justify-between group relative"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  <ColorBox color={themeState.styles[mode].primary} />
                  <ColorBox color={themeState.styles[mode].accent} />
                  <ColorBox color={themeState.styles[mode].secondary} />
                  <ColorBox color={themeState.styles[mode].border} />
                </div>
                {value !== "default" &&
                  value &&
                  isSavedTheme(value) &&
                  !hasUnsavedChanges() && (
                    <div className="rounded-full bg-muted p-1">
                      <Heart
                        className="size-1"
                        stroke="var(--muted)"
                        fill="var(--muted-foreground)"
                      />
                    </div>
                  )}
                <span className="capitalize font-medium">
                  {hasUnsavedChanges() ? (
                    <>Custom (Unsaved)</>
                  ) : (
                    presets[value || "default"]?.label || "default"
                  )}
                </span>
              </div>
              <ChevronDown className="size-4 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px] ml-4 z-50" align="center">
            <Command className="rounded-lg border shadow-md w-full">
              <div className="flex items-center w-full">
                <div className="flex items-center w-full border-b px-3 py-1">
                  <Search className="size-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search themes..."
                    className="shadow-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2">
                <div className="text-xs text-muted-foreground">
                  {filteredPresets.length} theme
                  {filteredPresets.length !== 1 ? "s" : ""}
                </div>
                <ThemeControls
                  onRandomize={randomize}
                  onThemeToggle={handleThemeToggle}
                  theme={theme}
                />
              </div>
              <Separator />
              <ScrollArea className="h-[500px] max-h-[70vh]">
                <CommandEmpty>No themes found.</CommandEmpty>

                {/* Saved Themes Group */}
                {/* {filteredSavedThemes.length > 0 && (
                  <>
                    <CommandGroup heading="Saved Themes">
                      {filteredSavedThemes
                        .filter(
                          (name) => name !== "default" && isSavedTheme(name)
                        )
                        .map((presetName, index) => (
                          <>
                            <CommandItem
                              key={`${presetName}-${index}`}
                              value={`${presetName}-${index}`}
                              onSelect={() => {
                                onPresetChange(presetName);
                                setSearch("");
                              }}
                              className="flex items-center gap-2 py-2 data-[highlighted]:bg-secondary/50"
                            >
                              <ThemeColors
                                presetName={presetName}
                                mode={mode}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <span className="capitalize text-sm font-medium">
                                  {presets[presetName]?.label || presetName}
                                </span>
                                {presets[presetName] &&
                                  isThemeNew(presets[presetName]) && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs rounded-full"
                                    >
                                      New
                                    </Badge>
                                  )}
                              </div>
                              {presetName === value && (
                                <Check className="h-4 w-4 shrink-0 opacity-70" />
                              )}
                            </CommandItem>
                          </>
                        ))}
                    </CommandGroup>
                    <Separator className="my-2" />
                  </>
                )} */}

                {/* {filteredSavedThemes.length === 0 && search.trim() === "" && (
                  <>
                    <div className="pt-2 px-2 text-xs text-muted-foreground flex items-center gap-1.5">
                      <div className="flex items-center gap-1 px-2 py-1 border rounded-md">
                        <Heart className="size-3" />
                        <span>Save</span>
                      </div>
                      <span>a theme to find it here.</span>
                    </div>
                    <Separator className="my-2" />
                  </>
                )} */}

                {/* Default Theme Group */}
                {/* {filteredDefaultThemes.length > 0 && (
                  <CommandGroup heading="Built-in Themes">
                    {filteredDefaultThemes.map((presetName, index) => (
                      <CommandItem
                        key={`${presetName}-${index}`}
                        value={`${presetName}-${index}`}
                        onSelect={() => {
                          onPresetChange(presetName);
                          setSearch("");
                        }}
                        className="flex items-center gap-2 py-2 data-[highlighted]:bg-secondary/50"
                      >
                        <ThemeColors presetName={presetName} mode={mode} />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="capitalize text-sm font-medium">
                            {presets[presetName]?.label || presetName}
                          </span>
                          {presets[presetName] &&
                            isThemeNew(presets[presetName]) && (
                              <Badge
                                variant="secondary"
                                className="text-xs rounded-full"
                              >
                                New
                              </Badge>
                            )}
                        </div>
                        {presetName === value && (
                          <Check className="h-4 w-4 shrink-0 opacity-70" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )} */}
              </ScrollArea>
            </Command>
          </PopoverContent>
        </Popover>
      </TooltipProvider>

      <ThemeCycleButton direction="prev" onClick={() => cycleTheme("prev")} />
      <ThemeCycleButton direction="next" onClick={() => cycleTheme("next")} />
    </div>
  );
};

export default ThemePresetSelect;
