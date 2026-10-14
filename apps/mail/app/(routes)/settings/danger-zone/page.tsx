import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  IconTile,
  SettingsGroup,
  SettingsRow,
  destructiveButton,
  field as field_,
} from '@/components/settings/settings-ui';
import { Form, FormControl, FormDescription, FormField, FormItem } from '@/components/ui/form';
import { SettingsCard } from '@/components/settings/settings-card';
import { useSession, signOut } from '@/lib/auth-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';
import { clear } from 'idb-keyval';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const CONFIRMATION_TEXT = 'DELETE';

const formSchema = z.object({
  confirmText: z.string().refine((val) => val === CONFIRMATION_TEXT, {
    message: m['pages.settings.dangerZone.confirmation'](),
  }),
});

function DeleteAccountDialog() {
  const [isOpen, setIsOpen] = useState(false);

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
      return toast.error(m['pages.settings.dangerZone.confirmation']());

    await deleteAccount(void 0, {
      onSuccess: async ({ success, message }) => {
        if (!success) return toast.error(message);
        try {
          await signOut();
          refetch();
          await clear();
        } catch (error) {
          console.error('Failed to delete account:', error);
          toast.error(m['pages.settings.dangerZone.error']());
        }
        toast.success(m['pages.settings.dangerZone.deleted']());
        window.location.href = '/';
      },
      onError: (error) => {
        console.error('Failed to delete account:', error);
        toast.error(m['pages.settings.dangerZone.error']());
      },
      onSettled: () => form.reset(),
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className={destructiveButton}>
          {m['pages.settings.dangerZone.deleteAccount']()}
        </Button>
      </DialogTrigger>
      <DialogContent showOverlay className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px]">
            {m['pages.settings.dangerZone.title']()}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {m['pages.settings.dangerZone.description']()}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#FCCDD5] bg-[#FDE4E9] px-3 py-2 text-[13px] text-[#F43F5E] dark:border-[#6E2532] dark:bg-[#411D23]">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{m['pages.settings.dangerZone.warning']()}</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-2">
            <FormField
              control={form.control}
              name="confirmText"
              render={({ field }) => (
                <FormItem>
                  <FormDescription className="text-[13px]">
                    {m['pages.settings.dangerZone.confirmation']()}
                  </FormDescription>
                  <FormControl>
                    <Input placeholder="DELETE" className={cn(field_, 'h-8')} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="ghost"
                className={destructiveButton}
                disabled={isPending}
              >
                {isPending
                  ? m['pages.settings.dangerZone.deleting']()
                  : m['pages.settings.dangerZone.deleteAccount']()}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function DangerPage() {
  return (
    <SettingsCard
      title={m['pages.settings.dangerZone.title']()}
      description={m['pages.settings.dangerZone.description']()}
    >
      <SettingsGroup>
        <SettingsRow
          icon={
            <IconTile className="border-[#FCCDD5] bg-[#FDE4E9] text-[#F43F5E] dark:border-[#6E2532] dark:bg-[#411D23] dark:text-[#F43F5E]">
              <AlertTriangle />
            </IconTile>
          }
          title={m['pages.settings.dangerZone.deleteAccount']()}
          description={m['pages.settings.dangerZone.warning']()}
        >
          <DeleteAccountDialog />
        </SettingsRow>
      </SettingsGroup>
    </SettingsCard>
  );
}
