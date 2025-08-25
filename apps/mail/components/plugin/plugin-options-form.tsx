'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { pluginManager } from '@/lib/plugin-manager';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { PluginOptions } from '@/types/plugin';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';

interface PluginOptionsFormProps {
  pluginId: string;
  options: PluginOptions;
  initialValues?: Record<string, any>;
}

export function PluginOptionsForm({
  pluginId,
  options,
  initialValues = {},
}: PluginOptionsFormProps) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const initialState: Record<string, any> = {};
    for (const [key, option] of Object.entries(options)) {
      initialState[key] = initialValues[key] ?? option.field.defaultValue ?? option.value;
    }
    return initialState;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Save each option using the plugin manager
      for (const [key, value] of Object.entries(values)) {
        await pluginManager.setPluginOption(pluginId, key, value);
      }
      toast.success('Plugin settings saved successfully');
    } catch (error) {
      console.error('Failed to save plugin options:', error);
      toast.error('Failed to save plugin settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (key: string, option: (typeof options)[keyof PluginOptions]) => {
    const { field } = option;
    const commonProps = {
      id: `plugin-option-${key}`,
      value: values[key],
      onChange: (value: any) => setValues((prev) => ({ ...prev, [key]: value })),
      required: field.required,
    };

    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <Input
            type={field.type}
            {...commonProps}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            pattern={field.validation?.pattern}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            {...commonProps}
            min={field.validation?.min}
            max={field.validation?.max}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
          />
        );
      case 'boolean':
        return (
          <Switch
            {...commonProps}
            checked={!!values[key]}
            onCheckedChange={(checked) => setValues((prev) => ({ ...prev, [key]: checked }))}
          />
        );
      case 'select':
        return (
          <Select
            value={values[key]?.toString()}
            onValueChange={(value) => setValues((prev) => ({ ...prev, [key]: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-4"
    >
      {Object.entries(options).map(([key, option]) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`plugin-option-${key}`}>{option.field.label}</Label>
          {renderField(key, option)}
          {option.field.description && (
            <p className="text-muted-foreground text-sm">{option.field.description}</p>
          )}
          {option.field.validation?.message &&
            values[key] &&
            !new RegExp(option.field.validation.pattern!).test(values[key]) && (
              <p className="text-destructive text-sm">{option.field.validation.message}</p>
            )}
        </div>
      ))}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Settings'}
      </Button>
    </form>
  );
}
