import type { ThemeEditorState } from "@zero/mail/types/theme";

// these are common between light and dark modes
// we can assume that light mode's value will be used for dark mode as well
export const COMMON_STYLES = [
  "font-sans",
  "font-serif",
  "font-mono",
  "radius",
  "shadow-opacity",
  "shadow-blur",
  "shadow-spread",
  "shadow-offset-x",
  "shadow-offset-y",
  "letter-spacing",
  "spacing",
];

export const DEFAULT_FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

export const DEFAULT_FONT_SERIF =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

export const DEFAULT_FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

// Default light theme styles
export const defaultLightThemeStyles = {
  background: "hsl(0 0% 100%)",
  foreground: "hsl(240 10% 3.9%)",
  card: "hsl(0 0% 100%)",
  "card-foreground": "hsl(240 10% 3.9%)",
  popover: "hsl(0 0% 100%)",
  "popover-foreground": "hsl(240 10% 3.9%)",
  primary: "hsl(240 5.9% 10%)",
  "primary-foreground": "hsl(0 0% 98%)",
  secondary: "hsl(240 4.8% 95.9%)",
  "secondary-foreground": "hsl(240 5.9% 10%)",
  muted: "hsl(240 4.8% 95.9%)",
  "muted-foreground": "hsl(240 3.8% 46.1%)",
  accent: "hsl(240 4.8% 95.9%)",
  "accent-foreground": "hsl(240 5.9% 10%)",
  destructive: "hsl(0 84.2% 60.2%)",
  "destructive-foreground": "hsl(0 0% 98%)",
  border: "hsl(240 5.9% 90%)",
  input: "hsl(240 5.9% 90%)",
  ring: "hsl(240 10% 3.9%)",
  "chart-1": "hsl(12 76% 61%)",
  "chart-2": "hsl(173 58% 39%)",
  "chart-3": "hsl(197 37% 24%)",
  "chart-4": "hsl(43 74% 66%)",
  "chart-5": "hsl(27 87% 67%)",
  radius: "0.5rem",
  sidebar: "hsl(0 0% 98%)",
  "sidebar-foreground": "hsl(240 5.3% 26.1%)",
  "sidebar-primary": "hsl(240 5.9% 10%)",
  "sidebar-primary-foreground": "hsl(0 0% 98%)",
  "sidebar-accent": "hsl(240 4.8% 95.9%)",
  "sidebar-accent-foreground": "hsl(240 5.9% 10%)",
  "sidebar-border": "hsl(220 13% 91%)",
  "sidebar-ring": "hsl(217.2 91.2% 59.8%)",
  "font-sans": DEFAULT_FONT_SANS,
  "font-serif": DEFAULT_FONT_SERIF,
  "font-mono": DEFAULT_FONT_MONO,

  "shadow-color": "hsl(0 0% 0%)",
  "shadow-opacity": "0.1",
  "shadow-blur": "3px",
  "shadow-spread": "0px",
  "shadow-offset-x": "0",
  "shadow-offset-y": "1px",

  "letter-spacing": "0em",
  spacing: "0.25rem",
};

// Default dark theme styles
export const defaultDarkThemeStyles = {
  ...defaultLightThemeStyles,
  background: "hsl(240 10% 3.9%)",
  foreground: "hsl(0 0% 98%)",
  card: "hsl(240 5.9% 10%)",
  "card-foreground": "hsl(0 0% 98%)",
  popover: "hsl(240 3.4% 8%)",
  "popover-foreground": "hsl(0 0% 99%)",
  primary: "hsl(0 0% 98%)",
  "primary-foreground": "hsl(240 5.9% 10%)",
  secondary: "hsl(240 3.7% 15.9%)",
  "secondary-foreground": "hsl(0 0% 98%)",
  muted: "hsl(240 3.7% 15.9%)",
  "muted-foreground": "hsl(240 5% 64.9%)",
  accent: "hsl(240 3.7% 15.9%)",
  "accent-foreground": "hsl(0 0% 98%)",
  destructive: "hsl(0 62.8% 30.6%)",
  "destructive-foreground": "hsl(0 0% 98%)",
  border: "hsl(240 3.7% 20%)",
  input: "hsl(240 3.7% 15.9%)",
  ring: "hsl(240 4.9% 83.9%)",
  "chart-1": "hsl(220 70% 50%)",
  "chart-2": "hsl(160 60% 45%)",
  "chart-3": "hsl(30 80% 55%)",
  "chart-4": "hsl(280 65% 60%)",
  "chart-5": "hsl(340 75% 55%)",
  radius: "0.5rem",
  sidebar: "hsl(240 3.9% 7%)",
  "sidebar-foreground": "hsl(240 4.8% 96.9%)",
  "sidebar-primary": "hsl(224.3 76.3% 48%)",
  "sidebar-primary-foreground": "hsl(0 0% 100%)",
  "sidebar-accent": "hsl(240 3.7% 15.9%)",
  "sidebar-accent-foreground": "hsl(240 4.8% 95.9%)",
  "sidebar-border": "hsl(240 3.7% 15.9%)",
  "sidebar-ring": "hsl(217.2 91.2% 59.8%)",

  "shadow-color": "hsl(0 0% 0%)",

  "letter-spacing": "0em",
  spacing: "0.25rem",
};

// Default theme state
export const defaultThemeState: ThemeEditorState = {
  styles: {
    light: defaultLightThemeStyles,
    dark: defaultDarkThemeStyles,
  },
  currentMode:
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
};