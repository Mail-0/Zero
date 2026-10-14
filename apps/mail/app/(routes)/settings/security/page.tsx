import {
  SettingsGroup,
  destructiveButton,
  primaryButton,
  rowClass,
  rowDescription,
  rowTitle,
} from '@/components/settings/settings-ui';
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
import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';

import { useState } from 'react';
import * as z from 'zod';

const formSchema = z.object({
  twoFactorAuth: z.boolean(),
  loginNotifications: z.boolean(),
});

export default function SecurityPage() {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      twoFactorAuth: false,
      loginNotifications: true,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);

    // TODO: Save settings in user's account
    setTimeout(() => {
      console.log(values);
      setIsSaving(false);
    }, 1000);
  }

  const switchRow = (
    name: 'twoFactorAuth' | 'loginNotifications',
    title: string,
    description: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={rowClass}>
          <div className="min-w-0 flex-1 space-y-0.5">
            <FormLabel className={rowTitle}>{title}</FormLabel>
            <FormDescription className={rowDescription}>{description}</FormDescription>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );

  return (
    <SettingsCard
      title={m['pages.settings.security.title']()}
      description={m['pages.settings.security.description']()}
      footer={
        <>
          <Button variant="ghost" className={destructiveButton}>
            {m['pages.settings.security.deleteAccount']()}
          </Button>
          <Button type="submit" form="security-form" disabled={isSaving} className={primaryButton}>
            {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id="security-form" onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsGroup>
            {switchRow(
              'twoFactorAuth',
              m['pages.settings.security.twoFactorAuth'](),
              m['pages.settings.security.twoFactorAuthDescription'](),
            )}
            {switchRow(
              'loginNotifications',
              m['pages.settings.security.loginNotifications'](),
              m['pages.settings.security.loginNotificationsDescription'](),
            )}
          </SettingsGroup>
        </form>
      </Form>
    </SettingsCard>
  );
}
