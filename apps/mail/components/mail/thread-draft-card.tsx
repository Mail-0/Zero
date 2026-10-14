import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { anchorDrafts, modeForDraft, stripQuotedOriginal } from '@/lib/reply';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { PencilCompose, Sparkles } from '../icons/icons';
import { useTRPC } from '@/providers/query-provider';
import { DRAFT_STALE_MS } from '@/hooks/use-drafts';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import type { ParsedMessage } from '@/types';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';

/**
 * The reply composer chunk (tiptap etc.). Shared with thread-display's `lazy()` so warming it
 * here means opening a draft doesn't wait on a chunk download.
 */
export const loadReplyComposer = () => import('./reply-composer');

const composerUrlState = {
  mode: parseAsString,
  activeReplyId: parseAsString,
  draftId: parseAsString,
};

/** How long a discarded draft stays recoverable before it is actually deleted. */
const UNDO_DISCARD_MS = 5000;

/**
 * Drafts the user discarded but that haven't been deleted yet. Module-level so the undo window
 * survives the card unmounting (switching threads) and the card stays hidden if it remounts.
 */
const pendingDiscards = new Set<string>();
const discardListeners = new Set<() => void>();
const emitDiscards = () => discardListeners.forEach((l) => l());
const subscribeDiscards = (listener: () => void) => {
  discardListeners.add(listener);
  return () => discardListeners.delete(listener);
};
const useIsPendingDiscard = (messageId: string) =>
  useSyncExternalStore(
    subscribeDiscards,
    () => pendingDiscards.has(messageId),
    () => false,
  );

const previewOf = (draft: ParsedMessage) => {
  const fromBody = () => {
    if (!draft.decodedBody || typeof DOMParser === 'undefined') return '';
    const html = stripQuotedOriginal(draft.decodedBody);
    return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  };
  return (fromBody() || draft.title || '').replace(/\s+/g, ' ').trim();
};

const recipientLabelOf = (draft: ParsedMessage) => {
  const recipients = [...(draft.to ?? []), ...(draft.cc ?? [])].filter((r) => r.email);
  if (!recipients.length) return null;
  const first = recipients[0]!;
  const name = first.name?.trim() || first.email;
  return recipients.length > 1 ? `${name} +${recipients.length - 1}` : name;
};

/**
 * A saved draft shown in the thread timeline, under the message it replies to.
 * Clicking it opens the composer on exactly this draft; Discard deletes it (with undo).
 * Drafts written by Zero's automatic drafting are shown as suggestions.
 */
