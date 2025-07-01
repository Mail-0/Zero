import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useSettings } from '@/hooks/use-settings';
import { Laptop, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const formSchema = z.object({
  colorTheme: z.enum(['dark', 'light', 'system', '']),
});

type Theme = 'dark' | 'light' | 'system';

export default function AppearancePage() {
  const [isSaving, setIsSaving] = useState(false);

  const { data, refetch } = useSettings();
  const { theme, systemTheme, resolvedTheme, setTheme } = useTheme();
  const trpc = useTRPC();
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      colorTheme: data?.settings.colorTheme || (theme as Theme),
    },
  });

  async function handleThemeChange(newTheme: string) {
    let nextResolvedTheme = newTheme;

    if (newTheme === 'system' && systemTheme) {
      nextResolvedTheme = systemTheme;
    }

    function update() {
      setTheme(newTheme);
      form.setValue('colorTheme', newTheme as z.infer<typeof formSchema>['colorTheme']);
    }

    if (document.startViewTransition && nextResolvedTheme !== resolvedTheme) {
      document.documentElement.style.viewTransitionName = 'theme-transition';
      await document.startViewTransition(update).finished;
      document.documentElement.style.viewTransitionName = '';
    } else {
      update();
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (data) {
      setIsSaving(true);
      toast.promise(
        saveUserSettings({
          ...data.settings,
          colorTheme: values.colorTheme as Theme,
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

  if (!data?.settings) return null;

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={m['pages.settings.appearance.title']()}
        description={m['pages.settings.appearance.description']()}
        footer={
          <Button type="submit" form="appearance-form" disabled={isSaving}>
            {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
          </Button>
        }
      >
        <Form {...form}>
          <form id="appearance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <div className="max-w-sm space-y-2">
                {data.settings.colorTheme || theme ? (
                  <FormField
                    control={form.control}
                    name="colorTheme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{m['pages.settings.appearance.theme']()}</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              handleThemeChange(value);
                            }}
                            defaultValue={form.getValues().colorTheme}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select theme">
                                <div className="flex items-center gap-2 capitalize">
                                  {theme === 'dark' && <Moon className="h-4 w-4" />}
                                  {theme === 'light' && <Sun className="h-4 w-4" />}
                                  {theme === 'system' && <Laptop className="h-4 w-4" />}
                                  {m[`common.themes.${theme as 'dark' | 'light' | 'system'}`]()}
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dark">
                                <div className="flex items-center gap-2">
                                  <Moon className="h-4 w-4" />
                                  {m['common.themes.dark']()}
                                </div>
                              </SelectItem>
                              <SelectItem value="system">
                                <div className="flex items-center gap-2">
                                  <Laptop className="h-4 w-4" />
                                  {m['common.themes.system']()}
                                </div>
                              </SelectItem>
                              <SelectItem value="light">
                                <div className="flex items-center gap-2">
                                  <Sun className="h-4 w-4" />
                                  {m['common.themes.light']()}
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            </div>
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
