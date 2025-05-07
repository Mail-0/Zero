import type { ThemeEditorState } from "@/types/theme";


const sansSerifFontNames = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Poppins",
  "Montserrat",
  "Outfit",
  "Plus Jakarta Sans",
  "DM Sans",
  "Geist",
  "Oxanium",
];

const serifFontNames = [
  "Merriweather",
  "Playfair Display",
  "Lora",
  "Source Serif Pro",
  "Libre Baskerville",
  "Space Grotesk",
];

const monoFontNames = [
  "JetBrains Mono",
  "Fira Code",
  "Source Code Pro",
  "IBM Plex Mono",
  "Roboto Mono",
  "Space Mono",
  "Geist Mono",
];

export const fonts: Record<string, string> = {
  // Sans-serif fonts
  Inter: "Inter, sans-serif",
  Roboto: "Roboto, sans-serif",
  "Open Sans": "Open Sans, sans-serif",
  Poppins: "Poppins, sans-serif",
  Montserrat: "Montserrat, sans-serif",
  Outfit: "Outfit, sans-serif",
  "Plus Jakarta Sans": "Plus Jakarta Sans, sans-serif",
  "DM Sans": "DM Sans, sans-serif",
  "IBM Plex Sans": "IBM Plex Sans, sans-serif",
  Geist: "Geist, sans-serif",
  Oxanium: "Oxanium, sans-serif",

  // Serif fonts
  Merriweather: "Merriweather, serif",
  "Playfair Display": "Playfair Display, serif",
  Lora: "Lora, serif",
  "Source Serif Pro": "Source Serif Pro, serif",
  "Libre Baskerville": "Libre Baskerville, serif",
  "Space Grotesk": "Space Grotesk, serif",

  // Monospace fonts
  "JetBrains Mono": "JetBrains Mono, monospace",
  "Fira Code": "Fira Code, monospace",
  "Source Code Pro": "Source Code Pro, monospace",
  "IBM Plex Mono": "IBM Plex Mono, monospace",
  "Roboto Mono": "Roboto Mono, monospace",
  "Space Mono": "Space Mono, monospace",
  "Geist Mono": "Geist Mono, monospace",
};

export const sansSerifFonts = Object.fromEntries(
  Object.entries(fonts).filter(([key]) => sansSerifFontNames.includes(key))
);
export const serifFonts = Object.fromEntries(
  Object.entries(fonts).filter(([key]) => serifFontNames.includes(key))
);
export const monoFonts = Object.fromEntries(
  Object.entries(fonts).filter(([key]) => monoFontNames.includes(key))
);

export const getAppliedThemeFont = (
  state: ThemeEditorState,
  fontKey: "font-sans" | "font-serif" | "font-mono"
): string | null => {
  const fontSans = state.styles.light[fontKey];
  // find key of font in fonts object based on value
  const key = Object.keys(fonts).find((key) => fonts[key]?.includes(fontSans));
  return key ? key : null;
};
