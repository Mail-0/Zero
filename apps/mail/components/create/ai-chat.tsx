import { useChatAttachments, type AttachmentSnapshot } from '../ai-chat/use-chat-attachments';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QueuedMessageStack } from '../ai-chat/queued-message-stack';
import { useAIFullScreen, useAISidebar } from '../ui/ai-sidebar';
import { useMessageQueue } from '../ai-chat/use-message-queue';
import { ChatConversation } from '../ai-chat/message-renderer';
import type { ChatAttachment } from '../ai-chat/chat-parts';
import { VoiceProvider } from '@/providers/voice-provider';
import useComposeEditor from '@/hooks/use-compose-editor';
import { ChatComposer } from '../ai-chat/chat-composer';
import type { useAgentChat } from 'agents/ai-react';
import { useBilling } from '@/hooks/use-billing';
import { TextShimmer } from '../ui/text-shimmer';
import { ZeroMark } from '../ai-chat/thinking';
import { VoiceButton } from '../voice-button';
import { EditorContent } from '@tiptap/react';
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';

type QueuedPayload = { text: string; attachments: ChatAttachment[] };
type ComposerState = { text: string; attachments: AttachmentSnapshot };

const SUGGESTED_QUERIES = [
  'Find invoice from Stripe',
  'Show unpaid invoices',
  'Show recent work feedback',
  'Find all work meetings',
  'What projects do I have coming up',
];

