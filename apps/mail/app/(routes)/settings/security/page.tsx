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
import { m } from '@/paraglide/messages';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import * as z from 'zod';

const formSchema = z.object({
  twoFactorAuth: z.boolean(),
  loginNotifications: z.boolean(),
});

export default function SecurityPage() {
  const [isSaving, setIsSaving] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Fetch current user settings
  const { data: settingsData, isLoading } = useQuery(trpc.settings.get.queryOptions());
  
  // Save settings mutation
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      twoFactorAuth: false,
      loginNotifications: true,
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settingsData?.settings) {
      form.reset({
        twoFactorAuth: settingsData.settings.twoFactorAuth,
        loginNotifications: settingsData.settings.loginNotifications,
      });
    }
  }, [settingsData, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    const saved = settingsData?.settings ? { ...settingsData.settings } : undefined;

    try {
      // Optimistically update the UI
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater: any) => {
        if (!updater) return;
        return { settings: { ...updater.settings, ...values } };
      });

      await saveUserSettings({
        twoFactorAuth: values.twoFactorAuth,
        loginNotifications: values.loginNotifications,
      });
      
      toast.success(m['common.settings.saved']());
    } catch (error) {
      console.error('Failed to save security settings:', error);
      toast.error(m['common.settings.failedToSave']());
      
      // Revert optimistic update on error
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater: any) => {
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
        title={m['pages.settings.security.title']()}
        description={m['pages.settings.security.description']()}
        footer={
          <div className="flex gap-4">
            <Button variant="destructive">{m['pages.settings.security.deleteAccount']()}</Button>
            <Button type="submit" form="security-form" disabled={isSaving || isLoading}>
              {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form id="security-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex w-full flex-col items-center gap-5 md:flex-row">
              <FormField
                control={form.control}
                name="twoFactorAuth"
                render={({ field }) => (
                  <FormItem className="bg-popover flex w-full flex-row items-center justify-between rounded-lg border p-4 md:w-auto">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                      {m['pages.settings.security.twoFactorAuth']()}
                      </FormLabel>
                      <FormDescription>
                      {m['pages.settings.security.twoFactorAuthDescription']()}
                      </FormDescription>
                    </div>
                    <FormControl className="ml-4">
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="loginNotifications"
                render={({ field }) => (
                  <FormItem className="bg-popover flex w-full flex-row items-center justify-between rounded-lg border p-4 md:w-auto">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                      {m['pages.settings.security.loginNotifications']()}
                      </FormLabel>
                      <FormDescription>
                      {m['pages.settings.security.loginNotificationsDescription']()}
                      </FormDescription>
                    </div>
                    <FormControl className="ml-4">
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
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