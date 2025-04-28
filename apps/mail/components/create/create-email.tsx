'use client';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { useConnections } from '@/hooks/use-connections';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { DialogClose } from '@/components/ui/dialog';
import { useSettings } from '@/hooks/use-settings';
import { EmailComposer } from './email-composer';
import { useSession } from '@/lib/auth-client';
import { useDraft } from '@/hooks/use-drafts';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import { useQueryState } from 'nuqs';
import { X } from '../icons/icons';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import * as React from 'react';
import './prosemirror.css';

export function CreateEmail({
  initialTo = '',
  initialSubject = '',
  initialBody = '',
}: {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}) {
  const { data: session } = useSession();
  const { data: connections } = useConnections();
  const { aliases, isLoading: isLoadingAliases } = useEmailAliases();
  const [draftId, setDraftId] = useQueryState('draftId');
  const [composeOpen, setComposeOpen] = useQueryState('isComposeOpen');

  const activeAccount = React.useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.activeConnection?.id);
  }, [session, connections]);

  const userName =
    activeAccount?.name || session?.activeConnection?.name || session?.user?.name || '';
  const userEmail =
    activeAccount?.email || session?.activeConnection?.email || session?.user?.email || '';

  const handleSendEmail = async (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
  }) => {
    try {
      // Use the selected from email or the first alias (or default user email)
      const fromEmail = aliases?.[0]?.email ?? userEmail;

      await sendEmail({
        to: data.to.map((email) => ({ email, name: email.split('@')[0] || email })),
        cc: data.cc?.map((email) => ({ email, name: email.split('@')[0] || email })),
        bcc: data.bcc?.map((email) => ({ email, name: email.split('@')[0] || email })),
        subject: data.subject,
        message: data.message,
        attachments: data.attachments,
        fromEmail: fromEmail,
        draftId: draftId || undefined,
      });

      // Track different email sending scenarios
      if (data.cc && data.bcc) {
        console.log(posthog.capture('Create Email Sent with CC and BCC'));
      } else if (data.cc) {
        console.log(posthog.capture('Create Email Sent with CC'));
      } else if (data.bcc) {
        console.log(posthog.capture('Create Email Sent with BCC'));
      } else {
        console.log(posthog.capture('Create Email Sent'));
      }

      toast.success(t('pages.createEmail.emailSentSuccessfully'));
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    }
  };

  const t = useTranslations();

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center gap-1">
        <div className="flex w-[750px] justify-start">
          <DialogClose asChild className="flex">
            <button className="flex items-center gap-1 rounded-lg bg-[#F0F0F0] px-2 py-1.5 dark:bg-[#1A1A1A]">
              <X className="mt-0.5 h-3.5 w-3.5 fill-[#6D6D6D] dark:fill-[#929292]" />
              <span className="text-sm font-medium text-[#6D6D6D] dark:text-white">esc</span>
            </button>
          </DialogClose>
        </div>
        <EmailComposer className="mb-12 rounded-2xl border" onSendEmail={handleSendEmail} />
      </div>
    </>
  );
}
