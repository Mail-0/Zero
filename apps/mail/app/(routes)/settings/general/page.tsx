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
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SettingsCard } from '@/components/settings/settings-card';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { useState, useEffect, useMemo, memo } from 'react';
import { userSettingsSchema } from '@zero/server/schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, Clock, XIcon, Mail } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations, useLocale } from 'use-intl';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { availableLocales } from '@/i18n/config';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useRevalidator } from 'react-router';
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
  const { data } = useSettings();
  const { data: aliases } = useEmailAliases();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());
  const { mutateAsync: setLocaleCookie } = useMutation(
    trpc.cookiePreferences.setLocaleCookie.mutationOptions(),
  );
  const { revalidate } = useRevalidator();

  const form = useForm<z.infer<typeof userSettingsSchema>>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      language: locale,
      timezone: getBrowserTimezone(),
      dynamicContent: false,
      customPrompt: '',
      zeroSignature: true,
      defaultEmailAlias: '',
    },
  });

  useEffect(() => {
    if (data?.settings) {
      form.reset(data.settings);
    }
  }, [form, data?.settings]);

  useEffect(() => {
    if (aliases && !data?.settings?.defaultEmailAlias) {
      const primaryAlias = aliases.find((alias) => alias.primary);
      if (primaryAlias) {
        form.setValue('defaultEmailAlias', primaryAlias.email);
      }
    }
  }, [aliases, data?.settings?.defaultEmailAlias, form]);

  async function onSubmit(values: z.infer<typeof userSettingsSchema>) {
    setIsSaving(true);
    const saved = data?.settings ? { ...data.settings } : undefined;
    try {
      await saveUserSettings(values);
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater) => {
        if (!updater) return;
        return { settings: { ...updater.settings, ...values } };
      });

      if (saved?.language !== values.language) {
        await setLocaleCookie({ locale: values.language });
        const localeName = new Intl.DisplayNames([values.language], { type: 'language' }).of(
          values.language,
        );
        toast.success(t('common.settings.languageChanged', { locale: localeName! }));
        await revalidate();
      }

      toast.success(t('common.settings.saved'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('common.settings.failedToSave'));
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater) => {
        if (!updater) return;
        return saved ? { settings: { ...updater.settings, ...saved } } : updater;
      });
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
                        <SelectTrigger className="w-36 justify-start">
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
            {aliases && aliases.length > 0 && (
              <FormField
                control={form.control}
                name="defaultEmailAlias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pages.settings.general.defaultEmailAlias')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="w-[300px] justify-start">
                          <Mail className="mr-2 h-4 w-4" />
                          <SelectValue
                            placeholder={t('pages.settings.general.selectDefaultEmail')}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {aliases.map((alias) => (
                          <SelectItem key={alias.email} value={alias.email}>
                            <div className="flex flex-row items-center gap-1">
                              <span className="text-sm">
                                {alias.name ? `${alias.name} <${alias.email}>` : alias.email}
                              </span>
                              {alias.primary && (
                                <span className="text-muted-foreground text-xs">(Primary)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('pages.settings.general.defaultEmailDescription')}
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}
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
                      maxLength={3000}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('pages.settings.general.customPromptDescription')}
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zeroSignature"
              render={({ field }) => (
                <FormItem className="flex max-w-xl flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>{t('pages.settings.general.zeroSignature')}</FormLabel>
                    <FormDescription>
                      {t('pages.settings.general.zeroSignatureDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="autoRead"
              render={({ field }) => (
                <FormItem className="flex max-w-xl flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>{t('pages.settings.general.autoRead')}</FormLabel>
                    <FormDescription>
                      {t('pages.settings.general.autoReadDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
