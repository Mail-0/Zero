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
import { AlertTriangle, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      confirmText: '' as 'DELETE',
    },
  });

  async function onSubmit() {
    setIsDeleting(true);
    try {
      toast.promise(deleteUser(), {
        loading: t('pages.settings.dangerZone.deleting'),
        success: t('pages.settings.dangerZone.deleted'),
        error: t('pages.settings.dangerZone.error'),
        async finally() {
          await signOut();
          router.push('/');
        },
      });
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{t('pages.settings.dangerZone.deleteAccount')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.settings.dangerZone.title')}</DialogTitle>
          <DialogDescription>{t('pages.settings.dangerZone.description')}</DialogDescription>
        </DialogHeader>

        <div className="border-destructive/50 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('pages.settings.dangerZone.warning')}</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="confirmText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmation</FormLabel>
                  <FormDescription>{t('pages.settings.dangerZone.confirmation')}</FormDescription>
                  <FormControl>
                    <Input placeholder="DELETE" {...field} className="max-w-[200px]" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting
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
