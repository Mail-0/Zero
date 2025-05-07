import {
  DEFAULT_FONT_SANS,
  DEFAULT_FONT_SERIF,
  DEFAULT_FONT_MONO,
} from '@/components/theme/default-themes';
import type { TStyleSchema, TThemeMode, TThemeStyles } from '../theme';
const fontStyles = ['font-sans', 'font-serif', 'font-mono'];

export const COMMON_STYLES = ['radius', ...fontStyles];

export function applyStylesToElement(element: HTMLElement, styles: Record<string, string>) {
  for (const [key, value] of Object.entries(styles)) {
    element.style.setProperty(`--${key}`, value);
  }
}

const getCommonStyles = (themeStyles: Partial<TStyleSchema>) => {
  return Object.fromEntries(
    Object.entries(themeStyles).filter(([key]) => COMMON_STYLES.includes(key)),
  );
};

const getColorStyles = (themeStyles: Partial<TStyleSchema>) => {
  return Object.fromEntries(
    Object.entries(themeStyles).filter(([key]) => !COMMON_STYLES.includes(key)),
  );
};

const getFontStyles = (themeStyles: Partial<TStyleSchema>) => {
  return Object.fromEntries(
    Object.entries(themeStyles).filter(([key]) => fontStyles.includes(key)),
  );
};

const defaultFont = new Set<string>([DEFAULT_FONT_SANS, DEFAULT_FONT_SERIF, DEFAULT_FONT_MONO]);

export const injectGoogleFonts = (fontStyles: Record<string, string>) => {
  for (const [key, value] of Object.entries(fontStyles)) {
    if (!defaultFont.has(value)) {
      const fontFamily = value.split(',')[0];
      const id = `google-font-${fontFamily}`;
      const hasFont = document.getElementById(id);
      if (!hasFont) {
        const link = document.createElement('link');
        link.id = id;
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    }
  }
};

export const applyThemeToElement = (
  rootElement: HTMLElement,
  themeStyles: TThemeStyles,
  mode: TThemeMode,
) => {
  if (!rootElement) return;

  const commonStyles = getCommonStyles(themeStyles.light);
  const colorStyles = getColorStyles(themeStyles[mode]);

  applyStylesToElement(rootElement, {
    ...commonStyles,
    ...colorStyles,
  });

  const fontStyles = getFontStyles(themeStyles[mode]);
  injectGoogleFonts(fontStyles);
};
