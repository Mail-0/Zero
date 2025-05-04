'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useSearchValue } from '@/hooks/use-search-value';
import { useConnections } from '@/hooks/use-connections';
import { useRef, useCallback, useEffect } from 'react';
import { Markdown } from '@react-email/components';
import { TextShimmer } from '../ui/text-shimmer';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { cn, getEmailLogo } from '@/lib/utils';
import { CurvedArrow } from '../icons/icons';
import { AITextarea } from './ai-textarea';
import { useChat } from '@ai-sdk/react';
import { format } from 'date-fns-tz';
import { useQueryState } from 'nuqs';
import { useState } from 'react';
import VoiceChat from './voice';
import { nanoid } from 'nanoid';
import Image from 'next/image';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'email' | 'search';
  emailContent?: {
    subject?: string;
    content: string;
  };
  searchContent?: {
    searchDisplay: string;
    results: Array<{
      id: string;
      snippet: string;
      historyId: string;
      subject: string;
      from: string;
    }>;
  };
}

const renderThread = (thread: { id: string; title: string; snippet: string }) => {
  const [, setThreadId] = useQueryState('threadId');
  const { data: getThread } = useThread(thread.id);
  return getThread?.latest ? (
    <div
      onClick={() => setThreadId(thread.id)}
      key={thread.id}
      className="dark:bg-subtleBlack bg-subtleWhite hover:bg-offsetLight/30 dark:hover:bg-offsetDark/30 cursor-pointer rounded-lg border p-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              className="rounded-full"
              src={getEmailLogo(getThread.latest?.sender?.email)}
            />
            <AvatarFallback className="rounded-full bg-[#FFFFFF] font-bold text-[#9F9F9F] dark:bg-[#373737]">
              {getThread.latest?.sender?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium text-black dark:text-white">
            {getThread.latest?.sender?.name}
          </p>
        </div>
        <div>
          {getThread.latest.receivedOn ? (
            <p
              className={cn(
                'text-nowrap text-xs font-normal text-[#6D6D6D] opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]',
              )}
            >
              {format(getThread.latest.receivedOn, 'dd/MM/yy hh:mm a')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mb-1 ml-0.5 mt-2 flex items-center gap-2">
        <p className="overflow-wrap opacity-50">{getThread.latest?.subject}</p>
      </div>
      {/* <p className="text-xs font-normal text-[#6D6D6D] opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]">
        {getThread.latest?.title}
      </p> */}
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

export function AIChat() {
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { messages, input, setInput, error, handleSubmit, status, setMessages } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  });

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
          {!messages.length ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-4 h-[44px] w-[44px]">
                <Image src="/black-icon.svg" alt="Zero Logo" fill className="dark:hidden" />
                <Image src="/white-icon.svg" alt="Zero Logo" fill className="hidden dark:block" />
              </div>
              <p className="mb-1 mt-2 hidden text-sm font-medium text-black md:block dark:text-white">
                Ask anything about your emails
              </p>
              <p className="mb-3 text-sm text-[#8C8C8C] dark:text-[#929292]">
                Ask to do or show anything using natural language
              </p>

              <div className="mt-6 flex w-full flex-col items-center gap-2">
                {/* First row */}
                <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
                  <div className="flex gap-4 px-4">
                    <p className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]">
                      Find invoice from Stripe
                    </p>
                    <p className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]">
                      Reply to Nick
                    </p>
                    <p className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]">
                      Show recent design feedback
                    </p>
                  </div>
                  {/* Left mask */}
                  <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 left-0 top-0 w-12 bg-gradient-to-r to-transparent"></div>
                  {/* Right mask */}
                  <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l to-transparent"></div>
                </div>

                {/* Second row */}
                <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
                  <div className="flex gap-4 px-4">
                    <p className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]">
                      Find meeting with Sarah
                    </p>
                    <p className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]">
                      What did alex say about the design
                    </p>
                  </div>
                  {/* Left mask */}
                  <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 left-0 top-0 w-12 bg-gradient-to-r to-transparent"></div>
                  {/* Right mask */}
                  <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l to-transparent"></div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.id}-${index}`}
                className={cn(
                  'flex w-fit flex-col gap-2 rounded-xl text-sm shadow',
                  message.role === 'user'
                    ? 'overflow-wrap-anywhere text-subtleWhite dark:text-offsetDark ml-auto break-words bg-[#313131] p-2 dark:bg-[#f0f0f0]' // User messages aligned to right
                    : 'overflow-wrap-anywhere mr-auto break-words bg-[#f0f0f0] p-2 dark:bg-[#313131]', // Assistant messages aligned to left
                )}
              >
                {message.parts.map((part) => {
                  if (part.type === 'text') {
                    return <Markdown>{part.text}</Markdown>;
                  }
                  if (part.type === 'tool-invocation') {
                    return (
                      'result' in part.toolInvocation &&
                      ('threads' in part.toolInvocation.result ? (
                        <RenderThreads threads={part.toolInvocation.result.threads} />
                      ) : null)
                    );
                  }
                })}
              </div>
            ))
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
            <div className="text-red-500">Error, please try again later</div>
          )}
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className="mb-[7px] flex-shrink-0 px-1.5">
        <div className="bg-offsetLight border-border/50 relative rounded-2xl border dark:bg-[#141414]">
          {showVoiceChat ? (
            <VoiceChat onClose={() => setShowVoiceChat(false)} />
          ) : (
            <div className="flex flex-col p-2">
              <div className="mb-2 w-full">
                <form id="ai-chat-form" onSubmit={handleSubmit}>
                  <AITextarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask AI to do anything..."
                    className="placeholder:text-muted-foreground h-[44px] w-full resize-none rounded-[5px] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </form>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="border-border/50 inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border bg-white pl-1.5 pr-1 dark:bg-[#262626]"
                  onClick={async () => {
                    try {
                      const userInput = input;
                      setInput('');
                      
                      const userMessage = {
                        id: nanoid(),
                        role: 'user' as const,
                        content: userInput,
                        createdAt: new Date(),
                        parts: [{ type: 'text' as const, text: userInput }]
                      };
                      
                      const updatedMessages = [...messages, userMessage];
                      setMessages(updatedMessages);
                      
                      const response = await fetch('/api/mcp', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ messages: updatedMessages }),
                      });

                      if (!response.ok) {
                        throw new Error('MCP request failed');
                      }
                      
                      const data = await response.json();
                      
                      const assistantMessage = {
                        id: nanoid(),
                        role: 'assistant' as const,
                        content: data.content || "No response received",
                        createdAt: new Date(),
                        parts: [{ type: 'text' as const, text: data.content || "No response received" }]
                      };
                      
                      setMessages([...updatedMessages, assistantMessage]);
                    } catch (error) {
                      toast.error('Failed to connect to MCP');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-2.5 pl-0.5">
                    <div className="justify-start text-center text-sm leading-none text-black dark:text-white">
                      MCP Send{' '}
                    </div>
                  </div>
                  <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-black/10 px-1 dark:bg-white/10">
                    <CurvedArrow className="mt-1.5 h-4 w-4 fill-black dark:fill-[#929292]" />
                  </div>
                </button>
                <button
                  form="ai-chat-form"
                  type="submit"
                  className="border-border/50 inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border bg-white pl-1.5 pr-1 dark:bg-[#262626]"
                  disabled={!input.trim() || status !== 'ready'}
                >
                  <div className="flex items-center justify-center gap-2.5 pl-0.5">
                    <div className="justify-start text-center text-sm leading-none text-black dark:text-white">
                      Send{' '}
                    </div>
                  </div>
                  <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-black/10 px-1 dark:bg-white/10">
                    <CurvedArrow className="mt-1.5 h-4 w-4 fill-black dark:fill-[#929292]" />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
