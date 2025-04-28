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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { userSettingsSchema } from '@zero/db/user_settings_default';
import { SettingsCard } from '@/components/settings/settings-card';
import { availableLocales, locales, Locale } from '@/i18n/config';
import { useForm, ControllerRenderProps } from 'react-hook-form';
import { useState, useEffect, useMemo, memo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations, useLocale } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { saveUserSettings } from '@/actions/settings';
import { getBrowserTimezone } from '@/lib/timezones';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { Globe, Clock, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { changeLocale } from '@/i18n/utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as z from 'zod';

const TimezoneSelect = memo(
  ({
    field,
    t,
  }: {
    field: ControllerRenderProps<z.infer<typeof userSettingsSchema>, 'timezone'>;
    t: any;
  }) => {
    const [open, setOpen] = useState(false);
    const [timezoneSearch, setTimezoneSearch] = useState('');

    const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

    const filteredTimezones = useMemo(() => {
      if (!timezoneSearch) return timezones;
      return timezones.filter((timezone) =>
        timezone.toLowerCase().includes(timezoneSearch.toLowerCase()),
      );
    }, [timezones, timezoneSearch]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-46 flex items-center justify-start"
            >
              <Clock className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{field.value}</span>
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <div className="px-3 py-2">
            <input
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('pages.settings.general.selectTimezone')}
              value={timezoneSearch}
              onChange={(e) => setTimezoneSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-1">
              {filteredTimezones.length === 0 && (
                <div className="text-muted-foreground p-2 text-center text-sm">
                  {t('pages.settings.general.noResultsFound')}
                </div>
              )}
              {filteredTimezones.map((timezone) => (
                <div
                  key={timezone}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    field.value === timezone
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                  onClick={() => {
                    field.onChange(timezone);
                    setOpen(false);
                  }}
                >
                  {timezone}
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  },
);

TimezoneSelect.displayName = 'TimezoneSelect';

export default function GeneralPage() {
  const [isSaving, setIsSaving] = useState(false);
  const locale = useLocale();
  const t = useTranslations();
  const { settings, mutate } = useSettings();

  const form = useForm<z.infer<typeof userSettingsSchema>>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      language: locale,
      timezone: getBrowserTimezone(),
      dynamicContent: false,
      externalImages: true,
      customPrompt: '',
      trustedSenders: [],
    },
  });

  const externalImages = form.watch('externalImages');

  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [form, settings]);

  async function onSubmit(values: z.infer<typeof userSettingsSchema>) {
    setIsSaving(true);
    try {
      await saveUserSettings(values);
      await mutate(values, { revalidate: false });
      if (values.language !== locale) {
        await changeLocale(values.language as Locale);
        const localeName = new Intl.DisplayNames([values.language], { type: 'language' }).of(
          values.language,
        );
        toast.success(t('common.settings.languageChanged', { locale: localeName }));
      }

      toast.success(t('common.settings.saved'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('common.settings.failedToSave'));
      await mutate();
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
                    <TimezoneSelect field={field} t={t} />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex w-full w-max flex-col items-start gap-5">
              <FormField
                control={form.control}
                name="externalImages"
                render={({ field }) => (
                  <FormItem className="bg-popover flex w-full flex-row items-center justify-between rounded-lg border p-4 md:w-auto">
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
              <FormField
                control={form.control}
                name="hidePersonalInformation"
                render={({ field }) => (
                  <FormItem className="bg-popover flex w-full flex-row items-center justify-between rounded-lg border p-4 md:w-auto">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('pages.settings.general.hidePersonalInformation')}
                      </FormLabel>
                      <FormDescription>
                        {t('pages.settings.general.hidePersonalInformationDescription')}
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
                name="trustedSenders"
                render={({ field }) =>
                  (field.value?.length || 0) > 0 && !externalImages ? (
                    <FormItem className="bg-popover flex w-full flex-col rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('pages.settings.general.trustedSenders')}
                        </FormLabel>
                        <FormDescription>
                          {t('pages.settings.general.trustedSendersDescription')}
                        </FormDescription>
                      </div>
                      <ScrollArea className="flex max-h-32 flex-col pr-3">
                        {field.value?.map((senderEmail) => (
                          <div
                            className="mt-1.5 flex items-center justify-between first:mt-0"
                            key={senderEmail}
                          >
                            <span>{senderEmail}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() =>
                                    field.onChange(field.value?.filter((e) => e !== senderEmail))
                                  }
                                >
                                  <XIcon className="h-4 w-4 transition hover:opacity-80" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{t('common.actions.remove')}</TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </ScrollArea>
                    </FormItem>
                  ) : (
                    <></>
                  )
                }
              />
            </div>
            <FormField
              control={form.control}
              name="customPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('pages.settings.general.customPrompt')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('pages.settings.general.customPromptPlaceholder')}
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('pages.settings.general.customPromptDescription')}
                  </FormDescription>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
