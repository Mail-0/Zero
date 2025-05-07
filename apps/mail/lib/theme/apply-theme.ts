import { TStyleSchema, TThemeMode, TThemeStyles } from '../theme';

export const COMMON_STYLES = ['font-sans', 'font-serif', 'font-mono', 'radius'];

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
};
