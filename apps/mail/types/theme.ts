// Theme types for the frontend (matching the server schema)
import { GoogleFont, defaultTheme } from '@/packages/shared/theme-constants';
export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  fontWeight: {
    thin: string;
    light: string;
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
    extrabold: string;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
    loose: string;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface ThemeShadows {
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
}

export interface ThemeBorderRadius {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  full: string;
}

export interface ThemeBackgrounds {
  gradient?: string;
  pattern?: string;
  blur?: boolean;
}

export interface Theme {
  id?: string;
  name: string;
  description?: string;
  isPublic: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  shadows: ThemeShadows;
  borderRadius: ThemeBorderRadius;
  backgrounds: ThemeBackgrounds;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

export interface ConnectionTheme {
  connectionId: string;
  themeId: string;
  theme?: Theme;
  createdAt?: string;
  updatedAt?: string;
}

// Google Fonts list (popular ones for selection)
export const googleFonts = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Source Sans Pro',
  'Oswald',
  'Montserrat',
  'Raleway',
  'PT Sans',
  'Lora',
  'Nunito',
  'Ubuntu',
  'Playfair Display',
  'Merriweather',
  'Fira Sans',
  'Libre Baskerville',
  'Work Sans',
  'Crimson Text',
  'Space Grotesk',
] as const;
