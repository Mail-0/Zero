import {
  SettingsGroup,
  field as field_,
  primaryButton,
  rowClass,
  rowDescription,
  rowTitle,
  selectTrigger,
} from '@/components/settings/settings-ui';
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
import { getLocale, setLocale } from '@/paraglide/runtime';
import { useState, useEffect, useMemo, memo } from 'react';
import { userSettingsSchema } from '@zero/server/schemas';
import { locales } from '@/project.inlang/settings.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { Globe, Clock, Mail } from 'lucide-react';

import { useSettings } from '@/hooks/use-settings';
import { locales as localesData } from '@/locales';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
// import { useRevalidator } from 'react-router';
import { m } from '@/paraglide/messages';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as z from 'zod';

const TimezoneSelect = memo(
  ({ field }: { field: ControllerRenderProps<z.infer<typeof userSettingsSchema>, 'timezone'> }) => {
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
              className={cn(
                selectTrigger,
                'flex items-center justify-start gap-2 px-3 font-normal',
              )}
            >
              <Clock className="text-iconLight dark:text-iconDark shrink-0" />
              <span className="truncate">{field.value}</span>
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] rounded-xl p-0" align="end">
          <div className="p-2">
            <input
              className={cn(field_, 'flex h-8 w-full border px-2.5 text-[13px] outline-none')}
              placeholder={m['pages.settings.general.selectTimezone']()}
              value={timezoneSearch}
              onChange={(e) => setTimezoneSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-1">
              {filteredTimezones.length === 0 && (
                <div className="text-muted-foreground p-2 text-center text-[13px]">
                  {m['pages.settings.general.noResultsFound']()}
                </div>
              )}
              {filteredTimezones.map((timezone) => (
                <div
                  key={timezone}
                  className={cn(
                    'relative flex h-8 cursor-pointer items-center rounded-lg px-2 text-[13px] outline-none select-none',
                    field.value === timezone
                      ? 'bg-[#F0F0F0] dark:bg-[#252525]'
                      : 'hover:bg-[#F5F5F5] dark:hover:bg-[#202020]',
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

function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <FormItem className={rowClass}>
      <div className="min-w-0 flex-1 space-y-0.5">
        <FormLabel className={rowTitle}>{title}</FormLabel>
        <FormDescription className={rowDescription}>{description}</FormDescription>
      </div>
      <FormControl>
        <Switch checked={!!checked} onCheckedChange={onCheckedChange} />
      </FormControl>
    </FormItem>
  );
}

export default function GeneralPage() {
  const [isSaving, setIsSaving] = useState(false);
  const locale = getLocale();

  const { data, refetch: refetchSettings } = useSettings();
  const { data: aliases } = useEmailAliases();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());
  //   const { mutateAsync: setLocaleCookie } = useMutation(
  //     trpc.cookiePreferences.setLocaleCookie.mutationOptions(),
  //   );
  //   const { revalidate } = useRevalidator();

  const form = useForm<z.infer<typeof userSettingsSchema>>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      language: locale,
      timezone: getBrowserTimezone(),
      dynamicContent: false,
      customPrompt: '',
      zeroSignature: true,
      defaultEmailAlias: '',
      animations: false,
    },
  });

  useEffect(() => {
    if (data?.settings) {
      form.reset(data.settings);
      setLocale(data.settings.language as Parameters<typeof setLocale>[0]);
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
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater) => {
        if (!updater) return;
        return { settings: { ...updater.settings, ...values } };
      });
      await saveUserSettings(values);
      await refetchSettings();

      toast.success(m['common.settings.saved']());
    } catch (error) {
      console.error(error);
      toast.error(m['common.settings.failedToSave']());
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater) => {
        if (!updater) return;
        return saved ? { settings: { ...updater.settings, ...saved } } : updater;
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SettingsCard
      title={m['pages.settings.general.title']()}
      description={m['pages.settings.general.description']()}
      footer={
        <Button type="submit" form="general-form" disabled={isSaving} className={primaryButton}>
          {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
        </Button>
      }
    >
      <Form {...form}>
        <form id="general-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <SettingsGroup>
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem
                  className={cn(rowClass, 'flex-col items-stretch md:flex-row md:items-center')}
                >
                  <FormLabel className={cn(rowTitle, 'flex-1')}>
                    {m['pages.settings.general.language']()}
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={selectTrigger}>
                        <div className="flex min-w-0 items-center gap-2 truncate">
                          <Globe className="text-iconLight dark:text-iconDark shrink-0" />
                          <SelectValue placeholder={m['pages.settings.general.selectLanguage']()} />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locales.map((locale) => (
                        <SelectItem key={locale} value={locale} className="text-[13px]">
                          {localesData[locale as keyof typeof localesData]}
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
                <FormItem
                  className={cn(rowClass, 'flex-col items-stretch md:flex-row md:items-center')}
                >
                  <FormLabel className={cn(rowTitle, 'flex-1')}>
                    {m['pages.settings.general.timezone']()}
                  </FormLabel>
                  <TimezoneSelect field={field} />
                </FormItem>
              )}
            />
            {aliases && aliases.length > 0 && (
              <FormField
                control={form.control}
                name="defaultEmailAlias"
                render={({ field }) => (
                  <FormItem
                    className={cn(rowClass, 'flex-col items-stretch md:flex-row md:items-center')}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <FormLabel className={rowTitle}>
                        {m['pages.settings.general.defaultEmailAlias']()}
                      </FormLabel>
                      <FormDescription className={rowDescription}>
                        {m['pages.settings.general.defaultEmailDescription']()}
                      </FormDescription>
                    </div>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className={selectTrigger}>
                          <div className="flex min-w-0 items-center gap-2 truncate">
                            <Mail className="text-iconLight dark:text-iconDark shrink-0" />
                            <SelectValue
                              placeholder={m['pages.settings.general.selectDefaultEmail']()}
                            />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {aliases.map((alias) => (
                          <SelectItem key={alias.email} value={alias.email} className="text-[13px]">
                            <span className="truncate">
                              {alias.name ? `${alias.name} <${alias.email}>` : alias.email}
                            </span>
                            {alias.primary && (
                              <span className="text-muted-foreground ml-1 text-xs">(Primary)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}
          </SettingsGroup>

          <SettingsGroup>
            <FormField
              control={form.control}
              name="zeroSignature"
              render={({ field }) => (
                <SwitchRow
                  title={m['pages.settings.general.zeroSignature']()}
                  description={m['pages.settings.general.zeroSignatureDescription']()}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <FormField
              control={form.control}
              name="autoRead"
              render={({ field }) => (
                <SwitchRow
                  title={m['pages.settings.general.autoRead']()}
                  description={m['pages.settings.general.autoReadDescription']()}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <FormField
              control={form.control}
              name="animations"
              render={({ field }) => (
                <SwitchRow
                  title={m['pages.settings.general.animations']()}
                  description={m['pages.settings.general.animationsDescription']()}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </SettingsGroup>
        </form>
      </Form>
    </SettingsCard>
  );
}
