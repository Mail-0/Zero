import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  SettingsGroup,
  primaryButton,
  rowClass,
  rowTitle,
} from '@/components/settings/settings-ui';
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
import { cn } from '@/lib/utils';
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

  const themes = [
    { value: 'light', label: m['common.themes.light'](), icon: Sun },
    { value: 'dark', label: m['common.themes.dark'](), icon: Moon },
    { value: 'system', label: m['common.themes.system'](), icon: Laptop },
  ] as const;

  return (
    <SettingsCard
      title={m['pages.settings.appearance.title']()}
      description={m['pages.settings.appearance.description']()}
      footer={
        <Button type="submit" form="appearance-form" disabled={isSaving} className={primaryButton}>
          {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
        </Button>
      }
    >
      <Form {...form}>
        <form id="appearance-form" onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsGroup>
            <FormField
              control={form.control}
              name="colorTheme"
              render={() => (
                <FormItem className={cn(rowClass, 'flex-wrap')}>
                  <FormLabel className={cn(rowTitle, 'flex-1')}>
                    {m['pages.settings.appearance.theme']()}
                  </FormLabel>
                  <FormControl>
                    <div
                      role="radiogroup"
                      className="bg-muted flex shrink-0 items-center gap-0.5 rounded-lg p-0.5 dark:bg-[#202020]"
                    >
                      {themes.map(({ value, label, icon: Icon }) => {
                        const selected = theme === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => handleThemeChange(value)}
                            className={cn(
                              'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors',
                              selected
                                ? 'text-foreground bg-white shadow-xs dark:bg-[#313131]'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <Icon className="size-3.5" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroup>
        </form>
      </Form>
    </SettingsCard>
  );
}
