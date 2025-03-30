'use client';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { SettingsCard } from '@/components/settings/settings-card';
import { zodResolver } from '@hookform/resolvers/zod';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { KeyRound } from 'lucide-react';
import { useState, useEffect } from 'react';
import * as z from 'zod';
import { useSettings } from '@/hooks/use-settings';
import { saveUserSettings } from '@/actions/settings';
import { toast } from 'sonner';
import { securitySettingsSchema } from '@zero/db/user_settings';

const formSchema = securitySettingsSchema;

export default function SecurityPage() {
  const [isSaving, setIsSaving] = useState(false);
  const { settings, mutate } = useSettings();
  const t = useTranslations();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      twoFactorAuth: false,
      loginNotifications: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings.security);
    }
  }, [form, settings]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);

    try {
      if (!settings) throw new Error('Settings not available');

      await saveUserSettings({security: values});
      await mutate({ ...settings, security: values }, { revalidate: false });
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
        title={t('pages.settings.security.title')}
        description={t('pages.settings.security.description')}
        footer={
          <div className="flex gap-4">
            <Button variant="destructive">{t('pages.settings.security.deleteAccount')}</Button>
            <Button type="submit" form="security-form" disabled={isSaving}>
              {isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form id="security-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex w-full items-center gap-5">
              <FormField
                control={form.control}
                name="twoFactorAuth"
                render={({ field }) => (
                  <FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('pages.settings.security.twoFactorAuth')}
                      </FormLabel>
                      <FormDescription>
                        {t('pages.settings.security.twoFactorAuthDescription')}
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
                name="loginNotifications"
                render={({ field }) => (
                  <FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('pages.settings.security.loginNotifications')}
                      </FormLabel>
                      <FormDescription>
                        {t('pages.settings.security.loginNotificationsDescription')}
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
