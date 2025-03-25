'use client';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsCard } from '@/components/settings/settings-card';
import { availableLocales, locales, Locale } from '@/i18n/config';
import { useTranslations, useLocale } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Globe, Clock } from 'lucide-react';
import { changeLocale } from '@/i18n/utils';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { getBrowserTimezone } from '@/lib/timezones';
import { getUserSettings, saveUserSettings } from '@/actions/settings';

const formSchema = z.object({
  language: z.enum(locales as [string, ...string[]]),
  timezone: z.string(),
  dynamicContent: z.boolean(),
  externalImages: z.boolean(),
});

export default function GeneralPage() {
  const [isSaving, setIsSaving] = useState(false);
  const locale = useLocale();
  const t = useTranslations();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: locale as string,
      timezone: getBrowserTimezone(),
      dynamicContent: false,
      externalImages: true,
    },
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await getUserSettings();
        if (settings) {
          form.reset(settings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast.error(t('common.settings.notFound'));
      }
    }
    loadSettings();
  }, [form, t]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      await saveUserSettings(values);
      if (values.language !== locale) {
        await changeLocale(values.language as Locale);
        const localeName = new Intl.DisplayNames([values.language], { type: 'language' }).of(
          values.language,
        );
        toast.success('Language changed to ' + localeName);
      }
      toast.success(t('common.settings.saved'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('common.settings.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.general.title')}
        description={t('pages.settings.general.description')}
        footer={
          <Button type="submit" form="general-form" disabled={isSaving}>
            {isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
          </Button>
        }
      >
        <Form {...form}>
          <form id="general-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex w-full items-center gap-5">
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pages.settings.general.language')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-36">
                          <Globe className="mr-2 h-4 w-4" />
                          <SelectValue placeholder={t('pages.settings.general.selectLanguage')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableLocales.map((locale) => (
                          <SelectItem key={locale.code} value={locale.code}>
                            {locale.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pages.settings.general.timezone')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-36">
                          <Clock className="mr-2 h-4 w-4" />
                          <SelectValue placeholder={t('pages.settings.general.selectTimezone')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Intl.supportedValuesOf('timeZone').map((timezone) => (
                          <SelectItem key={timezone} value={timezone}>
                            {timezone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex w-full items-center gap-5">
              <FormField
                control={form.control}
                name="dynamicContent"
                render={({ field }) => (
                  <FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('pages.settings.general.dynamicContent')}
                      </FormLabel>
                      <FormDescription>
                        {t('pages.settings.general.dynamicContentDescription')}
                      </FormDescription>
                    </div>
                    <FormControl className="ml-4">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="externalImages"
                render={({ field }) => (
                  <FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('pages.settings.general.externalImages')}
                      </FormLabel>
                      <FormDescription>
                        {t('pages.settings.general.externalImagesDescription')}
                      </FormDescription>
                    </div>
                    <FormControl className="ml-4">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
