'use client';

import { Form } from '@/components/ui/form';
import { SettingsCard } from '@/components/settings/settings-card';
import { ModeToggle } from '@/components/theme/theme-switcher';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import * as z from 'zod';
import { useSettings } from '@/hooks/use-settings';
import { saveUserSettings } from '@/actions/settings';
import { toast } from 'sonner';
import { appearanceSettingsSchema } from '@zero/db/user_settings';

// TODO: More customization options
const formSchema = appearanceSettingsSchema;

export default function AppearancePage() {
  const [isSaving, setIsSaving] = useState(false);
  const { settings, mutate } = useSettings();
  const t = useTranslations();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inboxType: 'default',
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings.appearance);
    }
  }, [form, settings]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);

    try {
      if (!settings) throw new Error('Settings not available');

      await saveUserSettings({appearance: values});
      await mutate({ ...settings, appearance: values }, { revalidate: false });
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
              <div className="space-y-2">
                <Label>{t('pages.settings.appearance.theme')}</Label>
                <ModeToggle className="bg-popover w-36" />
              </div>
            </div>
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
