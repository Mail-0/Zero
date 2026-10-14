import {
  buildForwardedOriginal,
  buildNameDirectory,
  buildQuotedOriginal,
  buildReplyRecipients,
  buildReplySubject,
  isInlineAttachment,
  isReplyMode,
  parseAddressList,
  pickFromAddress,
  pickResumableDraft,
  stripQuotedOriginal,
  toSender,
  type ReplyMode,
} from '@/lib/reply';
import { useActiveConnection } from '@/hooks/use-connections';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { EmailComposer } from '../create/email-composer';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useTRPC } from '@/providers/query-provider';
import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { serializeFiles } from '@/lib/schemas';
import { useDraft } from '@/hooks/use-drafts';
import type { ParsedMessage } from '@/types';
import { m } from '@/paraglide/messages';
import { useQueryState } from 'nuqs';
import posthog from 'posthog-js';
import { toast } from 'sonner';

/** How long a reply waits before it actually goes out, so it can be undone. */
const UNDO_SEND_MS = 5000;
/** Don't hold the composer back forever if aliases are slow; fall back to the account address. */
const ALIAS_WAIT_MS = 1500;

/** Content of a reply whose send was undone or failed, so reopening the composer restores it. */
interface RestoreStash {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  message: string;
  attachments: File[];
  fromEmail?: string;
  draftId?: string | null;
  removedForwardKeys: string[];
}
const restoreStash = new Map<string, RestoreStash>();

let pendingSends = 0;
const warnIfSending = (e: BeforeUnloadEvent) => {
  if (pendingSends > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
};

const draftAttachmentsToFiles = (
  attachments: { filename: string; mimeType: string; body: string }[] | undefined,
): File[] =>
  (attachments ?? []).flatMap((att) => {
    if (!att.body) return [];
    try {
      const bytes = Uint8Array.from(atob(att.body), (c) => c.charCodeAt(0));
      return [new File([bytes], att.filename, { type: att.mimeType })];
    } catch (error) {
      console.error('Failed to restore draft attachment', att.filename, error);
      return [];
    }
  });

const addressesOf = (value: string | string[] | undefined | null): string[] => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((entry) => parseAddressList(entry).map((s) => s.email));
};

interface ReplyComposeProps {
  messageId?: string;
}

