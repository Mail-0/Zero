'use client';

import { FieldPath, useFormContext } from 'react-hook-form';
import { ThemeEditorControlType } from './theme-config';
import { FormField, FormMessage } from '../ui/form';
import { ThemeStylesSchema } from '@/lib/theme';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { z } from 'zod';

type ThemeFieldRendererProps = {
  type: ThemeEditorControlType;
  label: string;
  name: Exclude<FieldPath<z.infer<typeof ThemeStylesSchema>>, 'dark' | 'light'>;
};

export const ThemeFieldRenderer = ({ type, label, name }: ThemeFieldRendererProps) => {
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
    default:
      return null;
  }
};
