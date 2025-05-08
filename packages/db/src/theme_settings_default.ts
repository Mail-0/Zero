import * as z from 'zod';
import { ThemeSettings } from './schema';

export const defaultThemeSettings: ThemeSettings = {
  colors: {
    background: '#FFFFFF',
    foreground: '#000000',
    primary: '#437DFB',
    secondary: '#6D6D6D',
    accent: '#0066FF',
    muted: '#F5F5F5',
    border: '#EAEAEA',
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
    secondary: '#898989',
    accent: '#0066FF',
    muted: '#1A1A1A',
    border: '#1F1F1F',
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
    secondary: z.string(),
    accent: z.string(),
    muted: z.string(),
    border: z.string(),
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