export default function ReplyCompose({ messageId }: ReplyComposeProps) {
  const [mode] = useQueryState('mode');
  const [draftId, setDraftId] = useQueryState('draftId');
  const [threadId] = useQueryState('threadId');
  const { data: emailData, drafts } = useThread(threadId);
  const aliasesQuery = useEmailAliases();
  const { enableScope, disableScope } = useHotkeysContext();
  const trpc = useTRPC();

  const replyMode = isReplyMode(mode) ? mode : null;
  const replyToMessage =
    (messageId && emailData?.messages.find((msg) => msg.id === messageId)) || emailData?.latest;

  // If the thread already has a draft for this reply, resume it instead of starting a second
  // one. Thread messages only carry the draft's *message* id, so ask the server for draft ids.
  const resumable =
    !draftId && replyMode && replyToMessage
      ? pickResumableDraft(
          drafts as ParsedMessage[],
          replyToMessage,
          replyMode,
          replyToMessage.id === emailData?.latest?.id,
        )
      : undefined;
  const threadDraftsQuery = useQuery(
    trpc.drafts.forThread.queryOptions(
      { threadId: threadId ?? '' },
      { enabled: !!threadId && !!resumable, staleTime: 30_000 },
    ),
  );
  const resumeDraftId = resumable
    ? threadDraftsQuery.data?.find((d) => d.messageId === resumable.id)?.draftId
    : undefined;
  // Load the full draft (including attachment contents) for both an explicit draftId and a
  // resumed one; thread messages only have attachment metadata, and autosaving without the
  // files would strip them from the draft.
  const draftQuery = useDraft(draftId ?? resumeDraftId ?? null);

  useEffect(() => {
    if (replyMode) enableScope('compose');
    else disableScope('compose');
    return () => disableScope('compose');
  }, [replyMode, enableScope, disableScope]);

  // Wait (briefly) for aliases so reply-all can strip every one of your own addresses, and for
  // an existing draft so we open it instead of a blank reply. Once shown, never unmount again
  // just because a query refetches - that's what used to wipe text mid-typing.
  const [aliasWaitOver, setAliasWaitOver] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAliasWaitOver(true), ALIAS_WAIT_MS);
    return () => clearTimeout(t);
  }, []);
  const aliasesReady = aliasesQuery.isFetched || aliasesQuery.isError || aliasWaitOver;
  const draftReady = !(draftId ?? resumeDraftId) || !draftQuery.isLoading;
  const threadDraftsReady =
    !resumable || threadDraftsQuery.isFetched || threadDraftsQuery.isError || aliasWaitOver;
  const ready = !!replyMode && !!replyToMessage && aliasesReady && draftReady && threadDraftsReady;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (ready) setShown(true);
  }, [ready]);

  if (!replyMode || !emailData || !replyToMessage) return null;
  // Never open a blank composer on top of an existing draft id: the first autosave would
  // overwrite the draft with the empty reply.
  if (draftId && draftQuery.isError && !shown) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
        <span className="text-[#8C8C8C]">Couldn&apos;t load this draft.</span>
        <div className="flex gap-2">
          <Button size="xs" variant="secondary" onClick={() => void draftQuery.refetch()}>
            Retry
          </Button>
          <Button size="xs" variant="ghost" onClick={() => void setDraftId(null)}>
            Start a new reply
          </Button>
        </div>
      </div>
    );
  }
  if (!ready && !shown) {
    return (
      <div className="h-[140px] w-full animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
    );
  }

  return (
    <ReplyComposerBody
      mode={replyMode}
      replyToMessage={replyToMessage}
      threadMessages={emailData.messages}
      draft={draftId || resumeDraftId ? draftQuery.data : undefined}
      // Only resume when we know the draft's id; otherwise editing it would fork a duplicate.
      // If the full draft couldn't be loaded, only fall back to the thread copy when it has no
      // attachments (that copy has no file contents, so saving it would drop them).
      resume={
        resumable && resumeDraftId && (draftQuery.data || !resumable.attachments?.length)
          ? { draftId: resumeDraftId, message: resumable }
          : undefined
      }
    />
  );
}

