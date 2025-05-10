import * as z from 'zod';
import { ThemeSettings } from './schema';

export const defaultThemeSettings: ThemeSettings = {
  colors: {
    background: '#FFFFFF',
    foreground: '#000000',
    primary: '#437DFB',
    primaryForeground: '#FFFFFF',
    secondary: '#6D6D6D',
    secondaryForeground: '#FFFFFF',
    accent: '#0066FF',
    accentForeground: '#FFFFFF',
    muted: '#F5F5F5',
    mutedForeground: '#000000',
    border: '#EAEAEA',
    cardForeground: '#000000',
    popoverForeground: '#000000',
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
  },
  fonts: {
    family: 'Geist',
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
  cornerRadius: 8,
  background: {
    type: 'color',
    value: '#FFFFFF',
  },
};

export const darkThemeSettings: ThemeSettings = {
  colors: {
    background: '#141414',
    foreground: '#FFFFFF',
    primary: '#437DFB',
    primaryForeground: '#FFFFFF',
    secondary: '#898989',
    secondaryForeground: '#000000',
    accent: '#0066FF',
    accentForeground: '#FFFFFF',
    muted: '#1A1A1A',
    mutedForeground: '#FFFFFF',
    border: '#1F1F1F',
    cardForeground: '#FFFFFF',
    popoverForeground: '#FFFFFF',
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
  },
  fonts: {
    family: 'Geist',
    size: 16,
    weight: 400,
  },
  spacing: {
    padding: 16,
    margin: 16,
  },
  shadows: {
    intensity: 20,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  cornerRadius: 8,
  background: {
    type: 'color',
    value: '#141414',
  },
};

export const themeSettingsSchema = z.object({
  colors: z.object({
    background: z.string(),
    foreground: z.string(),
    primary: z.string(),
    primaryForeground: z.string().optional(),
    secondary: z.string(),
    secondaryForeground: z.string().optional(),
    accent: z.string(),
    accentForeground: z.string().optional(),
    muted: z.string(),
    mutedForeground: z.string().optional(),
    border: z.string(),
    cardForeground: z.string().optional(),
    popoverForeground: z.string().optional(),
    destructive: z.string().optional(),
    destructiveForeground: z.string().optional(),
  }),
  fonts: z.object({
    family: z.string(),
    size: z.number(),
    weight: z.number(),
  }),
  spacing: z.object({
    padding: z.number(),
    margin: z.number(),
  }),
  shadows: z.object({
    intensity: z.number(),
    color: z.string(),
  }),
  cornerRadius: z.number(),
  background: z.object({
    type: z.enum(['color', 'gradient', 'image']),
    value: z.string(),
  }),
}); 