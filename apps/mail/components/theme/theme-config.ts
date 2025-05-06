import { type ThemeStylesSchema, type TStyleSchemaKey } from '@/lib/theme';
import { type FieldPath } from 'react-hook-form';
import { type z } from 'zod';

export type ThemeEditorControlType = 'color';

export type ThemeEditorControlName = Exclude<
  FieldPath<z.infer<typeof ThemeStylesSchema>>,
  'dark' | 'light'
>;

type ThemeEditorControl = {
  name: ThemeEditorControlName;
  label: string;
  type: ThemeEditorControlType;
};

type ThemeEditorSection = {
  id: string;
  label: string;
  controls: ThemeEditorControl[];
};

type ThemeEditorControlConfig = {
  colors: ThemeEditorSection[];
  typography: ThemeEditorSection[];
  other: ThemeEditorSection[];
};

export const themeEditorControlConfig: ThemeEditorControlConfig = {
  colors: [
    {
      id: 'primary-colors',
      label: 'Primary Colors',
      controls: [
        {
          name: 'light.primary',
          label: 'Primary',
          type: 'color',
        },
        {
          name: 'light.primary-foreground',
          label: 'Primary Foreground',
          type: 'color',
        },
        {
          name: 'dark.primary',
          label: 'Primary (Dark)',
          type: 'color',
        },
        {
          name: 'dark.primary-foreground',
          label: 'Primary Foreground (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'secondary-colors',
      label: 'Secondary Colors',
      controls: [
        {
          name: 'light.secondary',
          label: 'Secondary',
          type: 'color',
        },
        {
          name: 'light.secondary-foreground',
          label: 'Secondary Foreground',
          type: 'color',
        },
        {
          name: 'dark.secondary',
          label: 'Secondary (Dark)',
          type: 'color',
        },
        {
          name: 'dark.secondary-foreground',
          label: 'Secondary Foreground (Dark)',
          type: 'color',
        },
      ],
    },
  ],
  typography: [],
  other: [],
};