export function ThreadDraftCard({
  draft,
  draftId,
  draftIdsLoading,
  anchorMessageId,
  threadId,
}: {
  draft: ParsedMessage;
  /** Provider draft id (resolved separately; thread messages only carry the message id). */
  draftId?: string;
  draftIdsLoading: boolean;
  anchorMessageId: string;
  threadId: string;
}) {
  const [{ mode }, setComposer] = useQueryStates(composerUrlState);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: deleteDraft } = useMutation(trpc.drafts.delete.mutationOptions());
  const hidden = useIsPendingDiscard(draft.id);

  // Warm everything the composer waits on as soon as the user shows intent (hover, focus,
  // press), so the click usually finds the draft, aliases and code already loaded.
  const prefetch = useCallback(() => {
    void loadReplyComposer();
    if (!draftId) return;
    // No-op while the cached draft is fresh; refetches it after an autosave invalidated it.
    void queryClient.prefetchQuery(
      trpc.drafts.get.queryOptions({ id: draftId }, { staleTime: DRAFT_STALE_MS }),
    );
    // The composer holds off (up to 1.5s) until aliases have been fetched at least once.
    const aliasesKey = trpc.mail.getEmailAliases.queryKey();
    const aliases = queryClient.getQueryState(aliasesKey);
    if (!aliases || (!aliases.dataUpdateCount && aliases.fetchStatus === 'idle')) {
      void queryClient.prefetchQuery({ ...trpc.mail.getEmailAliases.queryOptions(), staleTime: 0 });
    }
  }, [draftId, queryClient, trpc]);

  // Cards are only shown in an open thread; fetch the composer code in idle time.
  useEffect(() => {
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = ric(() => void loadReplyComposer());
    return () => cancel(handle);
  }, []);

  if (hidden) return null;

  const isSuggestion = !!draft.isZeroSuggestion;
  const recipientLabel = recipientLabelOf(draft);
  const preview = previewOf(draft);
  const edited = draft.receivedOn ? formatDate(draft.receivedOn) : '';
  const canAct = !!draftId;
  const label = isSuggestion ? 'Suggested by Zero' : 'Draft';

  const handleOpen = () => {
    if (!draftId) {
      toast.error(
        draftIdsLoading
          ? 'Still loading this draft…'
          : "Couldn't open this draft. Try again in a moment.",
      );
      return;
    }
    prefetch();
    // A composer that's already open keeps its own state, so unmount it first (that also saves
    // whatever was in it) and then open this draft in a fresh one. nuqs updates hook state
    // synchronously, so flushSync commits the unmount right away; both updates are coalesced
    // into a single URL write instead of two awaited round-trips.
    if (mode) {
      flushSync(() => void setComposer({ mode: null, activeReplyId: null, draftId: null }));
    }
    void setComposer({
      draftId,
      mode: modeForDraft(draft),
      activeReplyId: anchorMessageId,
    });
  };

  const handleDiscard = () => {
    if (!draftId) return;
    discardWithUndo({
      messageId: draft.id,
      draftId,
      threadId,
      isSuggestion,
      deleteDraft,
      queryClient,
      invalidate: () => [
        trpc.mail.get.queryKey({ id: threadId }),
        trpc.drafts.forThread.queryKey({ threadId }),
        trpc.drafts.list.queryKey(),
      ],
    });
  };

  const actions = (
    <>
      <Button
        type="button"
        size="xs"
        variant={isSuggestion ? 'default' : 'secondary'}
        disabled={!canAct}
        onClick={() => void handleOpen()}
      >
        {isSuggestion ? 'Review & send' : 'Continue'}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        disabled={!canAct}
        onClick={handleDiscard}
        className="text-[#8C8C8C] hover:text-[#E5484D]"
      >
        {isSuggestion ? 'Dismiss' : 'Discard'}
      </Button>
    </>
  );

  return (
    <div
      data-thread-draft={draft.id}
      onPointerEnter={prefetch}
      onPointerDown={prefetch}
      onFocus={prefetch}
      className={cn(
        'group relative mx-2 mt-3 mb-2 overflow-hidden rounded-xl border transition-colors md:mx-0',
        isSuggestion
          ? 'border-[#8B5CF6]/25 bg-[#8B5CF6]/[0.05] hover:border-[#8B5CF6]/40 dark:bg-[#8B5CF6]/[0.07]'
          : 'border-dashed border-black/[0.12] bg-black/[0.015] hover:border-black/20 hover:bg-black/[0.03] dark:border-white/[0.10] dark:bg-white/[0.015] dark:hover:border-white/[0.18] dark:hover:bg-white/[0.03]',
      )}
    >
      {/* Whole card opens the draft; action buttons sit above this layer. */}
      <button
        type="button"
        onClick={() => void handleOpen()}
        aria-label={`${isSuggestion ? 'Review suggested reply' : 'Continue draft'}${recipientLabel ? ` to ${recipientLabel}` : ''}`}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/60 focus-visible:outline-none"
      />

      <div className="pointer-events-none px-4 pt-3 pb-3.5">
        {/* Header: status pill, recipient, timestamp / actions */}
        <div className="flex h-6 items-center gap-2">
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
              isSuggestion
                ? 'bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#C4B5FD]'
                : 'bg-[#E5484D]/10 text-[#E5484D] dark:bg-[#E5484D]/15 dark:text-[#FF6369]',
            )}
          >
            {isSuggestion ? (
              <Sparkles className="h-3 w-3 fill-current" />
            ) : (
              <PencilCompose className="h-3 w-3 fill-current" />
            )}
            {label}
          </span>

          <span className="min-w-0 truncate text-[13px] text-[#8C8C8C]">
            {recipientLabel ? (
              <>
                to{' '}
                <span className="font-medium text-black/80 dark:text-white/85">
                  {recipientLabel}
                </span>
              </>
            ) : (
              <span className="italic">No recipients</span>
            )}
          </span>

          {edited && !isSuggestion ? (
            <span className="ml-auto shrink-0 pl-2 text-xs text-[#8C8C8C] tabular-nums transition-opacity md:group-focus-within:opacity-0 md:group-hover:opacity-0">
              {edited}
            </span>
          ) : null}
        </div>

        {/* Preview */}
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#525252] dark:text-[#B4B4B4]">
          {preview || <span className="text-[#8C8C8C] italic">Empty draft</span>}
        </p>

        {isSuggestion ? (
          <div className="pointer-events-auto relative z-10 mt-3 flex items-center gap-1.5">
            {actions}
          </div>
        ) : null}
      </div>

      {!isSuggestion ? (
        // Desktop: shown on hover/focus in place of the timestamp. Touch: in a footer row.
        <div className="relative z-10 flex items-center justify-end gap-1 border-t border-dashed border-black/[0.08] px-3 py-2 md:absolute md:top-2.5 md:right-3 md:border-0 md:p-0 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100 dark:border-white/[0.08]">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function discardWithUndo({
  messageId,
  draftId,
  isSuggestion,
  deleteDraft,
  queryClient,
  invalidate,
}: {
  messageId: string;
  draftId: string;
  threadId: string;
  isSuggestion: boolean;
  deleteDraft: (input: { id: string }) => Promise<unknown>;
  queryClient: QueryClient;
  invalidate: () => readonly (readonly unknown[])[];
}) {
  pendingDiscards.add(messageId);
  emitDiscards();

  const restore = () => {
    pendingDiscards.delete(messageId);
    emitDiscards();
  };

  const timer = setTimeout(async () => {
    try {
      await deleteDraft({ id: draftId });
      await Promise.all(
        invalidate().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    } catch (error) {
      console.error('Failed to delete draft', error);
      toast.error("Couldn't discard the draft");
      restore();
      return;
    }
    // Keep it hidden until the refetched thread no longer has it, then forget it.
    restore();
  }, UNDO_DISCARD_MS);

  toast(isSuggestion ? 'Suggestion dismissed' : 'Draft discarded', {
    duration: UNDO_DISCARD_MS,
    action: {
      label: 'Undo',
      onClick: () => {
        clearTimeout(timer);
        restore();
      },
    },
  });
}

/**
 * Drafts of a thread, anchored to the messages they reply to, plus their provider draft ids.
 * While a composer is open, the draft it's editing is hidden (it's already on screen).
 */
export function useThreadDraftTimeline(
  threadId: string | null,
  messages: ParsedMessage[] | undefined,
  drafts: ParsedMessage[],
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [mode] = useQueryState('mode');
  const [urlDraftId] = useQueryState('draftId');
  const draftKey = drafts.map((d) => d.id).join(',');

  const idsQuery = useQuery(
    trpc.drafts.forThread.queryOptions(
      { threadId: threadId ?? '' },
      { enabled: !!threadId && drafts.length > 0, staleTime: 30_000 },
    ),
  );

  // A draft appeared or disappeared (autosave, send, other client): refresh the id map.
  const lastDraftKey = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastDraftKey.current;
    lastDraftKey.current = `${threadId}:${draftKey}`;
    // Skip the first render for this thread: the query is already fetching.
    if (!threadId || !draftKey || previous === null || !previous.startsWith(`${threadId}:`)) {
      return;
    }
    if (previous === lastDraftKey.current) return;
    void queryClient.invalidateQueries({ queryKey: trpc.drafts.forThread.queryKey({ threadId }) });
  }, [draftKey, threadId, queryClient, trpc]);

  const draftIds = useMemo(
    () => new Map((idsQuery.data ?? []).map((d) => [d.messageId, d.draftId] as const)),
    [idsQuery.data],
  );

  const draftsByAnchor = useMemo(() => {
    const visible = drafts.filter((d) => {
      if (!mode) return true;
      const id = draftIds.get(d.id);
      // Hide the one being edited, and anything we can't identify yet (most likely the
      // composer's own fresh autosave).
      return !!id && id !== urlDraftId;
    });
    return anchorDrafts(messages ?? [], visible);
  }, [drafts, messages, mode, draftIds, urlDraftId]);

  return { draftsByAnchor, draftIds, draftIdsLoading: idsQuery.isLoading };
}
