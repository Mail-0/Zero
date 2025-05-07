import { type TThemeStyles } from '@/lib/theme';

export const DEFAULT_FONT_SANS =
  'Geist, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

export const DEFAULT_FONT_SERIF =
  'Geist, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

export const DEFAULT_FONT_MONO =
  'Geist_Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace';

export const defaultThemes: TThemeStyles = {
  light: {
    background: '0 0% 100%',
    foreground: '240 10% 3.9%',
    card: '0 0% 100%',
    'card-foreground': '240 10% 3.9%',
    popover: '0 0% 100%',
    'popover-foreground': '240 10% 3.9%',
    primary: '240 5.9% 10%',
    'primary-foreground': '0 0% 98%',
    secondary: '240 4.8% 95.9%',
    'secondary-foreground': '240 5.9% 10%',
    muted: '240 4.8% 95.9%',
    'muted-foreground': '240 3.8% 46.1%',
    accent: '240 4.8% 95.9%',
    'accent-foreground': '240 5.9% 10%',
    destructive: '0 84.2% 60.2%',
    'destructive-foreground': '0 0% 98%',
    border: '240 5.9% 90%',
    input: '240 5.9% 90%',
    ring: '240 10% 3.9%',
    'chart-1': '12 76% 61%',
    'chart-2': '173 58% 39%',
    'chart-3': '197 37% 24%',
    'chart-4': '43 74% 66%',
    'chart-5': '27 87% 67%',
    radius: '0.5rem',
    'font-sans': DEFAULT_FONT_SANS,
    'font-serif': DEFAULT_FONT_SERIF,
    'font-mono': DEFAULT_FONT_MONO,
  },
  dark: {
    background: '0 0% 0%',
    foreground: '0 0% 98%',
    card: '240 5.9% 10%',
    'card-foreground': '0 0% 98%',
    popover: '240 3.4% 8%',
    'popover-foreground': '0 0% 99%',
    primary: '0 0% 98%',
    'primary-foreground': '240 5.9% 10%',
    secondary: '240 3.7% 15.9%',
    'secondary-foreground': '0 0% 98%',
    muted: '240 3.7% 15.9%',
    'muted-foreground': '240 5% 64.9%',
    accent: '240 3.7% 15.9%',
    'accent-foreground': '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '0 0% 98%',
    border: '240 3.7% 20%',
    input: '240 3.7% 15.9%',
    ring: '240 4.9% 83.9%',
    'chart-1': '220 70% 50%',
    'chart-2': '160 60% 45%',
    'chart-3': '30 80% 55%',
    'chart-4': '280 65% 60%',
    'chart-5': '340 75% 55%',
  },
};

export const sansSerifFonts = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Poppins',
  'Montserrat',
  'Outfit',
  'Plus Jakarta Sans',
  'DM Sans',
  'Geist',
  'Oxanium',
];

export const serifFonts = [
  'Merriweather',
  'Playfair Display',
  'Lora',
  'Source Serif Pro',
  'Libre Baskerville',
  'Space Grotesk',
];

export const monoFonts = [
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Roboto Mono',
  'Space Mono',
  'Geist Mono',
];

export const sansSerifFontLabelValues = sansSerifFonts.map((font) => ({
  label: font,
  value: `${font}, sans-serif`,
}));

export const serifFontLabelValues = serifFonts.map((font) => ({
  label: font,
  value: `${font}, serif`,
}));

export const monoFontLabelValues = monoFonts.map((font) => ({
  label: font,
  value: `${font}, monospace`,
}));
