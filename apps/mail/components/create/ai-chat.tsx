'use client';

import { ArrowUpIcon, Mic, CheckIcon, XIcon, Plus, Command } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearchValue } from '@/hooks/use-search-value';
import { useConnections } from '@/hooks/use-connections';
import { useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { CurvedArrow } from '../icons/icons';
import { AITextarea } from './ai-textarea';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import VoiceChat from './voice';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import Link from 'next/link';

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
}

export function AIChat({ editor, onMessagesChange }: AIChatProps) {
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [searchValue, setSearchValue] = useSearchValue();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { data: connections } = useConnections();

  const activeAccount = connections?.find((connection) => connection.id === session?.connectionId);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Auto scroll when messages change
  useEffect(() => {
    scrollToBottom();
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!value.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: value.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setValue('');
    setIsLoading(true);

    try {
      // Always treat messages as search requests for now
      const response = await fetch('/api/ai-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Update the search value
      setSearchValue({
        value: data.searchQuery,
        highlight: value.trim(),
        isLoading: false,
        isAISearching: false,
        folder: searchValue.folder,
      });

      // Add assistant message with search results
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        type: 'search',
        searchContent: {
          searchDisplay: data.searchDisplay,
          results: data.results,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to generate response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
      handleSendMessage();
    }
  };

  const generateId = () => nanoid();

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return date.toLocaleDateString();
  };

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsLoading(true);
      // Create FormData to send files
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      // Send files to your API endpoint
      const response = await fetch('/api/upload-files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      const data = await response.json();

      // Add a message with the uploaded files
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: `I've uploaded ${files.length} file(s)`,
        timestamp: new Date(),
        type: 'email',
        emailContent: {
          content: `Files uploaded: ${Array.from(files)
            .map((f) => f.name)
            .join(', ')}`,
        },
      };

      setMessages((prev) => [...prev, userMessage]);
      toast.success('Files uploaded successfully');
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsLoading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
        <div className="min-h-full space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg',
                message.role === 'user' ? 'border-border border bg-[] p-4' : '',
              )}
            >
              <div className="flex items-center gap-2">
                {message.role === 'user' ? (
                  <>
                    <Avatar className="size-6 rounded-lg">
                      <AvatarImage
                        className="rounded-lg"
                        src={
                          (activeAccount?.picture ?? undefined) ||
                          (session?.user.image ?? undefined)
                        }
                        alt={activeAccount?.name || session?.user.name || 'User'}
                      />
                      <AvatarFallback className="rounded-lg text-xs">
                        {(activeAccount?.name || session?.user.name || 'User')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {activeAccount?.name || session?.user.name || 'You'}
                    </span>
                  </>
                ) : (
                  <>
                    <Avatar className="size-5">
                      <AvatarImage src="/white-icon.svg" alt="Zero" />
                      <AvatarFallback className="rounded-lg text-xs">Zero</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">Zero</span>
                  </>
                )}
                <span className="text-muted-foreground text-sm">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>

              <div className="prose dark:prose-invert">{message.content}</div>

              {message.type === 'search' &&
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
              )}
            </div>
          ))}
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex flex-col gap-2 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">zero is thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className="mb-[17px] ml-1.5 flex-shrink-0">
        <div className="bg-offsetLight border-border/50 relative rounded-2xl border dark:bg-[#141414]">
          {showVoiceChat ? (
            <VoiceChat onClose={() => setShowVoiceChat(false)} />
          ) : (
            <div className="flex flex-col p-2">
              <div className="mb-2 w-full">
                <AITextarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask AI to do anything..."
                  className="placeholder:text-muted-foreground h-[44px] w-full resize-none rounded-[5px] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="flex items-center justify-between">
                {/* <div className="flex items-center gap-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.md"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-7 items-center justify-center gap-0.5 overflow-hidden rounded-md bg-gradient-to-b from-black/5 to-black/10 dark:from-white/20 dark:to-white/10 px-1.5 outline outline-1 outline-offset-[-1px] outline-black/5 dark:outline-white/5 border border-border/50"
                    disabled={isLoading}
                  >
                    <Plus className="relative h-4 w-4 overflow-hidden text-black dark:text-white" />
                    <div className="flex items-center justify-center gap-2.5 px-0.5">
                      <div className="justify-start text-center text-sm leading-none text-black dark:text-white">
                        {isLoading ? 'Uploading...' : 'Add files'}
                      </div>
                    </div>
                  </button>
                </div> */}
                <div></div>
                <button
                  className="border-border/50 inline-flex h-7 items-center justify-center gap-1.5 overflow-hidden rounded-md border bg-white pl-1.5 pr-1 dark:bg-[#262626] cursor-pointer"
                  disabled={!value.trim() || isLoading}
                  onClick={handleSendMessage}
                >
                  <div className="flex items-center justify-center gap-2.5 pl-0.5">
                    <div className="justify-start text-center text-sm leading-none text-black dark:text-white">
                      Send{' '}
                    </div>
                  </div>
                  <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-black/10 px-1 dark:bg-white/10">
                    <Command className="h-3.5 w-3.5 text-black dark:text-[#929292]" />
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
