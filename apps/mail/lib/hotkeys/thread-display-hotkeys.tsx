'use client';

import { useThread, useThreads } from '@/hooks/use-threads';
import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { deleteThread } from '@/actions/mail';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';

const closeView = (event: KeyboardEvent) => {
  event.preventDefault();
};

export function ThreadDisplayHotkeys() {
  const scope = 'thread-display';
  const [mode, setMode] = useQueryState('mode');
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const [openThreadId] = useQueryState('threadId');
  const { data: thread } = useThread(openThreadId);

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
      toast.promise(deleteThread({ id: thread?.latest?.id ?? openThreadId }), {
        loading: 'Deleting email...',
        success: 'Email deleted',
        error: 'Failed to delete email',
      });
    },
  };

  const threadDisplayShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(threadDisplayShortcuts, handlers, { scope });

  return null;
}
