'use client';

import { keyboardShortcuts } from '@/config/shortcuts';
import useMoveTo from '@/hooks/driver/use-move-to';
import useDelete from '@/hooks/driver/use-delete';
import { useShortcuts } from './use-hotkey-utils';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { focusedIndexAtom } from '@/hooks/use-mail-navigation';
import { useAtom } from 'jotai';

const closeView = (event: KeyboardEvent) => {
  event.preventDefault();
};

export function ThreadDisplayHotkeys() {
  const scope = 'thread-display';
  const [mode, setMode] = useQueryState('mode');
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const [openThreadId, setThreadId] = useQueryState('threadId');
  const { data: thread } = useThread(openThreadId);
  const [{ refetch }, items] = useThreads();
  const params = useParams<{
    folder: string;
  }>();
  const { mutate: deleteThread } = useDelete();
  const { mutate: moveTo } = useMoveTo();
  const [focusedIndex, setFocusedIndex] = useAtom(focusedIndexAtom);

  const handleNext = () => {
    if (focusedIndex === null || !items.length) return setThreadId(null);
    if (focusedIndex < items.length - 1) {
      const nextThread = items[focusedIndex + 1];
      if (nextThread) {
        setThreadId(nextThread.id);
        setFocusedIndex(focusedIndex + 1);
      }
    } else {
      setThreadId(null);
    }
  };

  const handlers = {
    closeView: () => closeView(new KeyboardEvent('keydown', { key: 'Escape' })),
    reply: () => {
      setMode('reply');
      setActiveReplyId(thread?.latest?.id ?? '');
    },
    forward: () => {
      setMode('forward');
      setActiveReplyId(thread?.latest?.id ?? '');
    },
    replyAll: () => {
      setMode('replyAll');
      setActiveReplyId(thread?.latest?.id ?? '');
    },
    delete: () => {
      if (!openThreadId) return;
      if (params.folder === 'bin') {
        deleteThread(openThreadId);
        handleNext();
      } else {
        moveTo({
          threadIds: [openThreadId],
          currentFolder: params.folder,
          destination: 'bin',
        });
        handleNext();
      }
    },
  };

  const threadDisplayShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(threadDisplayShortcuts, handlers, { scope });

  return null;
}
