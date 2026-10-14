import {
  SettingsGroup,
  primaryButton,
  rowClass,
  rowDescription,
  rowTitle,
  selectTrigger,
  subtleButton,
} from '@/components/settings/settings-ui';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
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
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import * as z from 'zod';

const formSchema = z.object({
  newMailNotifications: z.enum(['none', 'important', 'all']),
  marketingCommunications: z.boolean(),
});

export default function NotificationsPage() {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newMailNotifications: 'all',
      marketingCommunications: false,
    },
  });

  function onSubmit() {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  }

  return (
    <SettingsCard
      title="Notifications"
      description="Choose what notifications you want to receive."
      footer={
        <div className="flex w-full justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className={subtleButton}
            onClick={() => form.reset()}
          >
            Reset to Defaults
          </Button>
          <Button
            type="submit"
            form="notifications-form"
            disabled={isSaving}
            className={primaryButton}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id="notifications-form" onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsGroup>
            <FormField
              control={form.control}
              name="newMailNotifications"
              render={({ field }) => (
                <FormItem
                  className={cn(rowClass, 'flex-col items-stretch md:flex-row md:items-center')}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <FormLabel className={rowTitle}>New Mail Notifications</FormLabel>
                    <FormDescription className={rowDescription}>
                      Choose which messages you want to receive notifications for
                    </FormDescription>
                  </div>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={selectTrigger}>
                        <div className="flex min-w-0 items-center gap-2 truncate">
                          <Bell className="text-iconLight dark:text-iconDark shrink-0" />
                          <SelectValue placeholder="Select notification level" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none" className="text-[13px]">
                        None
                      </SelectItem>
                      <SelectItem value="important" className="text-[13px]">
                        Important Only
                      </SelectItem>
                      <SelectItem value="all" className="text-[13px]">
                        All Messages
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="marketingCommunications"
              render={({ field }) => (
                <FormItem className={rowClass}>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <FormLabel className={rowTitle}>Marketing Communications</FormLabel>
                    <FormDescription className={rowDescription}>
                      Receive updates about new features
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </SettingsGroup>
        </form>
      </Form>
    </SettingsCard>
  );
}
