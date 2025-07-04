import { addOptimisticActionAtom, removeOptimisticActionAtom } from '@/store/optimistic-updates';
import { optimisticActionsManager, type PendingAction } from '@/lib/optimistic-actions-manager';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { focusedIndexAtom } from '@/hooks/use-mail-navigation';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import type { ThreadDestination } from '@/lib/thread-actions';
import { useTRPC } from '@/providers/query-provider';
import { useMail } from '@/components/mail/use-mail';
import { moveThreadsTo } from '@/lib/thread-actions';
import { useCallback, useRef } from 'react';
import { m } from '@/paraglide/messages';
import { useQueryState } from 'nuqs';
import posthog from 'posthog-js';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

enum ActionType {
  MOVE = 'MOVE',
  STAR = 'STAR',
  READ = 'READ',
  LABEL = 'LABEL',
  IMPORTANT = 'IMPORTANT',
}

const actionEventNames: Record<ActionType, (params: any) => string> = {
  [ActionType.MOVE]: () => 'email_moved',
  [ActionType.STAR]: (params) => (params.starred ? 'email_starred' : 'email_unstarred'),
  [ActionType.READ]: (params) => (params.read ? 'email_marked_read' : 'email_marked_unread'),
  [ActionType.IMPORTANT]: (params) =>
    params.important ? 'email_marked_important' : 'email_unmarked_important',
  [ActionType.LABEL]: (params) => (params.add ? 'email_label_added' : 'email_label_removed'),
};

