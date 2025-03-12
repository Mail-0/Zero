'use client';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { SettingsCard } from '@/components/settings/settings-card';
import { ModeToggle } from '@/components/theme/theme-switcher';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import * as z from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquareText } from 'lucide-react';
    
// TODO: More customization options
const formSchema = z.object({
  inboxType: z.enum(['default', 'important', 'unread']),
  threadDisplayStyle: z.enum(['default', 'chat']),
});

export default function AppearancePage() {
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inboxType: 'default',
      threadDisplayStyle: 'default',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    setTimeout(() => {
      console.log(values);
      setIsSaving(false);
    }, 1000);
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
            <FormField
                control={form.control}
                name="threadDisplayStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pages.settings.appearance.threadDisplayStyle')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-36">
                          <MessageSquareText className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Select a language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="default">{t('pages.settings.appearance.threadDisplayStyleOptions.default')}</SelectItem>
                        <SelectItem value="chat">{t('pages.settings.appearance.threadDisplayStyleOptions.chat')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