function ReplyComposerBody({
  mode,
  replyToMessage,
  threadMessages,
  draft,
  resume,
}: {
  mode: ReplyMode;
  replyToMessage: ParsedMessage;
  threadMessages: ParsedMessage[];
  draft?: {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    content?: string;
    attachments?: { filename: string; mimeType: string; body: string }[];
  };
  resume?: { draftId: string; message: ParsedMessage };
}) {
  const [, setMode] = useQueryState('mode');
  const [, setDraftId] = useQueryState('draftId');
  const [threadId, setThreadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const { refetch } = useThread(threadId);
  const { data: aliases } = useEmailAliases();
  const trpc = useTRPC();
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());
  const { data: activeConnection } = useActiveConnection();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: session } = useSession();

  const ownAddresses = useMemo(
    () =>
      [activeConnection?.email, ...(aliases ?? []).map((a) => a.email)].filter(
        (e): e is string => !!e,
      ),
    [activeConnection?.email, aliases],
  );
  const names = useMemo(() => buildNameDirectory(threadMessages), [threadMessages]);

  // Recipients/subject for the current mode. Keyed on the message *id* so a background refetch
  // (new object, same message) never resets what the user has edited.
  const replyToId = replyToMessage.id;
  const prefill = useMemo(() => {
    const { to, cc } = buildReplyRecipients(replyToMessage, mode, ownAddresses);
    return {
      key: `${mode}:${replyToId}`,
      to: to.map((r) => r.email),
      cc: cc.map((r) => r.email),
      subject: buildReplySubject(replyToMessage.subject, mode),
      fromEmail: pickFromAddress(replyToMessage, aliases),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, replyToId, ownAddresses, aliases]);

  const canReplyAll = useMemo(() => {
    const { to, cc } = buildReplyRecipients(replyToMessage, 'replyAll', ownAddresses);
    return to.length + cc.length > 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyToId, ownAddresses]);

  // Snapshot the starting content once, at mount. Priority: content restored from an undone/
  // failed send > the open draft > a fresh reply.
  const [initial] = useState(() => {
    const stash = restoreStash.get(replyToId);
    if (stash) {
      restoreStash.delete(replyToId);
      return {
        ...stash,
        fromEmail: stash.fromEmail ?? prefill.fromEmail,
        draftId: stash.draftId ?? undefined,
      };
    }
    if (draft) {
      return {
        to: addressesOf(draft.to),
        cc: addressesOf(draft.cc),
        bcc: addressesOf(draft.bcc),
        subject: draft.subject || prefill.subject,
        message: stripQuotedOriginal(draft.content ?? ''),
        attachments: draftAttachmentsToFiles(draft.attachments),
        fromEmail: prefill.fromEmail,
        draftId: resume?.draftId as string | undefined,
        removedForwardKeys: [] as string[],
      };
    }
    if (resume) {
      const d = resume.message;
      return {
        to: (d.to ?? []).map((r) => r.email),
        cc: (d.cc ?? []).map((r) => r.email),
        bcc: (d.bcc ?? []).map((r) => r.email),
        subject: d.subject || prefill.subject,
        message: stripQuotedOriginal(d.decodedBody ?? ''),
        attachments: [] as File[],
        fromEmail: prefill.fromEmail,
        draftId: resume.draftId as string | undefined,
        removedForwardKeys: [] as string[],
      };
    }
    return {
      to: prefill.to,
      cc: prefill.cc,
      bcc: [] as string[],
      subject: prefill.subject,
      message: '',
      attachments: [] as File[],
      fromEmail: prefill.fromEmail,
      draftId: undefined as string | undefined,
      removedForwardKeys: [] as string[],
    };
  });

  // Forwards carry the original's attachments (inline images are already in the body).
  // The user can drop any of them before sending.
  const [removedForwardKeys, setRemovedForwardKeys] = useState<string[]>(
    initial.removedForwardKeys,
  );
  const originalAttachments = useMemo(
    () =>
      (replyToMessage.attachments ?? [])
        .filter((a) => a.filename && !isInlineAttachment(a))
        .map((a, i) => ({
          key: `${i}:${a.filename}:${a.size}`,
          filename: a.filename,
          size: a.size,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replyToId],
  );
  const forwardedAttachments =
    mode === 'forward'
      ? originalAttachments.filter((a) => !removedForwardKeys.includes(a.key))
      : [];

  const draftThreading = useMemo(
    () => ({
      inReplyTo: replyToMessage.messageId || undefined,
      references:
        [...(replyToMessage.references?.split(/\s+/) ?? []), replyToMessage.messageId]
          .filter(Boolean)
          .join(' ') || undefined,
      replyToMessageId: replyToMessage.id,
      isForward: mode === 'forward',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replyToId, mode],
  );

  const close = () => {
    void setMode(null);
    void setDraftId(null);
    void setActiveReplyId(null);
  };

  const handleSendEmail = async (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
    fromEmail?: string;
    draftId?: string | null;
  }) => {
    if (!activeConnection?.email) return;

    // Capture everything now; the composer unmounts before the delayed send runs.
    const original = replyToMessage;
    const sendMode = mode;
    const sendThreadId = threadId;
    const userName = (activeConnection.name || session?.user?.name || '').replace(/[<>"]/g, '');
    const fromAddress =
      data.fromEmail || pickFromAddress(original, aliases) || activeConnection.email;
    const fromEmail = userName.trim() ? `${userName} <${fromAddress}>` : fromAddress;

    const zeroSignature = settings?.settings.zeroSignature
      ? '<p style="color: #666; font-size: 12px;">Sent via <a href="https://0.email/" style="color: #0066cc; text-decoration: none;">Zero</a></p>'
      : '';
    const originalDate = original.receivedOn
      ? new Date(original.receivedOn).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';
    const originalHtml =
      sendMode === 'forward'
        ? buildForwardedOriginal({
            sender: original.sender,
            date: originalDate,
            subject: original.subject,
            to: original.to,
            cc: original.cc,
            body: original.decodedBody,
          })
        : buildQuotedOriginal({
            sender: original.sender,
            date: originalDate,
            body: original.decodedBody,
          });

    const stash: RestoreStash = {
      to: data.to,
      cc: data.cc ?? [],
      bcc: data.bcc ?? [],
      subject: data.subject,
      message: data.message,
      attachments: data.attachments,
      fromEmail: data.fromEmail,
      draftId: data.draftId,
      removedForwardKeys,
    };
    const reopen = () => {
      restoreStash.set(original.id, stash);
      if (sendThreadId) void setThreadId(sendThreadId);
      void setMode(sendMode);
      void setActiveReplyId(original.id);
      void setDraftId(data.draftId ?? null);
    };

    const payload = {
      to: data.to.map((email) => toSender(email, names)),
      cc: data.cc?.map((email) => toSender(email, names)),
      bcc: data.bcc?.map((email) => toSender(email, names)),
      subject: data.subject,
      message: data.message + zeroSignature,
      attachments: await serializeFiles(data.attachments),
      fromEmail,
      draftId: data.draftId ?? undefined,
      headers: {
        'In-Reply-To': original.messageId ?? '',
        References: [
          ...(original.references ? original.references.split(/\s+/) : []),
          original.messageId,
        ]
          .filter(Boolean)
          .join(' '),
      },
      threadId: original.threadId,
      isForward: sendMode === 'forward',
      originalMessage: originalHtml,
      replyToMessageId: original.id,
      forwardAttachments:
        sendMode === 'forward'
          ? forwardedAttachments.map(({ filename, size }) => ({ filename, size }))
          : undefined,
    };

    // Close right away; the actual send happens after the undo window.
    close();

    pendingSends++;
    if (pendingSends === 1) window.addEventListener('beforeunload', warnIfSending);
    const settle = () => {
      pendingSends = Math.max(0, pendingSends - 1);
      if (pendingSends === 0) window.removeEventListener('beforeunload', warnIfSending);
    };

    let toastId: string | number = '';
    const timer = setTimeout(async () => {
      try {
        await sendEmail(payload);
        posthog.capture('Reply Email Sent', { mode: sendMode });
        toast.success(m['pages.createEmail.emailSent'](), { id: toastId, action: undefined });
        void refetch();
      } catch (error) {
        console.error('Error sending email:', error);
        toast.error(m['pages.createEmail.failedToSendEmail'](), {
          id: toastId,
          duration: 10000,
          action: { label: 'Reopen', onClick: reopen },
        });
      } finally {
        settle();
      }
    }, UNDO_SEND_MS);

    toastId = toast('Sending…', {
      duration: UNDO_SEND_MS + 500,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timer);
          settle();
          reopen();
        },
      },
    });
  };

  // Header text: who this goes to (for forwards: whose message it is).
  const sender = replyToMessage.sender;
  const headline = (() => {
    if (mode === 'forward') return { name: sender?.name || sender?.email, email: sender?.email };
    const recipients = [...prefill.to, ...prefill.cc];
    const first = recipients[0];
    if (!first) return { name: undefined, email: undefined };
    const name = names.get(first.toLowerCase()) || first;
    return {
      name: recipients.length > 1 ? `${name} +${recipients.length - 1}` : name,
      email: recipients.join(', '),
    };
  })();

  return (
    <EmailComposer
      editorClassName="min-h-[96px]"
      className="min-h-0 w-full max-w-none! border shadow-none"
      onSendEmail={handleSendEmail}
      onClose={close}
      initialMessage={initial.message}
      initialTo={initial.to}
      initialCc={initial.cc}
      initialBcc={initial.bcc}
      initialSubject={initial.subject}
      initialAttachments={initial.attachments}
      initialFromEmail={initial.fromEmail}
      prefill={prefill}
      displayNames={names}
      initialDraftId={initial.draftId}
      draftThreading={draftThreading}
      forwardedAttachments={forwardedAttachments}
      onRemoveForwardedAttachment={(key) => setRemovedForwardKeys((keys) => [...keys, key])}
      replyContext={{
        mode,
        senderName: headline.name,
        senderEmail: headline.email,
        subject: replyToMessage.subject,
        canReplyAll: canReplyAll || mode === 'replyAll',
        onModeChange: (next) => void setMode(next),
      }}
      autofocus={true}
      settingsLoading={settingsLoading}
    />
  );
}
