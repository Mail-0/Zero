import { defaultThemeState } from "@/config/theme";
import type { ThemeStyles } from "@/types/theme";
import { useThemePresetStore } from "@/store/theme-preset-store";

export function getPresetThemeStyles(name: string): ThemeStyles {
  const defaultTheme = defaultThemeState.styles;
  if (name === "default") {
    return defaultTheme;
  }

  const store = useThemePresetStore.getState();
  const preset = store.getPreset(name);
  if (!preset) {
    return defaultTheme;
  }

  return {
    light: {
      ...defaultTheme.light,
      ...(preset.styles.light || {}),
    },
    dark: {
      ...defaultTheme.dark,
      ...(preset.styles.light || {}),
      ...(preset.styles.dark || {}),
    },
  };
}
