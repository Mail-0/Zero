'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useRef, useCallback, useEffect } from 'react';
import { Markdown } from '@react-email/components';
import { useBilling } from '@/hooks/use-billing';
import { TextShimmer } from '../ui/text-shimmer';
import { useThread } from '@/hooks/use-threads';
import { cn, getEmailLogo } from '@/lib/utils';
import { CurvedArrow } from '../icons/icons';
import { useChat } from '@ai-sdk/react';
import { format } from 'date-fns-tz';
import { useQueryState } from 'nuqs';
import { Input } from '../ui/input';
import { useState } from 'react';
import VoiceChat from './voice';
import Image from 'next/image';

const renderThread = (thread: { id: string; title: string; snippet: string }) => {
  const [, setThreadId] = useQueryState('threadId');
  const { data: getThread } = useThread(thread.id);
  return getThread?.latest ? (
    <div
      onClick={() => setThreadId(thread.id)}
      key={thread.id}
      className="hover:bg-offsetLight/30 dark:hover:bg-offsetDark/30 cursor-pointer rounded-lg"
    >
      <div className="flex cursor-pointer items-center justify-between p-2">
        <div className="flex w-full items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage
              className="rounded-full"
              src={getEmailLogo(getThread.latest?.sender?.email)}
            />
            <AvatarFallback className="rounded-full bg-[#FFFFFF] font-bold text-[#9F9F9F] dark:bg-[#373737]">
              {getThread.latest?.sender?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex w-full items-center justify-between gap-2">
              <p className="text-sm font-medium text-black dark:text-white">
                {getThread.latest?.sender?.name}
              </p>
              <span className="max-w-[180px] truncate text-xs text-[#8C8C8C] dark:text-[#8C8C8C]">
                {getThread.latest.receivedOn ? format(getThread.latest.receivedOn, 'MMMM do') : ''}
              </span>
            </div>
            <span className="max-w-[220px] truncate text-xs text-[#8C8C8C] dark:text-[#8C8C8C]">
              {getThread.latest?.subject}
            </span>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

const RenderThreads = ({
  threads,
}: {
  threads: { id: string; title: string; snippet: string }[];
}) => {
  return <div className="flex flex-col gap-2">{threads.map(renderThread)}</div>;
};

const ExampleQueries = ({ onQueryClick }: { onQueryClick: (query: string) => void }) => {
  const firstRowQueries = [
    "Find invoice from Stripe",
    "Show unpaid invoices",
    "Show recent work feedback"
  ];
  
  const secondRowQueries = [
    "Find all work meetings",
    "What projects do i have coming up"
  ];

  return (
    <div className="mt-6 flex w-full flex-col items-center gap-2">
      {/* First row */}
      <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
        <div className="flex gap-4 px-4">
          {firstRowQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => onQueryClick(query)}
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]"
            >
              {query}
            </button>
          ))}
        </div>
        {/* Left mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 left-0 top-0 w-12 bg-gradient-to-r to-transparent"></div>
        {/* Right mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l to-transparent"></div>
      </div>

      {/* Second row */}
      <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
        <div className="flex gap-4 px-4">
          {secondRowQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => onQueryClick(query)}
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]"
            >
              {query}
            </button>
          ))}
        </div>
        {/* Left mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 left-0 top-0 w-12 bg-gradient-to-r to-transparent"></div>
        {/* Right mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l to-transparent"></div>
      </div>
    </div>
  );
};

export function AIChat() {
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { refetch, chatMessages } = useBilling();

  const { messages, input, setInput, error, handleSubmit, status } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  });

  useEffect(() => {
    if (messages.length) {
      refetch();
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Auto scroll when messages change
  useEffect(() => {
    scrollToBottom();
    // if (onMessagesChange) {
    //   onMessagesChange(messages);
    // }
  }, [messages, messagesEndRef]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
        <div className="min-h-full space-y-4 px-4 py-4">
          {chatMessages && !chatMessages.enabled ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p>No more</p>
            </div>
          ) : !messages.length ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-4 h-[44px] w-[44px]">
                <Image src="/black-icon.svg" alt="Zero Logo" fill className="dark:hidden" />
                <Image src="/white-icon.svg" alt="Zero Logo" fill className="hidden dark:block" />
              </div>
              <p className="mb-1 mt-2 hidden text-sm text-center font-medium text-black md:block dark:text-white">
                Ask anything about your emails
              </p>
              <p className="mb-3 text-sm text-center text-[#8C8C8C] dark:text-[#929292]">
                Ask to do or show anything using natural language
              </p>

              {/* Example Thread */}
              <ExampleQueries onQueryClick={(query) => {
                setInput(query);
                inputRef.current?.focus();
              }} />
            </div>
          ) : (
            messages.map((message, index) => {
              // Separate text and tool-invocation parts
              const textParts = message.parts.filter((part) => part.type === 'text');
              const toolParts = message.parts.filter((part) => part.type === 'tool-invocation');
              return (
                <div key={`${message.id}-${index}`} className="flex flex-col gap-2">
                  {/* Text in chat bubble */}
                  
                  {/* Threads below the bubble */}
                  {toolParts.map((part, idx) =>
                    'result' in part.toolInvocation && 'threads' in part.toolInvocation.result ? (
                      <RenderThreads threads={part.toolInvocation.result.threads} key={idx} />
                    ) : null,
                  )}
                  {textParts.length > 0 && (
                    <div
                      className={cn(
                        'flex w-fit flex-col gap-2 rounded-xl text-sm shadow',
                        message.role === 'user'
                          ? 'overflow-wrap-anywhere text-subtleWhite dark:text-offsetDark ml-auto break-words bg-[#313131] p-2 dark:bg-[#f0f0f0]'
                          : 'overflow-wrap-anywhere mr-auto break-words bg-[#f0f0f0] p-2 dark:bg-[#313131]',
                      )}
                    >
                      {textParts.map((part) => (
                        <Markdown key={part.text}>{part.text}</Markdown>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />

          {status === 'submitted' && (
            <div className="flex flex-col gap-2 rounded-lg">
              <div className="flex items-center gap-2">
                <TextShimmer className="text-muted-foreground text-sm">
                  zero is thinking...
                </TextShimmer>
              </div>
            </div>
          )}
          {(status === 'error' || !!error) && (
            <div className="text-sm text-red-500">Error, please try again later</div>
          )}
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className="mb-4 flex-shrink-0 px-4">
        <div className="bg-offsetLight border-border/50 relative rounded-lg dark:bg-[#141414]">
          {showVoiceChat ? (
            <VoiceChat onClose={() => setShowVoiceChat(false)} />
          ) : (
            <div className="flex flex-col">
              <div className="w-full">
                <form id="ai-chat-form" onSubmit={handleSubmit} className="relative">
                  <Input
                    ref={inputRef}
                    readOnly={!chatMessages.enabled}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask AI to do anything..."
                    className="placeholder:text-muted-foreground h-8 w-full resize-none rounded-lg bg-white px-3 py-2 pr-16 text-sm focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#202020]"
                  />
                  <button
                    form="ai-chat-form"
                    type="submit"
                    className="absolute right-1 top-1/2 inline-flex h-6 -translate-y-1/2 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg"
                    disabled={!input.trim() || status !== 'ready' || !chatMessages.enabled}
                  >
                    <div className="dark:bg[#141414] flex h-5 items-center justify-center gap-1 rounded-sm bg-black/10 px-1">
                      <CurvedArrow className="mt-1.5 h-4 w-4 fill-black dark:fill-[#929292]" />
                    </div>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
