'use client';

import { ArrowUpIcon, Mic, CheckIcon, XIcon } from 'lucide-react';
import { useRef, useCallback } from 'react';
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
}

export function AIChat({ editor }: AIChatProps) {
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: connections } = useConnections();

  const activeAccount = connections?.find((connection) => connection.id === session?.connectionId);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
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
      if (textareaRef.current) {
        textareaRef.current.style.height = '60px';
      }
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
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
      <div className="w-full">
        <div className="relative">
         

          {/* Messages */}
          <div className="max-h-[500px] overflow-y-auto space-y-4">
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
          </div>

          {/* Input */}
          <div className="relative bg-background rounded-2xl mt-4 mx-1">
        
              <AITextarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message Zero..."
                className="min-h-[0px] w-full resize-none border bg-transparenttext-sm focus:outline-none focus:ring-0 focus:ring-offset-0"
               
              />
              <div className="absolute bottom-3 right-3">
                <Button 
                  variant="default" 
                  size="icon"
                  className="h-8 w-8 rounded-full" 
                  disabled={!value.trim() || isLoading}
                  onClick={handleSendMessage}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <ArrowUpIcon className="h-4 w-4" />
                  )}
                </Button>
            
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
