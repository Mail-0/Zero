import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAIFullScreen, useAISidebar } from '../ui/ai-sidebar';
import { VoiceProvider } from '@/providers/voice-provider';
import useComposeEditor from '@/hooks/use-compose-editor';
import { useRef, useCallback, useEffect } from 'react';
import { Markdown } from '@react-email/components';
import { useBilling } from '@/hooks/use-billing';
import { TextShimmer } from '../ui/text-shimmer';
import { useThread } from '@/hooks/use-threads';
import { MailLabels } from '../mail/mail-list';
import { cn, getEmailLogo } from '@/lib/utils';
import { VoiceButton } from '../voice-button';
import { EditorContent } from '@tiptap/react';
import { CurvedArrow } from '../icons/icons';
import { Tools } from '../../types/tools';
import { Button } from '../ui/button';
import { format } from 'date-fns-tz';
import { useQueryState } from 'nuqs';

const ThreadPreview = ({ threadId }: { threadId: string }) => {
  const [, setThreadId] = useQueryState('threadId');
  const { data: getThread } = useThread(threadId);
  const [, setIsFullScreen] = useQueryState('isFullScreen');

  const handleClick = () => {
    setThreadId(threadId);
    setIsFullScreen(null);
  };

  if (!getThread?.latest) return null;

  return (
    <div
      onClick={handleClick}
      key={threadId}
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
              <p className="max-w-[20ch] truncate text-sm font-medium text-black dark:text-white">
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
  );
};

const ExampleQueries = ({ onQueryClick }: { onQueryClick: (query: string) => void }) => {
  
  const firstRowQueries = [
    'Find invoice from Stripe',
    'Show unpaid invoices',
    'Show recent work feedback',
  ];

  const secondRowQueries = ['Find all work meetings', 'What projects do i have coming up'];

  return (
    <div className="mt-6 flex w-full max-w-xl relative flex-col items-center gap-2">
      {/* First row */}
      <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
        <div className="flex gap-4 px-4">
          {firstRowQueries.map((query) => (
            <button
              key={query}
              onClick={() => onQueryClick(query)}
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]">
              {query}
            </button>
          ))}
        </div>
      </div>
      {/* Second row */}
      <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
        <div className="flex gap-4 px-4">
          {secondRowQueries.map((query) => (
            <button
              key={query}
              onClick={() => onQueryClick(query)}
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]"
            >
              {query}
            </button>
          ))}
        </div>
      </div>
      {/* Left mask */}
      <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 left-0 top-0 w-12 bg-gradient-to-r to-transparent"></div>
      {/* Right mask */}
      <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l to-transparent"></div>
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
      args?: any;
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

// Subcomponents for ToolResponse
const GetThreadToolResponse = ({ result, args }: { result: any; args: any }) => {
  // Extract threadId from result or args
  let threadId: string | null = null;
  if (typeof result === 'string') {
    const match = result.match(/<thread id="([^"]+)" ?\/>/);
    if (match?.[1]) threadId = match[1];
  }
  if (!threadId && args?.id && typeof args.id === 'string') threadId = args.id;
  if (!threadId) return null;
  return <ThreadPreview threadId={threadId} />;
};

const GetUserLabelsToolResponse = ({ result }: { result: any }) => {
  if (!result?.labels) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {result.labels.map((label: any) => (
        <MailLabels key={label.id} labels={[label]} />
      ))}
    </div>
  );
};

const ComposeEmailToolResponse = ({ result }: { result: any }) => {
  if (!result?.newBody) return null;
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="prose dark:prose-invert max-w-none">
        <Markdown>{result.newBody}</Markdown>
      </div>
    </div>
  );
};

// Main ToolResponse switcher
const ToolResponse = ({ toolName, result, args }: { toolName: string; result: any; args: any }) => {
  switch (toolName) {
    case Tools.GetThread:
      return <GetThreadToolResponse result={result} args={args} />;
    case Tools.GetUserLabels:
      return <GetUserLabelsToolResponse result={result} />;
    case Tools.ComposeEmail:
      return <ComposeEmailToolResponse result={result} />;
    default:
      return null;
  }
};

