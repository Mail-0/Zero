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

// Amber Minimal
export const amberMinimalThemeSettings: ThemeSettings = {
  colors: {
    background: '#ffffff',
    foreground: '#262626',
    cardForeground: '#262626',
    popoverForeground: '#262626',
    primary: '#f59e0b',
    primaryForeground: '#000000',
    secondary: '#f3f4f6',
    secondaryForeground: '#4b5563',
    muted: '#f9fafb',
    mutedForeground: '#6b7280',
    accent: '#fffbeb',
    accentForeground: '#92400e',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#e5e7eb',
  },
  fonts: { family: 'Inter', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 8, color: 'rgba(0,0,0,0.1)' },
  cornerRadius: 6,
  background: { type: 'color', value: '#ffffff' },
};

export const amberMinimalDarkThemeSettings: ThemeSettings = {
  colors: {
    background: '#171717',
    foreground: '#e5e5e5',
    cardForeground: '#e5e5e5',
    popoverForeground: '#e5e5e5',
    primary: '#f59e0b',
    primaryForeground: '#000000',
    secondary: '#262626',
    secondaryForeground: '#e5e5e5',
    muted: '#262626',
    mutedForeground: '#a3a3a3',
    accent: '#92400e',
    accentForeground: '#fde68a',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#404040',
  },
  fonts: { family: 'Inter', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 10, color: 'rgba(0,0,0,0.15)' },
  cornerRadius: 6,
  background: { type: 'color', value: '#171717' },
};

// Amethyst Haze
export const amethystHazeThemeSettings: ThemeSettings = {
  colors: {
    background: '#f8f7fa',
    foreground: '#3d3c4f',
    cardForeground: '#3d3c4f',
    popoverForeground: '#3d3c4f',
    primary: '#8a79ab',
    primaryForeground: '#f8f7fa',
    secondary: '#dfd9ec',
    secondaryForeground: '#3d3c4f',
    muted: '#dcd9e3',
    mutedForeground: '#6b6880',
    accent: '#e6a5b8',
    accentForeground: '#4b2e36',
    destructive: '#d95c5c',
    destructiveForeground: '#f8f7fa',
    border: '#cec9d9',
  },
  fonts: { family: 'Geist', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 5, color: 'rgba(0,0,0,0.06)' },
  cornerRadius: 8,
  background: { type: 'color', value: '#f8f7fa' },
};

export const amethystHazeDarkThemeSettings: ThemeSettings = {
  colors: {
    background: '#1a1823',
    foreground: '#e0ddef',
    cardForeground: '#e0ddef',
    popoverForeground: '#e0ddef',
    primary: '#a995c9',
    primaryForeground: '#1a1823',
    secondary: '#5a5370',
    secondaryForeground: '#e0ddef',
    muted: '#242031',
    mutedForeground: '#a09aad',
    accent: '#372e3f',
    accentForeground: '#f2b8c6',
    destructive: '#e57373',
    destructiveForeground: '#1a1823',
    border: '#302c40',
  },
  fonts: { family: 'Geist', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 7, color: 'rgba(0,0,0,0.1)' },
  cornerRadius: 8,
  background: { type: 'color', value: '#1a1823' },
};

// Bold Tech
export const boldTechThemeSettings: ThemeSettings = {
  colors: {
    background: '#ffffff',
    foreground: '#312e81',
    cardForeground: '#312e81',
    popoverForeground: '#312e81',
    primary: '#8b5cf6',
    primaryForeground: '#ffffff',
    secondary: '#f3f0ff',
    secondaryForeground: '#4338ca',
    muted: '#f5f3ff',
    mutedForeground: '#7c3aed',
    accent: '#dbeafe',
    accentForeground: '#1e40af',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#e0e7ff',
  },
  fonts: { family: 'Roboto', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 4, color: 'hsla(255, 86%, 66%, 0.2)' },
  cornerRadius: 10,
  background: { type: 'color', value: '#ffffff' },
};

