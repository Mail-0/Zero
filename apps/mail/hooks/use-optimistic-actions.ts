import { addOptimisticActionAtom, removeOptimisticActionAtom } from '@/store/optimistic-updates';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import type { ThreadDestination } from '@/lib/thread-actions';
import { useMail } from '@/components/mail/use-mail';
import { useTRPC } from '@/providers/query-provider';
import { moveThreadsTo } from '@/lib/thread-actions';
import { useCallback, useRef } from 'react';
import { useTranslations } from 'use-intl';
import { useQueryState } from 'nuqs';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

type PendingAction = {
  id: string;
  type: 'MOVE' | 'STAR' | 'READ' | 'LABEL' | 'IMPORTANT';
  threadIds: string[];
  params: any;
  optimisticId: string;
  execute: () => Promise<void>;
  undo: () => void;
};

export function useOptimisticActions() {
  const t = useTranslations();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);
  const [, addOptimisticAction] = useAtom(addOptimisticActionAtom);
  const [, removeOptimisticAction] = useAtom(removeOptimisticActionAtom);
  const [threadId, setThreadId] = useQueryState('threadId');
  const [mail, setMail] = useMail();
  const { mutateAsync: markAsRead } = useMutation(trpc.mail.markAsRead.mutationOptions());
  const { mutateAsync: markAsUnread } = useMutation(trpc.mail.markAsUnread.mutationOptions());
  const { mutateAsync: markAsImportant } = useMutation(trpc.mail.markAsImportant.mutationOptions());
  const { mutateAsync: toggleStar } = useMutation(trpc.mail.toggleStar.mutationOptions());
  const { mutateAsync: toggleImportant } = useMutation(trpc.mail.toggleImportant.mutationOptions());
  const { mutateAsync: bulkArchive } = useMutation(trpc.mail.bulkArchive.mutationOptions());
  const { mutateAsync: bulkStar } = useMutation(trpc.mail.bulkStar.mutationOptions());
  const { mutateAsync: bulkDeleteThread } = useMutation(trpc.mail.bulkDelete.mutationOptions());

  const pendingActionsRef = useRef<Map<string, PendingAction>>(new Map());
  const pendingActionsByTypeRef = useRef<Map<string, Set<string>>>(new Map());

  const generatePendingActionId = () =>
    `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const UNDO_DELAY = 5000;

  const refreshData = useCallback(
    async (threadIds: string[], folders?: string[]) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.mail.count.queryKey() }),
        ...(folders?.map((folder) =>
          queryClient.invalidateQueries({
            queryKey: trpc.mail.listThreads.infiniteQueryKey({ folder }),
          }),
        ) ?? []),
        ...threadIds.map((id) =>
          queryClient.invalidateQueries({
            queryKey: trpc.mail.get.queryKey({ id }),
          }),
        ),
      ]);
    },
    [queryClient, trpc.mail.get],
  );

  const checkAndRefreshType = useCallback(
    async (type: string, threadIds: string[], folders?: string[]) => {
      const typeActions = pendingActionsByTypeRef.current.get(type);
      if (typeActions && typeActions.size === 0) {
        await refreshData(threadIds, folders);
      }
    },
    [refreshData],
  );

  const createPendingAction = useCallback(
    ({
      type,
      threadIds,
      params,
      optimisticId,
      execute,
      undo,
      toastMessage,
      folders,
    }: {
      type: 'MOVE' | 'STAR' | 'READ' | 'LABEL' | 'IMPORTANT';
      threadIds: string[];
      params: any;
      optimisticId: string;
      execute: () => Promise<void>;
      undo: () => void;
      toastMessage: string;
      folders?: string[];
    }) => {
      const pendingActionId = generatePendingActionId();

      if (!pendingActionsByTypeRef.current.has(type)) {
        pendingActionsByTypeRef.current.set(type, new Set());
      }
      pendingActionsByTypeRef.current.get(type)?.add(pendingActionId);

      const pendingAction: PendingAction = {
        id: pendingActionId,
        type,
        threadIds,
        params,
        optimisticId,
        execute,
        undo,
      };

      pendingActionsRef.current.set(pendingActionId, pendingAction);

      const itemCount = threadIds.length;
      const bulkActionMessage =
        itemCount > 1 ? `${toastMessage} (${itemCount} items)` : toastMessage;

      function doAction() {
        execute()
          .then(() => {
            removeOptimisticAction(optimisticId);
            pendingActionsRef.current.delete(pendingActionId);
            pendingActionsByTypeRef.current.get(type)?.delete(pendingActionId);
            checkAndRefreshType(type, threadIds, folders);
          })
          .catch((error) => {
            console.error('Action failed:', error);
            removeOptimisticAction(optimisticId);
            pendingActionsRef.current.delete(pendingActionId);
            pendingActionsByTypeRef.current.get(type)?.delete(pendingActionId);
            showToast.error('Action failed');
          });
      }

      const showToast = toast;

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
            pendingActionsRef.current.delete(pendingActionId);
            pendingActionsByTypeRef.current.get(type)?.delete(pendingActionId);
          },
        },
        duration: 5000,
      });

      return pendingActionId;
    },
    [checkAndRefreshType, removeOptimisticAction],
  );

  const optimisticMarkAsRead = useCallback(
    (threadIds: string[]) => {
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
        toastMessage: 'Marked as read',
      });
    },
    [addOptimisticAction, removeOptimisticAction, markAsRead, createPendingAction, mail, setMail],
  );

  const optimisticMarkAsUnread = useCallback(
    (threadIds: string[]) => {
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
    },
    [addOptimisticAction, removeOptimisticAction, markAsUnread, createPendingAction, mail, setMail],
  );

  const optimisticToggleStar = useCallback(
    (threadIds: string[], starred: boolean) => {
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
          ? t('common.actions.addedToFavorites')
          : t('common.actions.removedFromFavorites'),
      });
    },
    [addOptimisticAction, removeOptimisticAction, toggleStar, createPendingAction, t],
  );

  const optimisticMoveThreadsTo = useCallback(
    (threadIds: string[], currentFolder: string, destination: ThreadDestination) => {
      if (!threadIds.length || !destination) return;

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
      }
      const successMessage =
        destination === 'inbox'
          ? t('common.actions.movedToInbox')
          : destination === 'spam'
            ? t('common.actions.movedToSpam')
            : destination === 'bin'
              ? t('common.actions.movedToBin')
              : t('common.actions.archived');

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
    },
    [
      addOptimisticAction,
      removeOptimisticAction,
      setBackgroundQueue,
      threadId,
      setThreadId,
      createPendingAction,
      t,
      mail,
      setMail,
    ],
  );

  const optimisticDeleteThreads = useCallback(
    (threadIds: string[], currentFolder: string) => {
      if (!threadIds.length) return;

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
        toastMessage: t('common.actions.movedToBin'),
      });
    },
    [
      addOptimisticAction,
      removeOptimisticAction,
      setBackgroundQueue,
      threadId,
      setThreadId,
      createPendingAction,
      bulkDeleteThread,
      t,
      mail,
      setMail,
    ],
  );

  const optimisticToggleImportant = useCallback(
    (threadIds: string[], isImportant: boolean) => {
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
    },
    [
      addOptimisticAction,
      createPendingAction,
      mail,
      removeOptimisticAction,
      setMail,
      toggleImportant,
    ],
  );

  return {
    optimisticMarkAsRead,
    optimisticMarkAsUnread,
    optimisticToggleStar,
    optimisticMoveThreadsTo,
    optimisticDeleteThreads,
    optimisticToggleImportant,
  };
}
