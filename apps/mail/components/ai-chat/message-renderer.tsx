import {
  DISPLAY_TOOL_NAMES,
  getMessageSources,
  getToolStatusLabel,
  isReasoningPart,
  isTextPart,
  isToolPart,
  toToolCall,
  type ChatMessage,
  type ChatPart,
} from './chat-parts';
import {
  ThinkingBlock,
  ThinkingGroup,
  THINKING_LABEL,
  ToolStatusLine,
  WRITING_LABEL,
} from './thinking';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { Message, MessageContent } from './message';
import { MessageAttachments } from './attachments';
import { ToolResult } from './tool-results';
import { MessageSources } from './sources';
import { Response } from './response';
import { cn } from '@/lib/utils';

const USER_TEXT_MAX_LENGTH = 320;
const STREAMING_ANIMATION = { sep: 'char', stagger: 2, duration: 100, easing: 'ease-out' } as const;

/**
 * The message list. Each user message is grouped with the assistant reply that
 * follows it; the newest pair is tall enough to sit at the top of the viewport
 * so the reply streams in below the question instead of pushing it away.
 */
export function ChatConversation({
  messages,
  isLoading,
  lastPairMinHeight,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  lastPairMinHeight?: number;
}) {
  const pairs = useMemo(() => pairMessages(messages), [messages]);
  return (
    <div className="flex flex-col">
      {pairs.map((pair, index) => (
        <MessagePair
          key={pair.user.id}
          pair={pair}
          isLast={index === pairs.length - 1}
          isLoading={isLoading}
          minHeight={index === pairs.length - 1 ? lastPairMinHeight : undefined}
        />
      ))}
    </div>
  );
}

type Pair = { user: ChatMessage; assistant?: ChatMessage };

function pairMessages(messages: ChatMessage[]): Pair[] {
  const pairs: Pair[] = [];
  let current: Pair | null = null;
  for (const message of messages) {
    if (message.role === 'user') {
      if (current) pairs.push(current);
      current = { user: message };
    } else if (message.role === 'assistant' && current) {
      if (current.assistant && !message.parts?.length) continue;
      current.assistant = message;
    }
  }
  if (current) pairs.push(current);
  return pairs;
}

const LOADING_MESSAGE: ChatMessage = { id: 'loading', role: 'assistant', parts: [] };

const MessagePair = memo(
  function MessagePair({
    pair,
    isLast,
    isLoading,
    minHeight,
  }: {
    pair: Pair;
    isLast: boolean;
    isLoading: boolean;
    minHeight?: number;
  }) {
    const assistantLoading = isLast && isLoading;
    return (
      <div
        data-last-user-message-pair={isLast ? '' : undefined}
        className={cn('flex flex-col', isLast ? 'scroll-mt-2 pt-2 pb-6' : 'py-2')}
        style={minHeight ? { minHeight } : undefined}
      >
        <ChatMessageView message={pair.user} isLoading={false} />
        {pair.assistant ? (
          <ChatMessageView message={pair.assistant} isLoading={assistantLoading} />
        ) : assistantLoading ? (
          <ChatMessageView message={LOADING_MESSAGE} isLoading />
        ) : null}
      </div>
    );
  },
  (prev, next) =>
    prev.isLast === next.isLast &&
    prev.minHeight === next.minHeight &&
    prev.pair.user === next.pair.user &&
    prev.pair.assistant === next.pair.assistant &&
    (!next.isLast || prev.isLoading === next.isLoading),
);

export function ChatMessageView({
  message,
  isLoading,
}: {
  message: ChatMessage;
  isLoading: boolean;
}) {
  const parts = useMemo(() => message.parts ?? [], [message.parts]);

  if (message.role === 'user')
    return <UserMessage parts={parts} attachments={message.experimental_attachments ?? []} />;
  if (message.role !== 'assistant') return null;
  return <AssistantMessage id={message.id} parts={parts} isLoading={isLoading} />;
}

