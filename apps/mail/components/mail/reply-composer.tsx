import { useUndoSend, deserializeFiles, type EmailData, type ReplyMode, type UndoContext } from '@/hooks/use-undo-send';
import { constructReplyBody, constructForwardBody } from '@/lib/utils';
import { useActiveConnection } from '@/hooks/use-connections';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { EmailComposer } from '../create/email-composer';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useSettings } from '@/hooks/use-settings';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { serializeFiles } from '@/lib/schemas';
import { useDraft } from '@/hooks/use-drafts';
import { m } from '@/paraglide/messages';
import type { Sender } from '@/types';
import { useQueryState } from 'nuqs';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import posthog from 'posthog-js';
import { toast } from 'sonner';

interface ReplyComposeProps {
  messageId?: string;
}

export default function ReplyCompose({ messageId }: ReplyComposeProps) {
  const [mode, setMode] = useQueryState('mode');
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: aliases } = useEmailAliases();

  const [draftId, setDraftId] = useQueryState('draftId');
  const [threadId] = useQueryState('threadId');
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const { data: emailData, refetch, latestDraft } = useThread(threadId);
  const { data: draft } = useDraft(draftId ?? null);
  const trpc = useTRPC();
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());
  const { data: activeConnection } = useActiveConnection();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: session } = useSession();
  const { handleUndoSend } = useUndoSend();

  // Find the specific message to reply to
  const replyToMessage =
    (messageId && emailData?.messages.find((msg) => msg.id === messageId)) || emailData?.latest;

  const undoReplyRaw = useSyncExternalStore(
    (listener) => {
      if (typeof window === 'undefined') return () => {};
      const handler = () => listener();
      window.addEventListener('storage', handler);
      window.addEventListener('zero:undoReplyEmailData', handler as EventListener);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('zero:undoReplyEmailData', handler as EventListener);
      };
    },
    () => {
      try {
        return typeof window !== 'undefined'
          ? window.localStorage.getItem('undoReplyEmailData')
          : null;
      } catch {
        return null;
      }
    },
    () => null,
  );

  const undoReplyEmailData = useMemo((): EmailData | null => {
    if (!mode) return null;
    if (!undoReplyRaw) return null;
    try {
      const parsed = JSON.parse(undoReplyRaw);
      const ctx = parsed?.__replyContext as
        | { threadId: string; activeReplyId: string; mode: string; draftId?: string | null }
        | undefined;

      const currentThread = threadId || replyToMessage?.threadId || '';
      const currentReply = messageId || activeReplyId || replyToMessage?.id || '';
      const matches = !!ctx && ctx.threadId === currentThread && ctx.activeReplyId === currentReply;
      if (!matches) return null;

      if (parsed.attachments && Array.isArray(parsed.attachments)) {
        parsed.attachments = deserializeFiles(parsed.attachments);
      }
      return parsed as EmailData;
    } catch (err) {
      console.error('Failed to parse undo reply email data:', err);
      return null;
    }
  }, [undoReplyRaw, mode, threadId, messageId, activeReplyId, replyToMessage?.id, replyToMessage?.threadId]);

  const { defaultTo, defaultCc, defaultSubject } = useMemo(() => {
    const result = { defaultTo: [] as string[], defaultCc: [] as string[], defaultSubject: '' };
    if (!replyToMessage || !mode || !activeConnection?.email) {
      return result;
    }

    const userEmail = activeConnection.email.toLowerCase();
    const senderEmail = replyToMessage.sender.email.toLowerCase();

    const baseSubject = replyToMessage.subject || '';
    const lower = baseSubject.trim().toLowerCase();
    const hasRePrefix = lower.startsWith('re:');
    const hasFwdPrefix = lower.startsWith('fwd:') || lower.startsWith('fw:');
    if (mode === 'forward') {
      result.defaultSubject = hasFwdPrefix ? baseSubject : `Fwd: ${baseSubject}`.trim();
    } else {
      result.defaultSubject = hasRePrefix ? baseSubject : `Re: ${baseSubject}`.trim();
    }

    if (mode === 'reply') {
      if (senderEmail !== userEmail) {
        result.defaultTo.push(replyToMessage.sender.email);
      } else if (replyToMessage.to && replyToMessage.to.length > 0 && replyToMessage.to[0]?.email) {
        result.defaultTo.push(replyToMessage.to[0].email);
      }
      return result;
    }

    if (mode === 'replyAll') {
      const seen = new Set<string>();

      const pushIfNew = (email: string, target: 'to' | 'cc') => {
        const key = email.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        if (target === 'to') {
          result.defaultTo.push(email);
        } else {
          result.defaultCc.push(email);
        }
      };

      // Add original sender if not current user
      if (senderEmail !== userEmail) {
        pushIfNew(replyToMessage.sender.email, 'to');
      }

      // Add original recipients from To field
      replyToMessage.to?.forEach((recipient) => {
        const recipientEmail = recipient.email;
        const key = recipientEmail.toLowerCase();
        if (key !== userEmail && key !== senderEmail) {
          pushIfNew(recipientEmail, 'to');
        }
      });

      // Add CC recipients
      replyToMessage.cc?.forEach((recipient) => {
        const recipientEmail = recipient.email;
        const key = recipientEmail.toLowerCase();
        if (key !== userEmail) {
          pushIfNew(recipientEmail, 'cc');
        }
      });

      return result;
    }

    return result;
  }, [mode, replyToMessage, activeConnection?.email]);

  const handleSendEmail = async (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
    scheduleAt?: string;
  }) => {
    if (!replyToMessage || !activeConnection?.email) return;

    try {
      const userEmail = activeConnection.email.toLowerCase();
      const userName = activeConnection.name || session?.user?.name || '';

      let fromEmail = userEmail;

      if (aliases && aliases.length > 0 && replyToMessage) {
        const allRecipients = [
          ...(replyToMessage.to || []),
          ...(replyToMessage.cc || []),
          ...(replyToMessage.bcc || []),
        ];
        const matchingAlias = aliases.find((alias) =>
          allRecipients.some(
            (recipient) => recipient.email.toLowerCase() === alias.email.toLowerCase(),
          ),
        );

        if (matchingAlias) {
          fromEmail = userName.trim()
            ? `${userName.replace(/[<>]/g, '')} <${matchingAlias.email}>`
            : matchingAlias.email;
        } else {
          const primaryEmail =
            aliases.find((alias) => alias.primary)?.email || aliases[0]?.email || userEmail;
          fromEmail = userName.trim()
            ? `${userName.replace(/[<>]/g, '')} <${primaryEmail}>`
            : primaryEmail;
        }
      }

      const toRecipients: Sender[] = data.to.map((email) => ({
        email,
        name: email.split('@')[0] || 'User',
      }));

      const ccRecipients: Sender[] | undefined = data.cc
        ? data.cc.map((email) => ({
            email,
            name: email.split('@')[0] || 'User',
          }))
        : undefined;

      const bccRecipients: Sender[] | undefined = data.bcc
        ? data.bcc.map((email) => ({
            email,
            name: email.split('@')[0] || 'User',
          }))
        : undefined;

      const zeroSignature = settings?.settings.zeroSignature
        ? '<p style="color: #666; font-size: 12px;">Sent via <a href="https://0.email/" style="color: #0066cc; text-decoration: none;">Zero</a></p>'
        : '';

      const emailBody =
        mode === 'forward'
          ? constructForwardBody(
              data.message + zeroSignature,
              new Date(replyToMessage.receivedOn || '').toLocaleString(),
              { ...replyToMessage.sender, subject: replyToMessage.subject },
              toRecipients,
              //   replyToMessage.decodedBody,
            )
          : constructReplyBody(
              data.message + zeroSignature,
              new Date(replyToMessage.receivedOn || '').toLocaleString(),
              replyToMessage.sender,
              toRecipients,
              //   replyToMessage.decodedBody,
            );

      const result = await sendEmail({
        to: toRecipients,
        cc: ccRecipients,
        bcc: bccRecipients,
        subject: data.subject,
        message: emailBody,
        attachments: await serializeFiles(data.attachments),
        fromEmail: fromEmail,
        draftId: draftId ?? undefined,
        headers: {
          'In-Reply-To': replyToMessage?.messageId ?? '',
          References: [
            ...(replyToMessage?.references ? replyToMessage.references.split(' ') : []),
            replyToMessage?.messageId,
          ]
            .filter(Boolean)
            .join(' '),
          'Thread-Id': replyToMessage?.threadId ?? '',
        },
        threadId: replyToMessage?.threadId,
        isForward: mode === 'forward',
        originalMessage: replyToMessage.decodedBody,
        scheduleAt: data.scheduleAt,
      });

      posthog.capture('Reply Email Sent');

      // Reset states
      setMode(null);
      await refetch();
      
      handleUndoSend(result, settings, {
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        message: data.message,
        attachments: data.attachments,
        scheduleAt: data.scheduleAt,
      }, {
        kind: 'reply',
        threadId: replyToMessage.threadId || threadId || '',
        mode: (mode ?? 'reply') as ReplyMode,
        activeReplyId: replyToMessage.id,
        draftId,
      } satisfies UndoContext);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(m['pages.createEmail.failedToSendEmail']());
    }
  };

  useEffect(() => {
    if (mode) {
      enableScope('compose');
    } else {
      disableScope('compose');
    }
    return () => {
      disableScope('compose');
    };
  }, [mode, enableScope, disableScope]);

  const ensureEmailArray = (emails: string | string[] | undefined | null): string[] => {
    if (!emails) return [];
    if (Array.isArray(emails)) {
      return emails.map((email) => email.trim().replace(/[<>]/g, ''));
    }
    if (typeof emails === 'string') {
      return emails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .map((email) => email.replace(/[<>]/g, ''));
    }
    return [];
  };

  if (!mode || !emailData) return null;

  return (
    <div className="w-full rounded-2xl overflow-visible border">
      <EmailComposer
        key={draftId || replyToMessage?.id || 'reply-composer'}
        editorClassName="min-h-[50px]"
        className="w-full max-w-none! pb-1 overflow-visible"
        onSendEmail={handleSendEmail}
        onClose={async () => {
          setMode(null);
          setDraftId(null);
          setActiveReplyId(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('undoReplyEmailData');
          }
        }}
        initialMessage={undoReplyEmailData?.message ?? draft?.content ?? latestDraft?.decodedBody}
        initialTo={
          undoReplyEmailData?.to ??
          (ensureEmailArray(draft?.to).length ? ensureEmailArray(draft?.to) : defaultTo)
        }
        initialCc={
          undoReplyEmailData?.cc ??
          (ensureEmailArray(draft?.cc).length ? ensureEmailArray(draft?.cc) : defaultCc)
        }
        initialBcc={undoReplyEmailData?.bcc ?? ensureEmailArray(draft?.bcc)}
        initialSubject={undoReplyEmailData?.subject ?? draft?.subject ?? defaultSubject}
        initialAttachments={undoReplyEmailData?.attachments}
        autofocus={true}
        settingsLoading={settingsLoading}
        replyingTo={replyToMessage?.sender.email}
      />
    </div>
  );
}
