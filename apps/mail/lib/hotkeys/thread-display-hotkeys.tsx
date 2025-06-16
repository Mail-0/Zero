import { mailNavigationCommandAtom } from '@/hooks/use-mail-navigation';
import { useThread, useThreads } from '@/hooks/use-threads';
import { keyboardShortcuts } from '@/config/shortcuts';
import useMoveTo from '@/hooks/driver/use-move-to';
import useDelete from '@/hooks/driver/use-delete';
import { useShortcuts } from './use-hotkey-utils';
import { useParams } from 'react-router';
import { useQueryState } from 'nuqs';
import { useSetAtom } from 'jotai';

const closeView = (event: KeyboardEvent) => {
  event.preventDefault();
};

export function ThreadDisplayHotkeys() {
  const scope = 'thread-display';
  const [mode, setMode] = useQueryState('mode');
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const [openThreadId] = useQueryState('threadId');
  const { data: thread } = useThread(openThreadId);
  const [{ refetch }, items] = useThreads();
  const params = useParams<{
    folder: string;
  }>();
  const { mutate: deleteThread } = useDelete();
  const { mutate: moveTo } = useMoveTo();
  const setMailNavigationCommand = useSetAtom(mailNavigationCommandAtom);

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
        setMailNavigationCommand('next');
      } else {
        moveTo({
          threadIds: [openThreadId],
          currentFolder: params.folder ?? 'inbox',
          destination: 'bin',
        });
        setMailNavigationCommand('next');
      }
    },
  };

  const threadDisplayShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(threadDisplayShortcuts, handlers, { scope });

  return null;
}