export const boldTechDarkThemeSettings: ThemeSettings = {
  colors: {
    background: '#0f172a',
    foreground: '#e0e7ff',
    cardForeground: '#e0e7ff',
    popoverForeground: '#e0e7ff',
    primary: '#8b5cf6',
    primaryForeground: '#ffffff',
    secondary: '#1e1b4b',
    secondaryForeground: '#e0e7ff',
    muted: '#1e1b4b',
    mutedForeground: '#c4b5fd',
    accent: '#4338ca',
    accentForeground: '#e0e7ff',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#2e1065',
  },
  fonts: { family: 'Roboto', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 6, color: 'hsla(255, 86%, 66%, 0.25)' },
  cornerRadius: 10,
  background: { type: 'color', value: '#0f172a' },
};

// Bubblegum
export const bubblegumThemeSettings: ThemeSettings = {
  colors: {
    background: '#f6e6ee',
    foreground: '#5b5b5b',
    cardForeground: '#5b5b5b',
    popoverForeground: '#5b5b5b',
    primary: '#d04f99',
    primaryForeground: '#ffffff',
    secondary: '#8acfd1',
    secondaryForeground: '#333333',
    muted: '#b2e1eb',
    mutedForeground: '#7a7a7a',
    accent: '#fbe2a7',
    accentForeground: '#333333',
    destructive: '#f96f70',
    destructiveForeground: '#ffffff',
    border: '#d04f99',
  },
  fonts: { family: 'Poppins', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 5, color: 'hsla(325.78, 58.18%, 56.86%, 0.7)' },
  cornerRadius: 6,
  background: { type: 'color', value: '#f6e6ee' },
};

export const bubblegumDarkThemeSettings: ThemeSettings = {
  colors: {
    background: '#12242e',
    foreground: '#f3e3ea',
    cardForeground: '#f3e3ea',
    popoverForeground: '#f3e3ea',
    primary: '#fbe2a7',
    primaryForeground: '#12242e',
    secondary: '#e4a2b1',
    secondaryForeground: '#12242e',
    muted: '#24272b',
    mutedForeground: '#e4a2b1',
    accent: '#c67b96',
    accentForeground: '#f3e3ea',
    destructive: '#e35ea4',
    destructiveForeground: '#12242e',
    border: '#324859',
  },
  fonts: { family: 'Poppins', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 7, color: 'hsla(206.15, 28.06%, 27.25%, 0.7)' },
  cornerRadius: 6,
  background: { type: 'color', value: '#12242e' },
};

// Caffeine
export const caffeineThemeSettings: ThemeSettings = {
  colors: {
    background: '#f9f9f9',
    foreground: '#202020',
    cardForeground: '#202020',
    popoverForeground: '#202020',
    primary: '#644a40',
    primaryForeground: '#ffffff',
    secondary: '#ffdfb5',
    secondaryForeground: '#582d1d',
    muted: '#efefef',
    mutedForeground: '#646464',
    accent: '#e8e8e8',
    accentForeground: '#202020',
    destructive: '#e54d2e',
    destructiveForeground: '#ffffff',
    border: '#d8d8d8',
  },
  fonts: { family: 'ui-sans-serif', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 4, color: 'rgba(0,0,0,0.1)' },
  cornerRadius: 8,
  background: { type: 'color', value: '#f9f9f9' },
};

export const caffeineDarkThemeSettings: ThemeSettings = {
  colors: {
    background: '#111111',
    foreground: '#eeeeee',
    cardForeground: '#eeeeee',
    popoverForeground: '#eeeeee',
    primary: '#ffe0c2',
    primaryForeground: '#081a1b',
    secondary: '#393028',
    secondaryForeground: '#ffe0c2',
    muted: '#222222',
    mutedForeground: '#b4b4b4',
    accent: '#2a2a2a',
    accentForeground: '#eeeeee',
    destructive: '#e54d2e',
    destructiveForeground: '#ffffff',
    border: '#201e18',
  },
  fonts: { family: 'ui-sans-serif', size: 16, weight: 400 },
  spacing: { padding: 16, margin: 16 },
  shadows: { intensity: 6, color: 'rgba(0,0,0,0.15)' },
  cornerRadius: 8,
  background: { type: 'color', value: '#111111' },
}; 