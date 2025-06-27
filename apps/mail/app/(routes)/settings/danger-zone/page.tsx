import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem } from '@/components/ui/form';
import { SettingsCard } from '@/components/settings/settings-card';
import { useSession, signOut } from '@/lib/auth-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslations } from 'use-intl';
import { useForm } from 'react-hook-form';
import { clear } from 'idb-keyval';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const CONFIRMATION_TEXT = 'DELETE';

const formSchema = z.object({
  confirmText: z.string().refine((val) => val === CONFIRMATION_TEXT, {
    message: `Please type ${CONFIRMATION_TEXT} to confirm`,
  }),
});

function DeleteAccountDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { refetch } = useSession();
  const { mutateAsync: deleteAccount, isPending } = useMutation(trpc.user.delete.mutationOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      confirmText: '' as 'DELETE',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.confirmText !== CONFIRMATION_TEXT)
      return toast.error(`Please type ${CONFIRMATION_TEXT} to confirm`);

    await deleteAccount(void 0, {
      onSuccess: async ({ success, message }) => {
        if (!success) return toast.error(message);
        try {
          await signOut();
          refetch();
          await clear();
        } catch (error) {
          console.error('Failed to delete account:', error);
          toast.error('Failed to delete account');
        }
        toast.success('Account deleted successfully');
        window.location.href = '/';
      },
      onError: (error) => {
        console.error('Failed to delete account:', error);
        toast.error('Failed to delete account');
      },
      onSettled: () => form.reset(),
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{t('pages.settings.dangerZone.deleteAccount')}</Button>
      </DialogTrigger>
      <DialogContent showOverlay>
        <DialogHeader>
          <DialogTitle>{t('pages.settings.dangerZone.title')}</DialogTitle>
          <DialogDescription>{t('pages.settings.dangerZone.description')}</DialogDescription>
        </DialogHeader>

        <div className="border-destructive/50 bg-destructive/10 mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('pages.settings.dangerZone.warning')}</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-2">
            <FormField
              control={form.control}
              name="confirmText"
              render={({ field }) => (
                <FormItem>
                  <FormDescription>{t('pages.settings.dangerZone.confirmation')}</FormDescription>
                  <FormControl>
                    <Input placeholder="DELETE" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending
                  ? t('pages.settings.dangerZone.deleting')
                  : t('pages.settings.dangerZone.deleteAccount')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function DangerPage() {
  const t = useTranslations();

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.dangerZone.title')}
        description={t('pages.settings.dangerZone.description')}
      >
        <DeleteAccountDialog />
      </SettingsCard>
    </div>
  );
}
