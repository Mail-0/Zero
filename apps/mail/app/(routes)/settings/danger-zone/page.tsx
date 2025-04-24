'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { deleteUser } from '@/actions/user';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
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
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      confirmText: '' as 'DELETE',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsDeleting(true);
    try {
      const { success, message } = await deleteUser();
      if (!success) {
        toast.error(message);
        return;
      }
      toast.success('Account deleted successfully');
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error('Failed to delete account');
    } finally {
      setIsDeleting(false);
      form.reset();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{t('pages.settings.danger-zone.deleteAccount')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.settings.danger-zone.title')}</DialogTitle>
          <DialogDescription>{t('pages.settings.danger-zone.description')}</DialogDescription>
        </DialogHeader>

        <div className="border-destructive/50 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('pages.settings.danger-zone.warning')}</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="confirmText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmation</FormLabel>
                  <FormDescription>{t('pages.settings.danger-zone.confirmation')}</FormDescription>
                  <FormControl>
                    <Input placeholder="DELETE" {...field} className="max-w-[200px]" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting
                  ? t('pages.settings.danger-zone.deleting')
                  : t('pages.settings.danger-zone.deleteAccount')}
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
        title={t('pages.settings.danger-zone.title')}
        description={t('pages.settings.danger-zone.description')}
      >
        <DeleteAccountDialog />
      </SettingsCard>
    </div>
  );
}