function UserMessage({
  parts,
  attachments,
}: {
  parts: ChatPart[];
  attachments: NonNullable<ChatMessage['experimental_attachments']>;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = parts
    .filter(isTextPart)
    .map((p) => p.text)
    .join('')
    .trim();
  if (!text && attachments.length === 0) return null;

  const canTruncate = text.length > USER_TEXT_MAX_LENGTH;
  const shown =
    canTruncate && !expanded ? `${text.slice(0, USER_TEXT_MAX_LENGTH).trimEnd()}…` : text;

  return (
    <Message from="user" className="flex-col items-end">
      <MessageAttachments attachments={attachments} />
      {text && (
        <MessageContent>
          {canTruncate ? (
            <button
              type="button"
              tabIndex={-1}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-left"
            >
              <Response>{shown}</Response>
            </button>
          ) : (
            <Response>{shown}</Response>
          )}
        </MessageContent>
      )}
    </Message>
  );
}

function AssistantMessage({
  id,
  parts,
  isLoading,
}: {
  id: string;
  parts: ChatPart[];
  isLoading: boolean;
}) {
  const { thinkingItems, displayItems } = useMemo(
    () => renderParts(parts, id, isLoading),
    [parts, id, isLoading],
  );
  const activeLabel = useMemo(() => (isLoading ? getActiveLabel(parts) : null), [parts, isLoading]);
  const sources = useMemo(() => (isLoading ? null : getMessageSources(parts)), [parts, isLoading]);

  if (!isLoading && thinkingItems.length === 0 && displayItems.length === 0) return null;

  return (
    <Message from="assistant">
      <MessageContent className="w-full gap-3">
        {(isLoading || thinkingItems.length > 0) && (
          <ThinkingGroup isComplete={!isLoading} activeLabel={activeLabel}>
            {thinkingItems}
          </ThinkingGroup>
        )}
        {displayItems}
        {sources && <MessageSources sources={sources} />}
      </MessageContent>
    </Message>
  );
}

/** What the loader should say right now, from the newest in-flight part. */
function getActiveLabel(parts: ChatPart[]): string {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (isTextPart(part)) {
      if (part.text.trim()) return WRITING_LABEL;
      continue;
    }
    if (isReasoningPart(part)) {
      if (i === parts.length - 1) return THINKING_LABEL;
      continue;
    }
    if (isToolPart(part) && part.toolInvocation.state !== 'result') {
      return getToolStatusLabel(part.toolInvocation.toolName);
    }
  }
  return THINKING_LABEL;
}

/**
 * Splits parts into the collapsible "thinking" steps (tool status lines,
 * reasoning) and the visible body (text, result cards), preserving order.
 */
function renderParts(parts: ChatPart[], messageId: string, isLoading: boolean) {
  const thinkingItems: ReactNode[] = [];
  const displayItems: ReactNode[] = [];
  let bufferedText = '';
  let textIndex = 0;

  const flushText = () => {
    const text = bufferedText.trim();
    bufferedText = '';
    if (!text) return;
    displayItems.push(
      <Response
        key={`${messageId}-text-${textIndex++}`}
        animated={isLoading ? STREAMING_ANIMATION : false}
        isAnimating={isLoading}
        mode={isLoading ? 'streaming' : 'static'}
      >
        {text}
      </Response>,
    );
  };

  parts.forEach((part, index) => {
    if (isTextPart(part)) {
      bufferedText += part.text;
      if (!isTextPart(parts[index + 1])) flushText();
      return;
    }

    if (isToolPart(part)) {
      const call = toToolCall(part, isLoading);
      const key = `${messageId}-tool-${call.toolCallId}`;
      if (DISPLAY_TOOL_NAMES.has(call.toolName) && call.status === 'complete') {
        displayItems.push(<ToolResult key={key} call={call} />);
      } else {
        thinkingItems.push(<ToolStatusLine key={key} call={call} />);
      }
      return;
    }

    if (isReasoningPart(part)) {
      const isComplete = !isLoading || index < parts.length - 1;
      if (part.reasoning || !isComplete) {
        thinkingItems.push(
          <ThinkingBlock
            // Message parts are append-only, so a part's position is its stable identity.
            // eslint-disable-next-line react/no-array-index-key
            key={`${messageId}-reasoning-${index}`}
            content={part.reasoning}
            isComplete={isComplete}
          />,
        );
      }
    }
  });
  flushText();

  return { thinkingItems, displayItems };
}
