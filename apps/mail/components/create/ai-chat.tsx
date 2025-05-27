import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { CurvedArrow, Puzzle, Stop } from '../icons/icons';
import { useRef, useCallback, useEffect } from 'react';
import { PricingDialog } from '../ui/pricing-dialog';
import { Markdown } from '@react-email/components';
import { useAIFullScreen } from '../ui/ai-sidebar';
import { useBilling } from '@/hooks/use-billing';
import { TextShimmer } from '../ui/text-shimmer';
import { useThread } from '@/hooks/use-threads';
import { MailLabels } from '../mail/mail-list';
import { cn, getEmailLogo } from '@/lib/utils';
import { Button } from '../ui/button';
import { format } from 'date-fns-tz';
import { useQueryState } from 'nuqs';
import { Input } from '../ui/input';
import { useState } from 'react';
import VoiceChat from './voice';

const renderThread = (thread: { id: string; title: string; snippet: string }) => {
  const [, setThreadId] = useQueryState('threadId');
  const { data: getThread } = useThread(thread.id);
  const [, setAiSidebarOpen] = useQueryState('aiSidebar');
  const [, setIsFullScreen] = useQueryState('isFullScreen');

  const handleClick = () => {
    setThreadId(thread.id);
    setAiSidebarOpen(null);
    // Reset fullscreen state when clicking on a thread
    setIsFullScreen(null);
  };

  return getThread?.latest ? (
    <div
      onClick={handleClick}
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
            <div className="flex items-center justify-between">
              <span className="max-w-[220px] truncate text-xs text-[#8C8C8C] dark:text-[#8C8C8C]">
                {getThread.latest?.subject}
              </span>
              <MailLabels labels={getThread.latest?.tags || []} />
            </div>
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
    'Find invoice from Stripe',
    'Show unpaid invoices',
    'Show recent work feedback',
  ];

  const secondRowQueries = ['Find all work meetings', 'What projects do i have coming up'];

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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'data' | 'system';
  parts: Array<{
    type: string;
    text?: string;
    toolInvocation?: {
      toolName: string;
      result?: {
        threads?: Array<{ id: string; title: string; snippet: string }>;
      };
    };
  }>;
}

export interface AIChatProps {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  error?: Error;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string;
  stop: () => void;
  className?: string;
  onModelChange?: (model: string) => void;
}

