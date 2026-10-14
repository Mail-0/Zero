import {
  SettingsGroup,
  iconButton,
  primaryButton,
  rowClass,
  rowDescription,
  rowDivider,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingsCard } from '@/components/settings/settings-card';
import { userSettingsSchema } from '@zero/server/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
// import { saveUserSettings } from '@/actions/settings';
import { useSettings } from '@/hooks/use-settings';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as z from 'zod';

export default function PrivacyPage() {
  const [isSaving, setIsSaving] = useState(false);
  const { data, refetch } = useSettings();
  const trpc = useTRPC();
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());

  const form = useForm<z.infer<typeof userSettingsSchema>>({
    resolver: zodResolver(userSettingsSchema),
  });

  const externalImages = data?.settings.externalImages;
  useEffect(() => {
    if (data) {
      form.reset({
        ...data.settings,
        trustedSenders: data.settings.trustedSenders,
        externalImages: !!data.settings.externalImages,
      });
    }
  }, [form, data]);

  async function onSubmit(values: z.infer<typeof userSettingsSchema>) {
    if (data) {
      setIsSaving(true);
      toast.promise(
        saveUserSettings({
          ...data.settings,
          ...values,
        }),
        {
          success: m['common.settings.saved'](),
          error: m['common.settings.failedToSave'](),
          finally: async () => {
            await refetch();
            setIsSaving(false);
          },
        },
      );
    }
  }

  return (
    <SettingsCard
      title={m['pages.settings.privacy.title']()}
      description={m['pages.settings.privacy.description']()}
      footer={
        <Button type="submit" form="privacy-form" disabled={isSaving} className={primaryButton}>
          {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
        </Button>
      }
    >
      <Form {...form}>
        <form id="privacy-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <SettingsGroup>
            <FormField
              control={form.control}
              name="externalImages"
              render={({ field }) => (
                <FormItem className={rowClass}>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <FormLabel className={rowTitle}>
                      {m['pages.settings.privacy.externalImages']()}
                    </FormLabel>
                    <FormDescription className={rowDescription}>
                      {m['pages.settings.privacy.externalImagesDescription']()}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </SettingsGroup>
          <FormField
            control={form.control}
            name="trustedSenders"
            render={({ field }) =>
              (field.value?.length || 0) > 0 && !externalImages ? (
                <FormItem className="space-y-3">
                  <div className="space-y-0.5">
                    <FormLabel className={rowTitle}>
                      {m['pages.settings.privacy.trustedSenders']()}
                    </FormLabel>
                    <FormDescription className={rowDescription}>
                      {m['pages.settings.privacy.trustedSendersDescription']()}
                    </FormDescription>
                  </div>
                  <SettingsGroup>
                    <div className={cn(rowDivider, 'max-h-64 overflow-y-auto')}>
                      {field.value?.map((senderEmail) => (
                        <div
                          key={senderEmail}
                          className="flex items-center justify-between gap-3 px-4 py-2"
                        >
                          <span className="truncate text-[13px]">{senderEmail}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                className={iconButton}
                                aria-label={m['common.actions.remove']()}
                                onClick={() =>
                                  field.onChange(field.value?.filter((e) => e !== senderEmail))
                                }
                              >
                                <XIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{m['common.actions.remove']()}</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </SettingsGroup>
                </FormItem>
              ) : (
                <></>
              )
            }
          />
        </form>
      </Form>
    </SettingsCard>
  );
}
