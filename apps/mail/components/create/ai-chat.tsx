'use client';

import { ArrowUpIcon, Mic, CheckIcon, XIcon, Plus, Command, ArrowDownCircle } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearchValue } from '@/hooks/use-search-value';
import { useConnections } from '@/hooks/use-connections';
import { useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { CurvedArrow } from '../icons/icons';
import { AITextarea } from './ai-textarea';
import { useChat } from '@ai-sdk/react';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
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

interface AIChatProps {
  editor: any;
  onMessagesChange?: (messages: Message[]) => void;
  onReset?: () => void;
}

const renderThread = (thread: { id: string; title: string; snippet: string }) => {
  const [, setThreadId] = useQueryState('threadId');
  const { data: getThread } = useThread(thread.id);
  return getThread ? (
    <div
      onClick={() => setThreadId(thread.id)}
      key={thread.id}
      className="bg-subtleBlack cursor-pointer rounded-md border p-2 hover:bg-black"
    >
      <p>{getThread.latest?.subject}</p>
    </div>
  ) : null;
};

const RenderThreads = ({
  threads,
}: {
  threads: { id: string; title: string; snippet: string }[];
}) => {
  const [, setThreadId] = useQueryState('threadId');
  return threads.map(renderThread);
};

export function AIChat({ editor, onMessagesChange, onReset }: AIChatProps) {
  const [value, setValue] = useState('');
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [searchValue, setSearchValue] = useSearchValue();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { data: connections } = useConnections();

  const { messages, input, setInput, error, handleSubmit, status } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  });

  // Scroll to bottom function
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
  }, [messages, onMessagesChange, scrollToBottom]);

  useEffect(() => {
    if (onReset) {
      onReset();
    }
  }, [onReset]);

  //   const handleSendMessage = async () => {
  //     if (!value.trim() || isLoading) return;

  //     const userMessage: Message = {
  //       id: generateId(),
  //       role: 'user',
  //       content: value.trim(),
  //       timestamp: new Date(),
  //     };

  //     setMessages((prev) => [...prev, userMessage]);
  //     setValue('');
  //     setIsLoading(true);

  //     try {
  //       if (!response.ok) {
  //         throw new Error('Failed to get response');
  //       }

  //       const data = await response.json();

  //       // Update the search value
  //       setSearchValue({
  //         value: data.searchQuery,
  //         highlight: value.trim(),
  //         isLoading: false,
  //         isAISearching: false,
  //         folder: searchValue.folder,
  //       });

  //       // Add assistant message with search results
  //       const assistantMessage: Message = {
  //         id: generateId(),
  //         role: 'assistant',
  //         content: data.content,
  //         timestamp: new Date(),
  //         type: 'search',
  //         searchContent: {
  //           searchDisplay: data.searchDisplay,
  //           results: data.results,
  //         },
  //       };

  //       setMessages((prev) => [...prev, assistantMessage]);
  //     } catch (error) {
  //       console.error('Error:', error);
  //       toast.error('Failed to generate response. Please try again.');
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };

  const handleAcceptSuggestion = (emailContent: { subject?: string; content: string }) => {
    if (!editor) {
      toast.error('Editor not found');
      return;
    }

    try {
      // Format the content to preserve line breaks
      const formattedContent = emailContent.content
        .split('\n')
        .map((line) => `<p>${line}</p>`)
        .join('');

      // Set the content in the editor
      editor.commands.setContent(formattedContent);

      // Find the create-email component and update its content
      const createEmailElement = document.querySelector('[data-create-email]');
      if (createEmailElement) {
        const handler = (createEmailElement as any).onContentGenerated;
        if (handler && typeof handler === 'function') {
          handler({ content: emailContent.content, subject: emailContent.subject });
        }
      }

      toast.success('Email content applied successfully');
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast.error('Failed to apply email content');
    }
  };

  const handleRejectSuggestion = (messageId: string) => {
    toast.info('Email suggestion rejected');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const generateId = () => nanoid();

  const handleThreadClick = (threadId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('threadId', threadId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleExpandResults = (messageId: string) => {
    setExpandedResults((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const sanitizeSnippet = (snippet: string) => {
    return snippet
      .replace(/<\/?[^>]+(>|$)/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages container */}
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
                      Schedule meeting with Sarah
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
                  'flex w-fit max-w-[80%] flex-col gap-2 rounded-xl text-sm shadow',
                  message.role === 'user'
                    ? 'overflow-wrap-anywhere ml-auto break-words bg-[#f0f0f0] p-2 dark:bg-[#313131]' // User messages aligned to right
                    : 'overflow-wrap-anywhere mr-auto break-words bg-[#f0f0f0] p-3 dark:bg-[#313131]', // Assistant messages aligned to left
                )}
              >
                {/* <div className="prose dark:prose-invert overflow-wrap-anywhere break-words text-sm font-medium">
                  {message.content}
                </div> */}

                {message.parts.map((part) => {
                  if (part.type === 'text') {
                    return <p>{part.text}</p>;
                  }
                  if (part.type === 'reasoning') {
                    return <p>Reasoning: {part.reasoning}</p>;
                  }
                  if (part.type === 'tool-invocation') {
                    return (
                      'result' in part.toolInvocation &&
                      ('threads' in part.toolInvocation.result ? (
                        <RenderThreads threads={part.toolInvocation.result.threads} />
                      ) : (
                        <p>No threads found</p>
                      ))
                    );
                  }
                  if (part.type === 'source') {
                    return <p>Source: {part.source.title}</p>;
                  }
                  //   if (part.type === 'step-start') {
                  //     return <ArrowDownCircle className="mx-auto h-4 w-4" />;
                  //   }
                  //   return <p>{part.type}</p>;
                })}

                {/* {message.type === 'search' &&
                message.searchContent &&
                message.searchContent.results.length > 0 && (
                  <div className="bg-muted space-y-4 rounded-lg px-4 pt-3">
                    {(expandedResults.has(message.id)
                      ? message.searchContent.results
                      : message.searchContent.results.slice(0, 5)
                    ).map((result: any, i: number) => (
                      <div key={i} className="border-t pt-4 first:border-t-0 first:pt-0">
                        <div className="font-medium">
                          <p className="max-w-sm truncate text-sm">
                            {result.subject.toLowerCase().includes('meeting') ? (
                              <span className="text-blue-500">📅 {result.subject}</span>
                            ) : (
                              result.subject || 'No subject'
                            )}
                          </p>
                          <span className="text-muted-foreground text-sm">
                            from {result.from || 'Unknown sender'}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {sanitizeSnippet(result.snippet)}
                        </div>
                        <div className="text-muted-foreground mt-1 text-sm">
                          <button
                            onClick={() => handleThreadClick(result.id)}
                            className="cursor-pointer border-none bg-transparent p-0 text-blue-500 hover:underline"
                          >
                            Open email
                          </button>
                        </div>
                      </div>
                    ))}
                    {message.searchContent.results.length > 5 && (
                      <Button
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground w-full"
                        onClick={() => toggleExpandResults(message.id)}
                      >
                        {expandedResults.has(message.id)
                          ? `Show less (${message.searchContent.results.length - 5} fewer results)`
                          : `Show more (${message.searchContent.results.length - 5} more results)`}
                      </Button>
                    )}
                  </div>
                )}

              {message.type === 'email' && message.emailContent && (
                <div className="bg-background mt-4 rounded border p-4 font-mono text-sm">
                  {message.emailContent.subject && (
                    <div className="mb-2 text-blue-500">
                      Subject: {message.emailContent.subject}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{message.emailContent.content}</div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-green-500/20 hover:bg-green-500/10 hover:text-green-500"
                      onClick={() => handleAcceptSuggestion(message.emailContent!)}
                    >
                      <CheckIcon className="mr-1 h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/20 hover:bg-destructive/10 hover:text-destructive h-8"
                      onClick={() => handleRejectSuggestion(message.id)}
                    >
                      <XIcon className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              )} */}
              </div>
            ))
          )}
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />

          {JSON.stringify(error)}
          {/* Loading indicator */}
          {status === 'submitted' && (
            <div className="flex flex-col gap-2 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">zero is thinking...</span>
              </div>
            </div>
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
              <div className="flex items-center justify-between">
                <div></div>
                <button
                  form="ai-chat-form"
                  type="submit"
                  className="border-border/50 inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border bg-white pl-1.5 pr-1 dark:bg-[#262626]"
                  disabled={!input.trim()}
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
