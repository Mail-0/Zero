import { useChatConversations, type ConversationSummary } from './use-conversations';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNowStrict } from 'date-fns';
import { Button } from '@/components/ui/button';
import { History, Trash2 } from 'lucide-react';
import { ZeroMark } from './thinking';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/** Header button that lists past chats so they can be reopened or deleted. */
export function ChatHistoryButton({
  connectionId,
  onOpen,
}: {
  connectionId: string | undefined;
  /** Called after a chat is opened, so the caller can reset the composer. */
  onOpen: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { list, open, remove } = useChatConversations(connectionId, isOpen);
  const conversations = list.data?.conversations ?? [];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="md:h-fit md:px-2"
          title="Chat history"
          disabled={!connectionId}
        >
          <History className="dark:text-iconDark text-iconLight" />
          <span className="sr-only">Chat history</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="bg-surface border-neutral-subtle w-80 rounded-xl p-1 shadow-lg"
      >
        <div className="text-copy-sm text-neutral-subtle px-2.5 pt-1.5 pb-1 font-medium">Chats</div>
        {list.isLoading ? (
          <div className="flex justify-center py-6">
            <ZeroMark className="text-neutral-subtle size-3.5 animate-spin" />
          </div>
        ) : list.isError ? (
          <p className="text-copy text-neutral-subtle px-2.5 py-4">{"Couldn't load your chats."}</p>
        ) : conversations.length === 0 ? (
          <p className="text-copy text-neutral-subtle px-2.5 py-4">No chats yet.</p>
        ) : (
          <div className="no-scrollbar flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isCurrent={conversation.id === list.data?.currentId}
                isDeleting={remove.isPending && remove.variables === conversation.id}
                onOpen={() => {
                  setIsOpen(false);
                  if (conversation.id === list.data?.currentId) return;
                  onOpen();
                  open.mutate(conversation.id);
                }}
                onDelete={() => remove.mutate(conversation.id)}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ConversationRow({
  conversation,
  isCurrent,
  isDeleting,
  onOpen,
  onDelete,
}: {
  conversation: ConversationSummary;
  isCurrent: boolean;
  isDeleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group hover:bg-surface-subtle flex items-center gap-1 rounded-lg pr-1 transition-colors',
        isCurrent && 'bg-surface-subtle',
        isDeleting && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start px-2.5 py-2 text-left"
      >
        <span className="text-copy text-neutral w-full truncate">{conversation.title}</span>
        <span className="text-copy-sm text-neutral-weak">
          {isCurrent ? 'Current · ' : ''}
          {formatDistanceToNowStrict(conversation.updatedAt, { addSuffix: true })}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Delete chat "${conversation.title}"`}
        title="Delete chat"
        onClick={onDelete}
        disabled={isDeleting}
        className="text-neutral-subtle hover:text-neutral hover:bg-surface-strong grid size-7 shrink-0 cursor-pointer place-items-center rounded-md opacity-0 transition-[colors,opacity] group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