export function AIChat({
  messages,
  input,
  setInput,
  error,
  handleSubmit,
  status,
  stop,
}: AIChatProps): React.ReactElement {
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { chatMessages } = useBilling();
  const { isFullScreen } = useAIFullScreen();
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className={cn('flex h-full flex-col', isFullScreen ? 'mx-auto max-w-xl' : '')}>
      <div className="no-scrollbar flex-1 overflow-y-auto" ref={messagesContainerRef}>
        <div className="min-h-full space-y-4 px-2 py-4">
          {chatMessages && !chatMessages.enabled ? (
            <div
              onClick={() => setPricingDialog('true')}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <TextShimmer className="text-center text-xl font-medium">
                Upgrade to Zero Pro for unlimited AI chat
              </TextShimmer>
              <Button className="mt-2 h-8 w-52">Start 7 day free trial</Button>
            </div>
          ) : !messages.length ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-4 h-[44px] w-[44px]">
                <img src="/black-icon.svg" alt="Zero Logo" className="dark:hidden" />
                <img src="/white-icon.svg" alt="Zero Logo" className="hidden dark:block" />
              </div>
              <p className="mb-1 mt-2 hidden text-center text-sm font-medium text-black md:block dark:text-white">
                Ask anything about your emails
              </p>
              <p className="mb-3 text-center text-sm text-[#8C8C8C] dark:text-[#929292]">
                Ask to do or show anything using natural language
              </p>

              {/* Example Thread */}
              <ExampleQueries
                onQueryClick={(query) => {
                  setInput(query);
                  inputRef.current?.focus();
                }}
              />
            </div>
          ) : (
            messages.map((message, index) => {
              // Separate text and tool-invocation parts
              const textParts = message.parts.filter((part) => part.type === 'text');
              const toolParts = message.parts.filter((part) => part.type === 'tool-invocation');
              return (
                <div key={`${message.id}-${index}`} className="flex flex-col gap-2">
                  {toolParts.map((part, idx) =>
                    part.toolInvocation &&
                    'result' in part.toolInvocation &&
                    part.toolInvocation.result &&
                    'threads' in part.toolInvocation.result ? (
                      <RenderThreads threads={part.toolInvocation.result.threads ?? []} key={idx} />
                    ) : null,
                  )}
                  {textParts.length > 0 && (
                    <div
                      className={cn(
                        'flex w-fit flex-col gap-2 rounded-lg text-sm',
                        message.role === 'user'
                          ? 'overflow-wrap-anywhere text-offsetDark dark:text-subtleWhite ml-auto break-words bg-[#f0f0f0] px-2 py-1 dark:bg-[#252525]'
                          : 'overflow-wrap-anywhere mr-auto break-words p-2',
                      )}
                    >
                      {textParts.map(
                        (part) =>
                          part.text && <Markdown key={part.text}>{part.text || ' '}</Markdown>,
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />

          {(status === 'submitted' || status === 'streaming') && (
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
      <div className={cn('mb-4 flex-shrink-0 px-4', isFullScreen ? 'px-0' : '')}>
        <div className="bg-offsetLight relative rounded-lg dark:bg-[#141414]">
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
                    placeholder="Ask Zero to do anything..."
                    className="placeholder:text-muted-foreground h-8 w-full resize-none rounded-lg border-none bg-white px-3 py-2 pr-10 text-sm ring-0 focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#141414]"
                  />
                  {status === 'ready' ? (
                    <button
                      form="ai-chat-form"
                      type="submit"
                      className="absolute right-1 top-1/2 inline-flex h-6 -translate-y-1/2 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg"
                      disabled={!input.trim() || !chatMessages.enabled}
                    >
                      <div className="dark:bg[#141414] flex h-5 items-center justify-center gap-1 rounded-sm bg-[#262626] px-1 pr-0.5">
                        <CurvedArrow className="mt-1.5 h-4 w-4 fill-white dark:fill-[#929292]" />
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={stop}
                      type="button"
                      className="absolute right-1 top-1/2 inline-flex h-6 -translate-y-1/2 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg"
                    >
                      <div className="flex h-5 items-center justify-center gap-1 rounded-sm px-1">
                        <Stop className="h-4 w-4 fill-[#DE5555]" />
                      </div>
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>

        {/* <div className="flex items-center justify-end gap-1">
        <div className="mt-1 flex items-center justify-end relative z-10">
          <Select
           
          >
            <SelectTrigger className="flex h-6 w-fit cursor-pointer items-center justify-between gap-1 border-0 dark:bg-[#141414] px-2 text-xs hover:bg-[#1E1E1E]">
              <div className="flex items-center gap-1.5 w-full">
                <Puzzle className="h-3.5 w-3.5 fill-white dark:fill-[#929292]" />
              </div>
              
            </SelectTrigger>
            <SelectContent className="w-[190px] rounded-md border-0 bg-[#1E1E1E] p-0.5 shadow-md">
              <SelectItem
                value="gpt-3.5"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[#2A2A2A]"
              >
                <div className="flex items-center gap-1.5 pl-6">
                  <img src="/openai.png" alt="OpenAI" className="h-3.5 w-3.5 dark:invert" />
                  <span className="whitespace-nowrap">GPT 3.5</span>
                </div>
              </SelectItem>
              <SelectItem
                value="claude-3.5"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[#2A2A2A]"
              >
                <div className="flex items-center gap-1.5 pl-6">
                  <img src="/claude.png" alt="Claude" className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">Claude 3.5</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-1 flex items-center justify-end relative z-10">
          <Select
            value={selectedModel}
            onValueChange={(value) => {
              setSelectedModel(value);
              onModelChange?.(value);
            }}
          >
            <SelectTrigger className="flex h-6 w-fit cursor-pointer items-center justify-between gap-1 border-0 dark:bg-[#141414] px-2 text-xs hover:bg-[#1E1E1E]">
              <div className="flex items-center gap-1.5 w-full">
                {selectedModel === 'gpt-3.5' ? (
                  <img src="/openai.png" alt="OpenAI" className="h-3.5 w-3.5 dark:invert" />
                ) : (
                  <img src="/claude.png" alt="Claude" className="h-3.5 w-3.5" />
                )}
              </div>
              
            </SelectTrigger>
            <SelectContent className="w-[190px] rounded-md border-0 bg-[#1E1E1E] p-0.5 shadow-md">
              <SelectItem
                value="gpt-3.5"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[#2A2A2A]"
              >
                <div className="flex items-center gap-1.5 pl-6">
                  <img src="/openai.png" alt="OpenAI" className="h-3.5 w-3.5 dark:invert" />
                  <span className="whitespace-nowrap">GPT 3.5</span>
                </div>
              </SelectItem>
              <SelectItem
                value="claude-3.5"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-[#2A2A2A]"
              >
                <div className="flex items-center gap-1.5 pl-6">
                  <img src="/claude.png" alt="Claude" className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">Claude 3.5</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div> */}
      </div>
    </div>
  );
}
