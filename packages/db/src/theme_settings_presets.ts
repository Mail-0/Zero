import { ThemeSettings } from './schema';

export const sunsetHorizonThemeSettings: ThemeSettings = {
  colors: {
    background: '#fbf9f8', // Light oklch value converted to hex
    foreground: '#575657', // Dark text color
    primary: '#bf7c56', // Warm orange/brown
    primaryForeground: '#ffffff',
    secondary: '#f5e7dc', // Light beige
    secondaryForeground: '#937f6b', // Muted brown
    accent: '#d58f68', // Orange accent
    accentForeground: '#575657', 
    muted: '#f5e9e2', // Very light beige
    mutedForeground: '#8d8b8c', // Muted text
    border: '#ead4c5', // Light border
    cardForeground: '#575657', 
    popoverForeground: '#575657',
    destructive: '#a13b2a', // Reddish brown
    destructiveForeground: '#ffffff',
  },
  fonts: {
    family: 'Montserrat, sans-serif',
    size: 16,
    weight: 400,
  },
  spacing: {
    padding: 16,
    margin: 16,
  },
  shadows: {
    intensity: 10,
    color: 'rgba(0, 0, 0, 0.09)',
  },
  cornerRadius: 10, // 0.625rem
  background: {
    type: 'color',
    value: '#fbf9f8',
  },
};

export const sunsetHorizonDarkThemeSettings: ThemeSettings = {
  colors: {
    background: '#41363a', // Dark oklch value converted to hex
    foreground: '#f0ede9', // Light text color
    primary: '#bf7c56', // Same primary as light theme
    primaryForeground: '#ffffff',
    secondary: '#5f484e', // Darker muted color
    secondaryForeground: '#f0ede9',
    accent: '#d58f68', // Same accent as light theme
    accentForeground: '#41363a',
    muted: '#51424a', // Dark muted background
    mutedForeground: '#d7d0ca', // Light muted text
    border: '#5f484e', // Dark border
    cardForeground: '#f0ede9',
    popoverForeground: '#f0ede9',
    destructive: '#a13b2a', // Same destructive as light theme
    destructiveForeground: '#ffffff',
  },
  fonts: {
    family: 'Montserrat, sans-serif',
    size: 16,
    weight: 400,
  },
  spacing: {
    padding: 16,
    margin: 16,
  },
  shadows: {
    intensity: 15,
    color: 'rgba(0, 0, 0, 0.2)',
  },
  cornerRadius: 10, // 0.625rem
  background: {
    type: 'color',
    value: '#41363a',
  },
};

export const cyberpunkThemeSettings: ThemeSettings = {
  colors: {
    background: '#f8f8fc', // Light background
    foreground: '#342e48', // Dark purple text
    primary: '#dd3686', // Neon pink
    primaryForeground: '#ffffff',
    secondary: '#f3f2f9', // Light purple tint
    secondaryForeground: '#342e48',
    accent: '#05e2c2', // Teal accent
    accentForeground: '#342e48',
    muted: '#f3f2f9', // Light purple background
    mutedForeground: '#342e48',
    border: '#ebeafa', // Light border
    cardForeground: '#342e48',
    popoverForeground: '#342e48',
    destructive: '#e56635', // Orange red
    destructiveForeground: '#ffffff',
  },
  fonts: {
    family: 'Outfit, sans-serif',
    size: 16,
    weight: 400,
  },
  spacing: {
    padding: 16,
    margin: 16,
  },
  shadows: {
    intensity: 10,
    color: 'rgba(0, 0, 0, 0.1)',
  },
  cornerRadius: 8, // 0.5rem
  background: {
    type: 'color',
    value: '#f8f8fc',
  },
};

export const cyberpunkDarkThemeSettings: ThemeSettings = {
  colors: {
    background: '#2e2644', // Dark background
    foreground: '#f1f0fb', // Light text
    primary: '#dd3686', // Neon pink (same as light)
    primaryForeground: '#ffffff',
    secondary: '#453a64', // Darker purple
    secondaryForeground: '#f1f0fb',
    accent: '#05e2c2', // Teal accent (same as light)
    accentForeground: '#2e2644',
    muted: '#453a64', // Dark muted background
    mutedForeground: '#9e94b8', // Muted purple text
    border: '#574b7d', // Dark border
    cardForeground: '#f1f0fb',
    popoverForeground: '#f1f0fb',
    destructive: '#e56635', // Orange red (same as light)
    destructiveForeground: '#ffffff',
  },
  fonts: {
    family: 'Outfit, sans-serif',
    size: 16,
    weight: 400,
  },
  spacing: {
    padding: 16,
    margin: 16,
  },
  shadows: {
    intensity: 15,
    color: 'rgba(0, 0, 0, 0.25)',
  },
  cornerRadius: 8, // 0.5rem
  background: {
    type: 'color',
    value: '#2e2644',
  },
}; 