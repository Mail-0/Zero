import type { ThemeStyleProps } from "@/types/theme";
import { colorFormatter } from "./color-converter";
import { COMMON_STYLES, defaultThemeState } from "@/config/theme";

export const variableNames = Object.keys(defaultThemeState.styles.light);
const nonColorVariables = COMMON_STYLES;
const VARIABLE_PREFIX = "--";

export const parseCssInput = (input: string) => {
  const lightColors: ThemeStyleProps = {} as ThemeStyleProps;
  const darkColors: ThemeStyleProps = {} as ThemeStyleProps;

  try {
    const rootContent = extractCssBlockContent(input, ":root");
    const darkContent = extractCssBlockContent(input, ".dark");

    if (rootContent) {
      parseColorVariables(rootContent, lightColors, variableNames);
    }
    if (darkContent) {
      parseColorVariables(darkContent, darkColors, variableNames);
    }
  } catch (error) {
    console.error("Error parsing CSS input:", error);
  }

  return { lightColors, darkColors };
};

const extractCssBlockContent = (
  input: string,
  selector: string
): string | null => {
  const regex = new RegExp(`${escapeRegExp(selector)}\\s*{([^}]+)}`);
  return input.match(regex)?.[1]?.trim() || null;
};

const parseColorVariables = (
  cssContent: string,
  target: ThemeStyleProps,
  validNames: string[]
) => {
  const variableDeclarations = cssContent.match(/--[^:]+:\s*[^;]+/g) || [];

  variableDeclarations.forEach((declaration) => {
    const [name, value] = declaration.split(":").map((part) => part.trim());
    const cleanName = name?.replace(VARIABLE_PREFIX, "");

    if (cleanName && validNames.includes(cleanName)) {
      if (nonColorVariables.includes(cleanName)) {
        target[cleanName as keyof ThemeStyleProps] = value || "";
        return;
      }

      const colorValue = processColorValue(value || "");
      const formattedValue = colorFormatter(colorValue, "hex");
      target[cleanName as keyof ThemeStyleProps] = formattedValue;
    }
  });
};

const processColorValue = (value: string): string => {
  return /^\d/.test(value) ? `hsl(${value})` : value;
};

// Helper function to escape regex special characters
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