export function AIChat({
  messages,
  append,
  error,
  status,
  stop,
  reload,
}: ReturnType<typeof useAgentChat>): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { chatMessages } = useBilling();
  const { isFullScreen } = useAIFullScreen();
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const [aiSidebarOpen] = useQueryState('aiSidebar');
  const { toggleOpen } = useAISidebar();
  const viewportHeight = useElementHeight(scrollRef);

  const isLoading = status === 'submitted' || status === 'streaming';
  // Only emptiness is tracked: re-rendering on every keystroke loops with tiptap.
  const [hasText, setHasText] = useState(false);
  const files = useChatAttachments();
  const hasContent = hasText || files.items.length > 0;
  const submitRef = useRef<() => void>(() => {});
  const restoreIndexRef = useRef<number | undefined>(undefined);

  const queue = useMessageQueue<QueuedPayload, ComposerState>({
    isProcessing: isLoading,
    send: ({ text, attachments }) =>
      append(
        { role: 'user', content: text },
        attachments.length ? { experimental_attachments: attachments } : undefined,
      ),
    stop,
  });

  const canSend =
    chatMessages.enabled && hasContent && !files.isUploading && !(isLoading && queue.isFull);

  const editor = useComposeEditor({
    placeholder: 'Ask Zero to do anything...',
    onLengthChange: () => setHasText(editor.getText().trim().length > 0),
    onKeydown(event) {
      if (event.key === '0' && event.metaKey) return toggleOpen();
      if (event.key === 'Enter' && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        submitRef.current();
      }
    },
  });

  const submit = useCallback(() => {
    if (!canSend) return;
    const text = editor.getText().trim();
    const attachments = files.attachments;
    if (!text && attachments.length === 0) return;

    const queued = queue.enqueue({
      id: crypto.randomUUID(),
      payload: { text, attachments },
      preview: text || attachments.map((a) => a.name).join(', '),
      attachmentCount: attachments.length,
      composerState: { text, attachments: files.snapshot() },
      restoreIndex: restoreIndexRef.current,
    });
    if (!queued) return;
    restoreIndexRef.current = undefined;
    editor.commands.clearContent(true);
    setHasText(false);
    files.reset();
  }, [canSend, editor, files, queue]);
  useLayoutEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const editQueued = (id: string) => {
    const taken = queue.takeForEdit(id);
    if (!taken) return;
    restoreIndexRef.current = taken.index;
    editor.commands.setContent(taken.message.composerState.text);
    setHasText(taken.message.composerState.text.length > 0);
    files.restore(taken.message.composerState.attachments);
    editor.commands.focus('end');
  };

  const handleStop = () => {
    queue.pause();
    stop();
  };

  const handleQueryClick = (query: string) => {
    editor.commands.setContent(query);
    setHasText(true);
    editor.commands.focus('end');
  };

  useEffect(() => {
    if (aiSidebarOpen === 'true') editor.commands.focus();
  }, [aiSidebarOpen, editor]);

  const lastUserMessageId = messages.findLast((m) => m.role === 'user')?.id;
  useEffect(() => {
    if (!lastUserMessageId) return;
    requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector('[data-last-user-message-pair]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [lastUserMessageId]);

  const showError = status === 'error' || !!error;

  return (
    <div className={cn('flex h-full flex-col', isFullScreen ? 'mx-auto w-full max-w-2xl' : '')}>
      <div
        ref={scrollRef}
        className="no-scrollbar relative flex-1 overflow-y-auto px-3"
        style={{ overflowAnchor: 'none' }}
      >
        {!chatMessages.enabled ? (
          <div
            onClick={() => setPricingDialog('true')}
            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center px-6"
          >
            <TextShimmer className="text-center text-xl font-medium">
              Upgrade to Zero Pro for unlimited AI chat
            </TextShimmer>
            <Button className="mt-2 h-8 w-52">Start 7 day free trial</Button>
          </div>
        ) : !messages.length ? (
          <EmptyState onQueryClick={handleQueryClick} />
        ) : (
          <>
            <ChatConversation
              messages={messages}
              isLoading={isLoading}
              lastPairMinHeight={viewportHeight ? viewportHeight - 8 : undefined}
            />
            {showError && !isLoading && (
              <div className="-mt-4 mb-4 flex items-center gap-2 px-2 py-1">
                <div className="bg-danger size-1.5 shrink-0 rounded-full" />
                <span className="text-copy text-neutral-subtle">Something went wrong.</span>
                <button
                  type="button"
                  onClick={() => reload()}
                  className="text-copy text-neutral cursor-pointer underline-offset-2 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={cn('flex shrink-0 flex-col gap-2 px-3 pt-1 pb-3', isFullScreen && 'px-0')}>
        <QueuedMessageStack
          items={queue.queue}
          onDismiss={queue.remove}
          onEdit={editQueued}
          onSendNow={queue.sendNow}
        />
        <ChatComposer
          isLoading={isLoading}
          hasContent={hasContent}
          submitDisabled={!canSend}
          onSubmit={submit}
          onStop={handleStop}
          attachments={files.items}
          onAddFiles={(added) => void files.upload(added)}
          onRemoveAttachment={files.remove}
          leading={
            <VoiceProvider>
              <VoiceButton />
            </VoiceProvider>
          }
          input={
            <div
              onClick={() => editor.commands.focus()}
              className="text-copy max-h-[120px] w-full cursor-text overflow-y-auto"
            >
              <EditorContent editor={editor} className="h-full w-full" />
            </div>
          }
        />
      </div>
    </div>
  );
}

function EmptyState({ onQueryClick }: { onQueryClick: (query: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center py-8 select-none">
      <div className="flex w-full max-w-md flex-col">
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <ZeroMark className="text-neutral size-5" />
        </motion.div>
        <motion.h2
          className="mt-4 text-xl leading-snug"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        >
          <span className="text-neutral-subtle">Ask anything about </span>
          <span className="text-neutral font-medium">your emails</span>
        </motion.h2>
        <motion.div
          className="bg-surface-subtle mt-5 flex w-full flex-col gap-0.5 overflow-hidden rounded-xl p-0.5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
        >
          <div className="px-3 py-2">
            <span className="text-neutral-subtle text-copy font-medium">Suggested</span>
          </div>
          <div className="bg-surface flex flex-col gap-0.5 rounded-[10px] p-0.5 shadow-xs">
            {SUGGESTED_QUERIES.map((query) => (
              <button
                key={query}
                type="button"
                onClick={() => onQueryClick(query)}
                className="hover:bg-surface-subtle text-neutral text-copy cursor-pointer truncate rounded-lg px-2.5 py-2.5 text-left font-medium transition-colors"
              >
                {query}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function useElementHeight(ref: React.RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}
