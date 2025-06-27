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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { Bell } from 'lucide-react';
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
        title="Notifications"
        description="Choose what notifications you want to receive."
        footer={
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Reset to Defaults
            </Button>
            <Button type="submit" form="notifications-form" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form
            id="notifications-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="newMailNotifications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Mail Notifications</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-[240px]">
                        <Bell className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Select notification level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="important">Important Only</SelectItem>
                      <SelectItem value="all">All Messages</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose which messages you want to receive notifications for
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="marketingCommunications"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Marketing Communications</FormLabel>
                    <FormDescription>Receive updates about new features</FormDescription>
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
