import {
  defaultDarkThemeStyles,
  defaultLightThemeStyles,
} from "@/config/theme";
import type { ThemeStyleProps, ThemeStyles } from "@/types/theme";
import { colorFormatter } from "@/components/theme/utils/color-converter";
import { getShadowMap } from "@/components/theme/utils/shadows";
import { getPresetThemeStyles } from "@/components/theme/utils/theme-preset-helper";

// Convert HSL color to the format expected by shadcn registry
const convertToRegistryColor = (color: string): string => {
  return colorFormatter(color, "oklch");
};

// Helper to get a value from either dark or light theme
const getThemeValue = (
  dark: ThemeStyleProps,
  light: ThemeStyleProps,
  key: keyof ThemeStyleProps
): string => {
  return dark[key] || light[key] || "";
};

// Convert theme styles to registry format
const convertThemeStyles = (styles: ThemeStyles) => {
  const { light, dark } = styles;

  const convertTheme = (theme: ThemeStyleProps): ThemeStyleProps => {
    const result: ThemeStyleProps = theme;
    const convertColor = (color?: string) =>
      convertToRegistryColor(color || "");

    // Convert all color values
    result.background = convertColor(theme.background);
    result.foreground = convertColor(theme.foreground);
    result.card = convertColor(theme.card);
    result["card-foreground"] = convertColor(theme["card-foreground"]);
    result.popover = convertColor(theme.popover);
    result["popover-foreground"] = convertColor(theme["popover-foreground"]);
    result.primary = convertColor(theme.primary);
    result["primary-foreground"] = convertColor(theme["primary-foreground"]);
    result.secondary = convertColor(theme.secondary);
    result["secondary-foreground"] = convertColor(
      theme["secondary-foreground"]
    );
    result.muted = convertColor(theme.muted);
    result["muted-foreground"] = convertColor(theme["muted-foreground"]);
    result.accent = convertColor(theme.accent);
    result["accent-foreground"] = convertColor(theme["accent-foreground"]);
    result.destructive = convertColor(theme.destructive);
    result["destructive-foreground"] = convertColor(
      theme["destructive-foreground"]
    );
    result.border = convertColor(theme.border);
    result.input = convertColor(theme.input);
    result.ring = convertColor(theme.ring);
    result["chart-1"] = convertColor(theme["chart-1"]);
    result["chart-2"] = convertColor(theme["chart-2"]);
    result["chart-3"] = convertColor(theme["chart-3"]);
    result["chart-4"] = convertColor(theme["chart-4"]);
    result["chart-5"] = convertColor(theme["chart-5"]);
    result.sidebar = convertColor(theme.sidebar);
    result["sidebar-foreground"] = convertColor(theme["sidebar-foreground"]);
    result["sidebar-primary"] = convertColor(theme["sidebar-primary"]);
    result["sidebar-primary-foreground"] = convertColor(
      theme["sidebar-primary-foreground"]
    );
    result["sidebar-accent"] = convertColor(theme["sidebar-accent"]);
    result["sidebar-accent-foreground"] = convertColor(
      theme["sidebar-accent-foreground"]
    );
    result["sidebar-border"] = convertColor(theme["sidebar-border"]);
    result["sidebar-ring"] = convertColor(theme["sidebar-ring"]);

    return result;
  };

  return {
    light: { ...defaultLightThemeStyles, ...convertTheme(light) },
    dark: { ...defaultDarkThemeStyles, ...convertTheme(dark) },
  };
};

// This method will do the same as "generateThemeRegistry" from `scripts/generate-theme-registry.ts`
export const generateThemeRegistryFromPreset = (name: string) => {
  const styles = getPresetThemeStyles(name);
  const registryItem = generateThemeRegistryItemFromStyles(name, styles);
  return registryItem;
};

export const generateThemeRegistryItemFromStyles = (
  name: string,
  themeStyles: ThemeStyles
) => {
  const { light, dark } = convertThemeStyles(themeStyles);

  // Generate shadow variables for both light and dark modes
  const lightShadows = getShadowMap({
    styles: { light, dark },
    currentMode: "light",
  });
  const darkShadows = getShadowMap({
    styles: { light, dark },
    currentMode: "dark",
  });

  const registryItem = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name,
    type: "registry:style",
    css: {
      "@layer base": {
        body: {
          "letter-spacing": "var(--tracking-normal)",
        },
      },
    },
    cssVars: {
      theme: {
        "font-sans":
          getThemeValue(dark, light, "font-sans") || "Inter, sans-serif",
        "font-mono": getThemeValue(dark, light, "font-mono") || "monospace",
        "font-serif": getThemeValue(dark, light, "font-serif") || "serif",
        radius: getThemeValue(dark, light, "radius") || "0.5rem",
        "tracking-tighter": "calc(var(--tracking-normal) - 0.05em)",
        "tracking-tight": "calc(var(--tracking-normal) - 0.025em)",
        "tracking-wide": "calc(var(--tracking-normal) + 0.025em)",
        "tracking-wider": "calc(var(--tracking-normal) + 0.05em)",
        "tracking-widest": "calc(var(--tracking-normal) + 0.1em)",
      },
      light: {
        ...light,
        "shadow-2xs": lightShadows["shadow-2xs"],
        "shadow-xs": lightShadows["shadow-xs"],
        "shadow-sm": lightShadows["shadow-sm"],
        shadow: lightShadows["shadow"],
        "shadow-md": lightShadows["shadow-md"],
        "shadow-lg": lightShadows["shadow-lg"],
        "shadow-xl": lightShadows["shadow-xl"],
        "shadow-2xl": lightShadows["shadow-2xl"],
        "tracking-normal":
          getThemeValue(dark, light, "letter-spacing") || "0em",
        spacing: getThemeValue(dark, light, "spacing") || "0.25rem",
      },
      dark: {
        ...dark,
        "shadow-2xs": darkShadows["shadow-2xs"],
        "shadow-xs": darkShadows["shadow-xs"],
        "shadow-sm": darkShadows["shadow-sm"],
        shadow: darkShadows["shadow"],
        "shadow-md": darkShadows["shadow-md"],
        "shadow-lg": darkShadows["shadow-lg"],
        "shadow-xl": darkShadows["shadow-xl"],
        "shadow-2xl": darkShadows["shadow-2xl"],
      },
    },
  };

  return registryItem;
};
