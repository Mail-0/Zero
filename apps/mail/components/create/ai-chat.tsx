'use client';

import { ArrowUpIcon, Mic, CheckIcon, XIcon } from 'lucide-react';
import { useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AITextarea } from './ai-textarea';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from '@/lib/auth-client';
import { useConnections } from '@/hooks/use-connections';
import VoiceChat from './voice';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'email';
  emailContent?: {
    subject?: string;
    content: string;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
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

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Set a minimum height
    const minHeight = 24; // 1.5rem
    const maxHeight = 120; // Maximum height before scrolling

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Get the scroll height and constrain it
    const scrollHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${scrollHeight}px`;
  }, []);

  // Initialize height when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
  }, []);

  const handleSendMessage = async () => {
    if (!value.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: value.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setValue('');
    setIsLoading(true);

    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: {
            path: pathname,
            isEmailRequest: value.toLowerCase().includes('email') || pathname === '/create-email'
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Create suggestion for any AI response
      const suggestion = data.emailContent ? {
        type: 'email' as const,
        content: data.emailContent,
        subject: data.subject
      } : {
        type: 'text' as const,
        content: data.content
      };

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        type: 'email',
        emailContent: data.emailContent
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      toast.error("Failed to generate response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptSuggestion = (emailContent: { subject?: string; content: string }) => {
    if (!editor) {
      toast.error("Editor not found");
      return;
    }

    try {
      // Format the content to preserve line breaks
      const formattedContent = emailContent.content
        .split('\n')
        .map(line => `<p>${line}</p>`)
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

      toast.success("Email content applied successfully");
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast.error("Failed to apply email content");
    }
  };

  const handleRejectSuggestion = (messageId: string) => {
    toast.info("Email suggestion rejected");
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

  return (
    <div className="flex h-full flex-col">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
        <div className="min-h-full space-y-4 p-4">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg p-4",
                message.role === 'user' 
                  ? "bg-background border border-border" 
                  : "bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                {message.role === 'user' ? (
                  <>
                    <Avatar className="size-6 rounded-lg">
                      <AvatarImage
                        className="rounded-lg"
                        src={(activeAccount?.picture ?? undefined) || (session?.user.image ?? undefined)}
                        alt={activeAccount?.name || session?.user.name || 'User'}
                      />
                      <AvatarFallback className="text-xs rounded-lg">
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
                      <AvatarFallback className="text-xs rounded-lg">Zero</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">Zero</span>
                  </>
                )}
                <span className="text-muted-foreground text-sm">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
              
              <div className="prose dark:prose-invert max-w-none">
                {message.content}
              </div>

              {message.type === 'email' && message.emailContent && (
                <div className="mt-4 rounded border bg-background p-4 font-mono text-sm">
                  {message.emailContent.subject && (
                    <div className="mb-2 text-blue-500">
                      Subject: {message.emailContent.subject}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {message.emailContent.content}
                  </div>
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
                      className="h-8 border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
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
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className="flex-shrink-0 bg-white dark:bg-black px-4 py-2">
        <div className="relative bg-offsetLight dark:bg-offsetDark rounded">
        <VoiceChat />
          
        </div>
      </div>
    </div>
  );
}
