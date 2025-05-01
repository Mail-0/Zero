'use client';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsCard } from '@/components/settings/settings-card';
import { zodResolver } from '@hookform/resolvers/zod';
import { saveUserSettings } from '@/actions/settings';
import { useSettings } from '@/hooks/use-settings';
import { MessageKey } from '@/config/navigation';
import { Laptop, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import * as z from 'zod';

const formSchema = z.object({
  colorTheme: z.enum(['dark', 'light', 'system', '']),
});

export default function AppearancePage() {
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations();
  const { settings, mutate } = useSettings();
  const { theme, systemTheme, resolvedTheme, setTheme } = useTheme();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      colorTheme: settings?.colorTheme || '',
    },
  });

  // const [mounted, setMounted] = useState(false);

  // useEffect(() => {
  //   setMounted(true);
  // }, []);

  async function handleThemeChange(newTheme: string) {
    let nextResolvedTheme = newTheme;

    if (newTheme === 'system' && systemTheme) {
      nextResolvedTheme = systemTheme;
    }

    function update() {
      setTheme(newTheme);
    }

    if (document.startViewTransition && nextResolvedTheme !== resolvedTheme) {
      document.documentElement.style.viewTransitionName = 'theme-transition';
      await document.startViewTransition(update).finished;
      document.documentElement.style.viewTransitionName = '';
    } else {
      update();
    }
  }

  useEffect(() => {
    if (settings) {
      form.reset({
        colorTheme: settings.colorTheme,
      });
    }
  }, [form, settings]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    setIsSaving(true);
    try {
      await saveUserSettings({
        ...settings,
        colorTheme: values.colorTheme,
      });
      await mutate(
        {
          ...settings,
          colorTheme: values.colorTheme,
        },
        { revalidate: false },
      );

      toast.success(t('common.settings.saved'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('common.settings.failedToSave'));
      await mutate();
    } finally {
      setIsSaving(false);
    }
  }

  if (!settings) return null;

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.appearance.title')}
        description={t('pages.settings.appearance.description')}
        footer={
          <Button type="submit" form="appearance-form" disabled={isSaving}>
            {isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
          </Button>
        }
      >
        <Form {...form}>
          <form id="appearance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <div className="max-w-sm space-y-2">
                <FormField
                  control={form.control}
                  name="colorTheme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pages.settings.appearance.theme')}</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(value) => {
                            handleThemeChange(value);
                            field.onChange(value);
                          }}
                          defaultValue={settings?.colorTheme || ''}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select theme">
                              <div className="flex items-center gap-2 capitalize">
                                {theme === 'dark' && <Moon className="h-4 w-4" />}
                                {theme === 'light' && <Sun className="h-4 w-4" />}
                                {theme === 'system' && <Laptop className="h-4 w-4" />}
                                {t(`common.themes.${theme}` as MessageKey)}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dark">
                              <div className="flex items-center gap-2">
                                <Moon className="h-4 w-4" />
                                {t('common.themes.dark')}
                              </div>
                            </SelectItem>
                            <SelectItem value="system">
                              <div className="flex items-center gap-2">
                                <Laptop className="h-4 w-4" />
                                {t('common.themes.system')}
                              </div>
                            </SelectItem>
                            <SelectItem value="light">
                              <div className="flex items-center gap-2">
                                <Sun className="h-4 w-4" />
                                {t('common.themes.light')}
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
