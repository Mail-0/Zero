'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { type FieldPath, useFormContext } from 'react-hook-form';
import type { ThemeEditorControlType } from './theme-config';
import { hslToHex, hexToHSL } from './converter';
import { ThemeStylesSchema } from '@/lib/theme';
import { Input } from '@/components/ui/input';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { useState } from 'react';
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
  options?: { label: string; value: string }[];
};

export const ThemeFieldRenderer = ({
  type,
  label,
  name,
  sliderConfig,
  options,
}: ThemeFieldRendererProps) => {
  const form = useFormContext<z.infer<typeof ThemeStylesSchema>>();

  switch (type) {
    case 'color':
      return <ColorFieldRenderer label={label} name={name} />;
    case 'slider':
      if (!sliderConfig) {
        throw new Error('Slider config is required');
      }
      return <SliderFieldRenderer label={label} name={name} sliderConfig={sliderConfig} />;
    case 'select':
      if (!options) {
        throw new Error('Options are required');
      }
      return <SelectFieldRenderer label={label} name={name} options={options} />;
    default:
      return null;
  }
};

function ColorFieldRenderer({
  label,
  name,
}: {
  label: string;
  name: Exclude<FieldPath<z.infer<typeof ThemeStylesSchema>>, 'dark' | 'light'>;
}) {
  const form = useFormContext<z.infer<typeof ThemeStylesSchema>>();
  const [value, setValue] = useState(() => hslToHex(`hsl(${form.getValues(name)})`));

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label>{label}</Label>
          <Input
            {...field}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);

              field.onChange(hexToHSL(e.target.value));
            }}
            type="color"
          />
          <FormMessage />
        </div>
      )}
    />
  );
}

function SliderFieldRenderer({
  label,
  name,
  sliderConfig,
}: {
  label: string;
  name: Exclude<FieldPath<z.infer<typeof ThemeStylesSchema>>, 'dark' | 'light'>;
  sliderConfig: {
    min: number;
    max: number;
    step: number;
    unit: string;
  };
}) {
  const form = useFormContext<z.infer<typeof ThemeStylesSchema>>();
  const [value, setValue] = useState(() => [
    Number(form.getValues(name)?.replace(sliderConfig.unit, '')),
  ]);
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-col gap-4">
          <Label>{label}</Label>
          <Slider
            onValueChange={(value) => {
              setValue(value);
              field.onChange(`${value[0]}${sliderConfig.unit}`);
            }}
            value={value}
            min={sliderConfig.min}
            max={sliderConfig.max}
            step={sliderConfig.step}
          />
          <FormMessage />
        </div>
      )}
    />
  );
}

function SelectFieldRenderer({
  label,
  name,
  options,
}: {
  label: string;
  name: Exclude<FieldPath<z.infer<typeof ThemeStylesSchema>>, 'dark' | 'light'>;
  options: { label: string; value: string }[];
}) {
  const form = useFormContext<z.infer<typeof ThemeStylesSchema>>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>

          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={label} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