export function AIChat({
  messages,
  setInput,
  error,
  handleSubmit,
  status,
}: AIChatProps): React.ReactElement {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { chatMessages } = useBilling();
  const { isFullScreen } = useAIFullScreen();
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const [aiSidebarOpen] = useQueryState('aiSidebar');
  const { toggleOpen } = useAISidebar();

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!['submitted', 'streaming'].includes(status)) {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  const editor = useComposeEditor({
    placeholder: 'Ask Zero to do anything...',
    onLengthChange: () => setInput(editor.getText()),
    onKeydown(event) {
      if (event.key === '0' && event.metaKey) {
        return toggleOpen();
      }

      if (event.key === 'Enter' && !event.metaKey && !event.shiftKey) {
        onSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
      }
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(e);
    editor.commands.clearContent(true);
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const handleQueryClick = (query: string) => {
    editor.commands.setContent(query);
    setInput(query);
    editor.commands.focus();
  };

  useEffect(() => {
    if (aiSidebarOpen === 'true') {
      editor.commands.focus();
    }
  }, [aiSidebarOpen, editor]);

  return (
    <div className={cn('flex h-full flex-col', isFullScreen ? 'mx-auto max-w-xl' : '')}>
      <div className="no-scrollbar flex-1 overflow-y-auto" ref={messagesContainerRef}>
        <div className="min-h-full px-2 py-4">
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
              <ExampleQueries onQueryClick={handleQueryClick} />
            </div>
          ) : (
            messages.map((message, index) => {
              const textParts = message.parts.filter((part) => part.type === 'text');
              const toolParts = message.parts.filter((part) => part.type === 'tool-invocation');

              return (
                <div key={`${message.id}-${index}`} className="mb-2 flex flex-col">
                  {toolParts.map(
                    (part, index) =>
                      part.toolInvocation?.result && (
                        <ToolResponse
                          key={`${part.toolInvocation.toolName}-${index}`}
                          toolName={part.toolInvocation.toolName}
                          result={part.toolInvocation.result}
                          args={part.toolInvocation.args}
                        />
                      ),
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
                          part.text && (
                            <Markdown
                              markdownCustomStyles={{
                                h1: { fontSize: '1rem' },
                                h2: { fontSize: '1rem' },
                                h3: { fontSize: '1rem' },
                                h4: { fontSize: '1rem' },
                                h5: { fontSize: '1rem' },
                                h6: { fontSize: '1rem' },
                                p: { fontSize: '1rem' },
                                li: {
                                  fontSize: '1rem',
                                  marginBottom: '0.25rem',
                                  listStyleType: 'disc',
                                  listStylePosition: 'inside',
                                },
                                ul: { fontSize: '1rem' },
                                ol: { fontSize: '1rem' },
                                blockQuote: { fontSize: '1rem' },
                                codeBlock: { fontSize: '1rem' },
                                codeInline: { fontSize: '1rem' },
                                link: { fontSize: '1rem' },
                                image: { fontSize: '1rem' },
                              }}
                              key={part.text}
                            >
                              {part.text || ' '}
                            </Markdown>
                          ),
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {(status === 'submitted' || status === 'streaming') && (
            <div className="absolute bottom-0 ml-2 flex items-center gap-2">
              <TextShimmer className="text-muted-foreground text-xs">
                zero is thinking...
              </TextShimmer>
            </div>
          )}
          {(status === 'error' || !!error) && (
            <div className="text-sm text-red-500">Error, please try again later</div>
          )}
          <div className="h-0 w-0" ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className={cn('mb-4 flex-shrink-0 px-4', isFullScreen ? 'px-0' : '')}>
        <div className="bg-offsetLight relative rounded-lg p-2 dark:bg-[#202020]">
          <div className="flex flex-col">
            <div className="w-full">
              <form id="ai-chat-form" onSubmit={onSubmit} className="relative">
                <div className="grow self-stretch overflow-y-auto outline-white/5 dark:bg-[#202020]">
                  <div
                    onClick={() => {
                      editor.commands.focus();
                    }}
                    className={cn('max-h-[100px] w-full')}
                  >
                    <EditorContent editor={editor} className="h-full w-full" />
                  </div>
                </div>
              </form>
            </div>
            <div className="grid">
              <div className="flex justify-end gap-1">
                <VoiceProvider>
                  <VoiceButton />
                </VoiceProvider>
                <button
                  form="ai-chat-form"
                  type="submit"
                  className="inline-flex cursor-pointer gap-1.5 rounded-lg"
                  disabled={!chatMessages.enabled}
                >
                  <div className="dark:bg[#141414] flex h-7 items-center justify-center gap-1 rounded-sm bg-[#262626] px-2 pr-1">
                    <CurvedArrow className="mt-1.5 h-4 w-4 fill-white dark:fill-[#929292]" />
                  </div>
                </button>
              </div>
            </div>
          </div>
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
