import { z } from 'zod';

// Color schema for theme customization
export const colorSchema = z.object({
  primary: z.string(),
  primaryForeground: z.string(),
  secondary: z.string(),
  secondaryForeground: z.string(),
  background: z.string(),
  foreground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  destructive: z.string(),
  destructiveForeground: z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
  card: z.string(),
  cardForeground: z.string(),
  popover: z.string(),
  popoverForeground: z.string(),
});

// Typography schema
export const typographySchema = z.object({
  fontFamily: z.string(),
  fontSize: z.object({
    xs: z.string(),
    sm: z.string(),
    base: z.string(),
    lg: z.string(),
    xl: z.string(),
    '2xl': z.string(),
    '3xl': z.string(),
    '4xl': z.string(),
  }),
  fontWeight: z.object({
    thin: z.string(),
    light: z.string(),
    normal: z.string(),
    medium: z.string(),
    semibold: z.string(),
    bold: z.string(),
    extrabold: z.string(),
  }),
  lineHeight: z.object({
    tight: z.string(),
    normal: z.string(),
    relaxed: z.string(),
    loose: z.string(),
  }),
});

// Spacing schema
export const spacingSchema = z.object({
  xs: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  '3xl': z.string(),
  '4xl': z.string(),
});

// Shadow schema
export const shadowSchema = z.object({
  sm: z.string(),
  base: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  inner: z.string(),
});

// Border radius schema
export const borderRadiusSchema = z.object({
  none: z.string(),
  sm: z.string(),
  base: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  '3xl': z.string(),
  full: z.string(),
});

// Background schema
export const backgroundSchema = z.object({
  gradient: z.string().optional(),
  pattern: z.string().optional(),
  blur: z.boolean().optional(),
});

// Complete theme schema
export const themeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Theme name is required'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  colors: colorSchema,
  typography: typographySchema,
  spacing: spacingSchema,
  shadows: shadowSchema,
  borderRadius: borderRadiusSchema,
  backgrounds: backgroundSchema,
});

// Connection theme schema
export const connectionThemeSchema = z.object({
  connectionId: z.string(),
  themeId: z.string(),
});

// Default theme values
export const defaultTheme = {
  name: 'Default',
  description: 'Default application theme',
  isPublic: false,
  colors: {
    primary: 'hsl(240 5.9% 10%)',
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(240 4.8% 95.9%)',
    secondaryForeground: 'hsl(240 5.9% 10%)',
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(240 10% 3.9%)',
    muted: 'hsl(240 4.8% 95.9%)',
    mutedForeground: 'hsl(240 3.8% 46.1%)',
    accent: 'hsl(240 4.8% 95.9%)',
    accentForeground: 'hsl(240 5.9% 10%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    destructiveForeground: 'hsl(0 0% 98%)',
    border: 'hsl(240 5.9% 90%)',
    input: 'hsl(240 5.9% 90%)',
    ring: 'hsl(240 10% 3.9%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(240 10% 3.9%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(240 10% 3.9%)',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      thin: '100',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },
  backgrounds: {
    gradient: '',
    pattern: '',
    blur: false,
  },
} satisfies z.infer<typeof themeSchema>;

export type ThemeType = z.infer<typeof themeSchema>;
export type ColorType = z.infer<typeof colorSchema>;
export type TypographyType = z.infer<typeof typographySchema>;
export type SpacingType = z.infer<typeof spacingSchema>;
export type ShadowType = z.infer<typeof shadowSchema>;
export type BorderRadiusType = z.infer<typeof borderRadiusSchema>;
export type BackgroundType = z.infer<typeof backgroundSchema>;
export type ConnectionThemeType = z.infer<typeof connectionThemeSchema>;

// Google Fonts list (popular ones)
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

export type GoogleFont = (typeof googleFonts)[number];
