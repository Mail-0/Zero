'use client';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { useConnections } from '@/hooks/use-connections';
import { cleanEmailAddresses } from '@/lib/email-utils';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useTRPC } from '@/providers/query-provider';
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { EmailComposer } from './email-composer';
import { useSession } from '@/lib/auth-client';
import { serializeFiles } from '@/lib/schemas';
import { useDraft } from '@/hooks/use-drafts';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';
import { X } from '../icons/icons';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import * as React from 'react';
import './prosemirror.css';

// Define the draft type to include CC and BCC fields
type DraftType = {
  id: string;
  content?: string;
  subject?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
};

// Define the connection type
type Connection = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  createdAt: Date;
};

export function CreateEmail({
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  initialCc = '',
  initialBcc = '',
  draftId: propDraftId,
}: {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  initialCc?: string;
  initialBcc?: string;
  draftId?: string | null;
}) {
  const { data: session } = useSession();
  const { data: connections } = useConnections();
  const { data: aliases } = useEmailAliases();
  const [draftId, setDraftId] = useQueryState('draftId');
  const {
    data: draft,
    isLoading: isDraftLoading,
    error: draftError,
  } = useDraft(draftId ?? propDraftId ?? null);
  const t = useTranslations();
  const [dialogOpen, setDialogOpen] = useState(true);
  const router = useRouter();
  const { enableScope, disableScope } = useHotkeysContext();
  const [isDraftFailed, setIsDraftFailed] = useState(false);
  const trpc = useTRPC();
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());

  // If there was an error loading the draft, set the failed state
  useEffect(() => {
    if (draftError) {
      console.error('Error loading draft:', draftError);
      setIsDraftFailed(true);
      toast.error('Failed to load draft');
    }
  }, [draftError]);

  const activeAccount = useMemo(() => {
    if (!session) return null;
    if (!connections) return null;

    // Properly access the connections array from the data structure
    const connectionsList = connections.connections as Connection[];
    if (!connectionsList || !Array.isArray(connectionsList)) return null;

    return connectionsList.find((connection) => connection.id === session?.activeConnection?.id);
  }, [session, connections]);

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
    // Use the selected from email or the first alias (or default user email)
    const fromEmail = aliases?.[0]?.email ?? userEmail;

    await sendEmail({
      to: data.to.map((email) => ({ email, name: email.split('@')[0] || email })),
      cc: data.cc?.map((email) => ({ email, name: email.split('@')[0] || email })),
      bcc: data.bcc?.map((email) => ({ email, name: email.split('@')[0] || email })),
      subject: data.subject,
      message: data.message,
      attachments: await serializeFiles(data.attachments),
      fromEmail,
      draftId: draftId ?? undefined,
    });

    // Clear draft ID from URL
    await setDraftId(null);

    // Track different email sending scenarios
    if (data.cc && data.cc.length > 0 && data.bcc && data.bcc.length > 0) {
      console.log(posthog.capture('Create Email Sent with CC and BCC'));
    } else if (data.cc && data.cc.length > 0) {
      console.log(posthog.capture('Create Email Sent with CC'));
    } else if (data.bcc && data.bcc.length > 0) {
      console.log(posthog.capture('Create Email Sent with BCC'));
    } else {
      console.log(posthog.capture('Create Email Sent'));
    }

    toast.success(t('pages.createEmail.emailSentSuccessfully'));
  };

  React.useEffect(() => {
    // Enable the compose scope for hotkeys
    enableScope('compose');

    // Register a hotkey for ESC to close the dialog
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDialogOpen(false);
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleEsc);

    // Clean up
    return () => {
      window.removeEventListener('keydown', handleEsc);
      disableScope('compose');
    };
  }, [enableScope, disableScope]);

  React.useEffect(() => {
    if (!dialogOpen) {
      router.push('/mail');
    }
  }, [dialogOpen, router]);

  // If propDraftId is provided, update the URL query parameter
  useEffect(() => {
    if (propDraftId && !draftId) {
      setDraftId(propDraftId);
    }
  }, [propDraftId, draftId, setDraftId]);

  // Process initial email addresses
  const processInitialEmails = (emailStr: string) => {
    if (!emailStr) return [];
    const cleanedAddresses = cleanEmailAddresses(emailStr);
    return cleanedAddresses || [];
  };

  // Cast draft to our extended type that includes CC and BCC
  const typedDraft = draft as unknown as DraftType;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-1">
          <div className="flex w-[750px] justify-start">
            <DialogClose asChild className="flex" onClick={() => setDialogOpen(false)}>
              <button className="bg-muted/40 flex items-center gap-1 rounded-lg px-2 py-1.5">
                <X className="fill-muted-foreground mt-0.5 h-3.5 w-3.5" />
                <span className="text-foreground text-sm font-medium">esc</span>
              </button>
            </DialogClose>
          </div>
          {isDraftLoading ? (
            <div className="flex h-[600px] w-[750px] items-center justify-center rounded-2xl border">
              <div className="text-center">
                <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                <p>Loading draft...</p>
              </div>
            </div>
          ) : (
            <EmailComposer
              key={typedDraft?.id || 'composer'}
              className="mb-12 rounded-2xl border"
              onSendEmail={handleSendEmail}
              initialMessage={typedDraft?.content || initialBody}
              initialTo={
                typedDraft?.to?.map((e: string) => e.replace(/[<>]/g, '')) ||
                processInitialEmails(initialTo)
              }
              initialCc={
                typedDraft?.cc?.map((e: string) => e.replace(/[<>]/g, '')) ||
                processInitialEmails(initialCc)
              }
              initialBcc={
                typedDraft?.bcc?.map((e: string) => e.replace(/[<>]/g, '')) ||
                processInitialEmails(initialBcc)
              }
              initialSubject={typedDraft?.subject || initialSubject}
            />
          )}
        </div>
      </Dialog>
    </>
  );
}
