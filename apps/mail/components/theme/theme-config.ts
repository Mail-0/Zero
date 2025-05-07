import {
  sansSerifFontLabelValues,
  monoFontLabelValues,
  serifFontLabelValues,
  DEFAULT_FONT_SANS,
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SERIF,
} from './default-themes';
import { type ThemeStylesSchema } from '@/lib/theme';
import { type FieldPath } from 'react-hook-form';
import { type z } from 'zod';

export type ThemeEditorControlType = 'color' | 'slider' | 'select';

export type ThemeEditorControlName = Exclude<
  FieldPath<z.infer<typeof ThemeStylesSchema>>,
  'dark' | 'light'
>;

type ThemeEditorControl = {
  name: ThemeEditorControlName;
  label: string;
} & (
  | {
      type: 'color';
      sliderConfig?: never;
      options?: never;
    }
  | {
      type: 'slider';
      sliderConfig: {
        min: number;
        max: number;
        step: number;
        unit: string;
      };
      options?: never;
    }
  | {
      type: 'select';
      options: { label: string; value: string }[];
      sliderConfig?: never;
    }
);
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
    {
      id: 'accent-colors',
      label: 'Accent Colors',
      controls: [
        {
          name: 'light.accent',
          label: 'Accent',
          type: 'color',
        },
        {
          name: 'light.accent-foreground',
          label: 'Accent Foreground',
          type: 'color',
        },
        {
          name: 'dark.accent',
          label: 'Accent (Dark)',
          type: 'color',
        },
        {
          name: 'dark.accent-foreground',
          label: 'Accent Foreground (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'base-colors',
      label: 'Base Colors',
      controls: [
        {
          name: 'light.background',
          label: 'Background',
          type: 'color',
        },
        {
          name: 'light.foreground',
          label: 'Foreground',
          type: 'color',
        },
        {
          name: 'dark.background',
          label: 'Background (Dark)',
          type: 'color',
        },
        {
          name: 'dark.foreground',
          label: 'Foreground (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'card-colors',
      label: 'Card Colors',
      controls: [
        {
          name: 'light.card',
          label: 'Card Background',
          type: 'color',
        },
        {
          name: 'light.card-foreground',
          label: 'Card Foreground',
          type: 'color',
        },
        {
          name: 'dark.card',
          label: 'Card Background (Dark)',
          type: 'color',
        },
        {
          name: 'dark.card-foreground',
          label: 'Card Foreground (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'popover-colors',
      label: 'Popover Colors',
      controls: [
        {
          name: 'light.popover',
          label: 'Popover Background',
          type: 'color',
        },
        {
          name: 'light.popover-foreground',
          label: 'Popover Foreground',
          type: 'color',
        },
        {
          name: 'dark.popover',
          label: 'Popover Background (Dark)',
          type: 'color',
        },
        {
          name: 'dark.popover-foreground',
          label: 'Popover Foreground (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'muted-colors',
      label: 'Muted Colors',
      controls: [
        {
          name: 'light.muted',
          label: 'Muted',
          type: 'color',
        },
        {
          name: 'light.muted-foreground',
          label: 'Muted Foreground',
          type: 'color',
        },
        {
          name: 'dark.muted',
          label: 'Muted (Dark)',
          type: 'color',
        },
        {
          name: 'dark.muted-foreground',
          label: 'Muted Foreground (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'destructive-colors',
      label: 'Destructive Colors',
      controls: [
        {
          name: 'light.destructive',
          label: 'Destructive',
          type: 'color',
        },
        {
          name: 'light.destructive-foreground',
          label: 'Destructive Foreground',
          type: 'color',
        },
        {
          name: 'dark.destructive',
          label: 'Destructive (Dark)',
          type: 'color',
        },
        {
          name: 'dark.destructive-foreground',
          label: 'Destructive Foreground (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'border-input-colors',
      label: 'Border & Input Colors',
      controls: [
        {
          name: 'light.border',
          label: 'Border',
          type: 'color',
        },
        {
          name: 'light.input',
          label: 'Input',
          type: 'color',
        },
        {
          name: 'light.ring',
          label: 'Ring',
          type: 'color',
        },
        {
          name: 'dark.border',
          label: 'Border (Dark)',
          type: 'color',
        },
        {
          name: 'dark.input',
          label: 'Input (Dark)',
          type: 'color',
        },
        {
          name: 'dark.ring',
          label: 'Ring (Dark)',
          type: 'color',
        },
      ],
    },
    {
      id: 'chart-colors',
      label: 'Chart Colors',
      controls: [
        {
          name: 'light.chart-1',
          label: 'Chart 1',
          type: 'color',
        },
        {
          name: 'light.chart-2',
          label: 'Chart 2',
          type: 'color',
        },
        {
          name: 'light.chart-3',
          label: 'Chart 3',
          type: 'color',
        },
        {
          name: 'light.chart-4',
          label: 'Chart 4',
          type: 'color',
        },
        {
          name: 'light.chart-5',
          label: 'Chart 5',
          type: 'color',
        },
        {
          name: 'dark.chart-1',
          label: 'Chart 1 (Dark)',
          type: 'color',
        },
        {
          name: 'dark.chart-2',
          label: 'Chart 2 (Dark)',
          type: 'color',
        },
        {
          name: 'dark.chart-3',
          label: 'Chart 3 (Dark)',
          type: 'color',
        },
        {
          name: 'dark.chart-4',
          label: 'Chart 4 (Dark)',
          type: 'color',
        },
        {
          name: 'dark.chart-5',
          label: 'Chart 5 (Dark)',
          type: 'color',
        },
      ],
    },
  ],
  typography: [
    {
      id: 'font-family',
      label: 'Font Family',
      controls: [
        {
          name: 'light.font-sans',
          label: 'Font Sans',
          type: 'select',
          options: [
            ...sansSerifFontLabelValues,
            ...serifFontLabelValues,
            ...monoFontLabelValues,
            { label: 'System', value: DEFAULT_FONT_SANS },
          ],
        },
        {
          name: 'light.font-serif',
          label: 'Font Serif',
          type: 'select',
          options: [
            ...sansSerifFontLabelValues,
            ...serifFontLabelValues,
            ...monoFontLabelValues,
            { label: 'System', value: DEFAULT_FONT_SERIF },
          ],
        },
        {
          name: 'light.font-mono',
          label: 'Font Mono',
          type: 'select',
          options: [
            ...sansSerifFontLabelValues,
            ...serifFontLabelValues,
            ...monoFontLabelValues,
            { label: 'System', value: DEFAULT_FONT_MONO },
          ],
        },
      ],
    },
  ],
  other: [
    {
      id: 'radius',
      label: 'Radius',
      controls: [
        {
          name: 'light.radius',
          label: 'Radius',
          type: 'slider',
          sliderConfig: {
            min: 0,
            max: 100,
            step: 1,
            unit: 'em',
          },
        },
      ],
    },
  ],
};
