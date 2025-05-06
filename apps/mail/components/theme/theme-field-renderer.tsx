'use client';

import { FieldPath, useFormContext } from 'react-hook-form';
import { ThemeEditorControlType } from './theme-config';
import { FormField, FormMessage } from '../ui/form';
import { ThemeStylesSchema } from '@/lib/theme';
import { Input } from '@/components/ui/input';
import { Slider } from '../ui/slider';
import { Toggle } from '../ui/toggle';
import { Label } from '../ui/label';
import { z } from 'zod';

type ThemeFieldRendererProps = {
  type: ThemeEditorControlType;
  label: string;
  name: Exclude<FieldPath<z.infer<typeof ThemeStylesSchema>>, 'dark' | 'light'>;
  sliderConfig?: {
    min: number;
    max: number;
    step: number;
    unit: string;
  };
};

export const ThemeFieldRenderer = ({
  type,
  label,
  name,
  sliderConfig,
}: ThemeFieldRendererProps) => {
  const form = useFormContext<z.infer<typeof ThemeStylesSchema>>();

  switch (type) {
    case 'color':
      return (
        <FormField
          control={form.control}
          name={name}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <Label>{label}</Label>
              <Input type="color" {...field} />
              <FormMessage />
            </div>
          )}
        />
      );
    case 'slider':
      if (!sliderConfig) {
        throw new Error('Slider config is required');
      }
      return (
        <FormField
          control={form.control}
          name={name}
          render={({ field }) => (
            <div className="flex flex-col gap-4">
              <Label>{label}</Label>
              <Slider
                onValueChange={(value) => {
                  field.onChange(String(value[0]));
                }}
                value={[Number(field.value?.replace(sliderConfig.unit, ''))]}
                min={sliderConfig.min}
                max={sliderConfig.max}
                step={sliderConfig.step}
              />
              <FormMessage />
            </div>
          )}
        />
      );
    default:
      return null;
  }
};