export function useOptimisticActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);
  const [, addOptimisticAction] = useAtom(addOptimisticActionAtom);
  const [, removeOptimisticAction] = useAtom(removeOptimisticActionAtom);
  const [threadId, setThreadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setFocusedIndex] = useAtom(focusedIndexAtom);
  const [mail, setMail] = useMail();
  const { mutateAsync: markAsRead } = useMutation(trpc.mail.markAsRead.mutationOptions());
  const { mutateAsync: markAsUnread } = useMutation(trpc.mail.markAsUnread.mutationOptions());
  const { mutateAsync: markAsImportant } = useMutation(trpc.mail.markAsImportant.mutationOptions());
  const { mutateAsync: toggleStar } = useMutation(trpc.mail.toggleStar.mutationOptions());
  const { mutateAsync: toggleImportant } = useMutation(trpc.mail.toggleImportant.mutationOptions());
  const { mutateAsync: bulkArchive } = useMutation(trpc.mail.bulkArchive.mutationOptions());
  const { mutateAsync: bulkStar } = useMutation(trpc.mail.bulkStar.mutationOptions());
  const { mutateAsync: bulkDeleteThread } = useMutation(trpc.mail.bulkDelete.mutationOptions());
  const { mutateAsync: modifyLabels } = useMutation(trpc.mail.modifyLabels.mutationOptions());

  const generatePendingActionId = () =>
    `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const refreshData = useCallback(
    async (threadIds: string[], folders?: string[]) => {
      return await Promise.all([
        queryClient.refetchQueries({ queryKey: trpc.mail.count.queryKey() }),
        ...(folders?.map((folder) =>
          queryClient.refetchQueries({
            queryKey: trpc.mail.listThreads.infiniteQueryKey({ folder }),
          }),
        ) ?? []),
        ...threadIds.map((id) =>
          queryClient.refetchQueries({
            queryKey: trpc.mail.get.queryKey({ id }),
          }),
        ),
        queryClient.refetchQueries({ queryKey: trpc.labels.list.queryKey() }),
      ]);
    },
    [queryClient, trpc.mail.get, trpc.labels.list],
  );

  function createPendingAction({
    type,
    threadIds,
    params,
    optimisticId,
    execute,
    undo,
    toastMessage,
    folders,
  }: {
    type: keyof typeof ActionType;
    threadIds: string[];
    params: PendingAction['params'];
    optimisticId: string;
    execute: () => Promise<void>;
    undo: () => void;
    toastMessage: string;
    folders?: string[];
  }) {
    const pendingActionId = generatePendingActionId();
    optimisticActionsManager.lastActionId = pendingActionId;
    console.log('here Generated pending action ID:', pendingActionId);

    if (!optimisticActionsManager.pendingActionsByType.has(type)) {
      console.log('here Creating new Set for action type:', type);
      optimisticActionsManager.pendingActionsByType.set(type, new Set());
    }
    optimisticActionsManager.pendingActionsByType.get(type)?.add(pendingActionId);
    console.log(
      'here',
      'Added pending action to type:',
      type,
      'Current size:',
      optimisticActionsManager.pendingActionsByType.get(type)?.size,
    );

    const pendingAction = {
      id: pendingActionId,
      type,
      threadIds,
      params,
      optimisticId,
      execute,
      undo,
    };

    optimisticActionsManager.pendingActions.set(pendingActionId, pendingAction as PendingAction);

    const itemCount = threadIds.length;
    const bulkActionMessage = itemCount > 1 ? `${toastMessage} (${itemCount} items)` : toastMessage;

    async function doAction() {
      try {
        await execute();
        const typeActions = optimisticActionsManager.pendingActionsByType.get(type);
        console.log('here', {
          pendingActionsByTypeRef: optimisticActionsManager.pendingActionsByType.get(type)?.size,
          pendingActionsRef: optimisticActionsManager.pendingActions.size,
          typeActions: typeActions?.size,
        });

        const eventName = actionEventNames[type]?.(params);
        if (eventName) {
          posthog.capture(eventName);
        }

        optimisticActionsManager.pendingActions.delete(pendingActionId);
        optimisticActionsManager.pendingActionsByType.get(type)?.delete(pendingActionId);
        if (typeActions?.size === 1) {
          await refreshData(threadIds, folders);
          removeOptimisticAction(optimisticId);
        }
      } catch (error) {
        console.error('Action failed:', error);
        removeOptimisticAction(optimisticId);
        optimisticActionsManager.pendingActions.delete(pendingActionId);
        optimisticActionsManager.pendingActionsByType.get(type)?.delete(pendingActionId);
        showToast.error('Action failed');
      }
    }

    const showToast = toast;

    if (toastMessage.trim().length) {
      toast(bulkActionMessage, {
        onAutoClose: () => {
          doAction();
        },
        onDismiss: () => {
          doAction();
        },
        action: {
          label: 'Undo',
          onClick: () => {
            undo();
            optimisticActionsManager.pendingActions.delete(pendingActionId);
            optimisticActionsManager.pendingActionsByType.get(type)?.delete(pendingActionId);
          },
        },
        duration: 5000,
      });
    } else {
      doAction();
    }

    return pendingActionId;
  }

  function optimisticMarkAsRead(threadIds: string[], silent = false) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'READ',
      threadIds,
      read: true,
    });

    createPendingAction({
      type: 'READ',
      threadIds,
      params: { read: true },
      optimisticId,
      execute: async () => {
        await markAsRead({ ids: threadIds });

        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: silent ? '' : 'Marked as read',
    });
  }

  function optimisticMarkAsUnread(threadIds: string[]) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'READ',
      threadIds,
      read: false,
    });

    createPendingAction({
      type: 'READ',
      threadIds,
      params: { read: false },
      optimisticId,
      execute: async () => {
        await markAsUnread({ ids: threadIds });

        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: 'Marked as unread',
    });
  }

  function optimisticToggleStar(threadIds: string[], starred: boolean) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'STAR',
      threadIds,
      starred,
    });

    createPendingAction({
      type: 'STAR',
      threadIds,
      params: { starred },
      optimisticId,
      execute: async () => {
        await toggleStar({ ids: threadIds });
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: starred
        ? m['common.actions.addedToFavorites']()
        : m['common.actions.removedFromFavorites'](),
    });
  }

  function optimisticMoveThreadsTo(
    threadIds: string[],
    currentFolder: string,
    destination: ThreadDestination,
  ) {
    if (!threadIds.length || !destination) return;

    // setFocusedIndex(null);

    const optimisticId = addOptimisticAction({
      type: 'MOVE',
      threadIds,
      destination,
    });

    threadIds.forEach((id) => {
      setBackgroundQueue({ type: 'add', threadId: `thread:${id}` });
    });

    if (threadId && threadIds.includes(threadId)) {
      setThreadId(null);
      setActiveReplyId(null);
    }
    const successMessage =
      destination === 'inbox'
        ? m['common.actions.movedToInbox']()
        : destination === 'spam'
          ? m['common.actions.movedToSpam']()
          : destination === 'bin'
            ? m['common.actions.movedToBin']()
            : m['common.actions.archived']();

    createPendingAction({
      type: 'MOVE',
      threadIds,
      params: { currentFolder, destination },
      optimisticId,
      execute: async () => {
        await moveThreadsTo({
          threadIds,
          currentFolder,
          destination,
        });

        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }

        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      toastMessage: successMessage,
      folders: [currentFolder, destination],
    });
  }

  function optimisticDeleteThreads(threadIds: string[], currentFolder: string) {
    if (!threadIds.length) return;

    // setFocusedIndex(null);

    const optimisticId = addOptimisticAction({
      type: 'MOVE',
      threadIds,
      destination: 'bin',
    });

    threadIds.forEach((id) => {
      setBackgroundQueue({ type: 'add', threadId: `thread:${id}` });
    });

    if (threadId && threadIds.includes(threadId)) {
      setThreadId(null);
      setActiveReplyId(null);
    }
    createPendingAction({
      type: 'MOVE',
      threadIds,
      params: { currentFolder, destination: 'bin' },
      optimisticId,
      execute: async () => {
        await bulkDeleteThread({ ids: threadIds });

        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }

        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      undo: () => {
        removeOptimisticAction(optimisticId);

        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      toastMessage: m['common.actions.movedToBin'](),
    });
  }

  function optimisticToggleImportant(threadIds: string[], isImportant: boolean) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'IMPORTANT',
      threadIds,
      important: isImportant,
    });

    createPendingAction({
      type: 'IMPORTANT',
      threadIds,
      params: { important: isImportant },
      optimisticId,
      execute: async () => {
        await toggleImportant({ ids: threadIds });

        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: isImportant ? 'Marked as important' : 'Unmarked as important',
    });
  }

  function optimisticToggleLabel(threadIds: string[], labelId: string, add: boolean) {
    if (!threadIds.length || !labelId) return;

    const optimisticId = addOptimisticAction({
      type: 'LABEL',
      threadIds,
      labelIds: [labelId],
      add,
    });

    createPendingAction({
      type: 'LABEL',
      threadIds,
      params: { labelId, add },
      optimisticId,
      execute: async () => {
        await modifyLabels({
          threadId: threadIds,
          addLabels: add ? [labelId] : [],
          removeLabels: add ? [] : [labelId],
        });

        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: add
        ? `Label added${threadIds.length > 1 ? ` to ${threadIds.length} threads` : ''}`
        : `Label removed${threadIds.length > 1 ? ` from ${threadIds.length} threads` : ''}`,
    });
  }

  function undoLastAction() {
    if (!optimisticActionsManager.lastActionId) return;

    const lastAction = optimisticActionsManager.pendingActions.get(
      optimisticActionsManager.lastActionId,
    );
    if (!lastAction) return;

    lastAction.undo();

    optimisticActionsManager.pendingActions.delete(optimisticActionsManager.lastActionId);
    optimisticActionsManager.pendingActionsByType
      .get(lastAction.type)
      ?.delete(optimisticActionsManager.lastActionId);

    if (lastAction.toastId) {
      toast.dismiss(lastAction.toastId);
    }

    optimisticActionsManager.lastActionId = null;
  }

  return {
    optimisticMarkAsRead,
    optimisticMarkAsUnread,
    optimisticToggleStar,
    optimisticMoveThreadsTo,
    optimisticDeleteThreads,
    optimisticToggleImportant,
    optimisticToggleLabel,
    undoLastAction,
  };
}
