import { z } from 'zod';

export const StyleSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  'card-foreground': z.string(),
  popover: z.string(),
  'popover-foreground': z.string(),
  primary: z.string(),
  'primary-foreground': z.string(),
  secondary: z.string(),
  'secondary-foreground': z.string(),
  muted: z.string(),
  'muted-foreground': z.string(),
  accent: z.string(),
  'accent-foreground': z.string(),
  destructive: z.string(),
  'destructive-foreground': z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
  'chart-1': z.string(),
  'chart-2': z.string(),
  'chart-3': z.string(),
  'chart-4': z.string(),
  'chart-5': z.string(),
  radius: z.string(),
});

export type TStyleSchema = z.infer<typeof StyleSchema>;

export type TStyleSchemaKey = keyof TStyleSchema;

export const ThemeStylesSchema = z.object({
  dark: StyleSchema.partial(),
  light: StyleSchema.partial(),
});

export const CreateThemeSchema = ThemeStylesSchema.extend({
  name: z.string().min(1),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
});

export type TCreateThemeSchema = z.infer<typeof CreateThemeSchema>;

export type TThemeStyles = z.infer<typeof ThemeStylesSchema>;

export type TThemeMode = 'light' | 'dark';
