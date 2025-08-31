'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveConnection } from '@/hooks/use-connections';
import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, X, Check, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { stripHtml } from 'string-strip-html';
import { formatDistanceToNow } from 'date-fns';

interface EmailData {
  threadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  content: string;
  receivedOn: string;
  generatedReply: string;
  editedReply: string;
  isGenerating: boolean;
}

export default function FounderMode() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: activeConnection, isLoading: isLoadingConnection } = useActiveConnection();
  const userEmail = activeConnection?.email?.toLowerCase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchingThreadId, setFetchingThreadId] = useState<string | null>(null);
  
  // Use sessionStorage to persist archived IDs across refreshes
  const [archivedIds] = useState<Set<string>>(() => {
    const stored = sessionStorage.getItem('founderMode_archivedIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const trpc = useTRPC();

  // Fetch unread emails from INBOX only
  const { data: unreadData, isLoading, refetch } = useQuery({
    ...trpc.mail.listThreads.queryOptions({
      folder: 'inbox',
      q: 'is:unread in:inbox', 
      maxResults: 100,
    }),
    refetchInterval: 60000, // Refetch every minute
    enabled: !!userEmail, // Only fetch when we have the user's email
  });

  // Get thread IDs to process (excluding archived ones)
  const threadIds = useMemo(() => {
    if (!unreadData?.threads) return [];
    // Filter out any threads we've already archived
    const ids = unreadData.threads
      .map(t => t.id)
      .filter(id => !archivedIds.has(id));
    return ids;
  }, [unreadData, archivedIds]);

  // Process all threads at once
  const [processedThreadIds, setProcessedThreadIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    // Process all thread IDs that haven't been processed yet
    const unprocessedIds = threadIds.filter(id => 
      !processedThreadIds.has(id) && 
      !archivedIds.has(id) && 
      !emails.some(e => e.threadId === id)
    );
    
    if (unprocessedIds.length > 0 && !fetchingThreadId) {
      // Process the first unprocessed thread
      const nextId = unprocessedIds[0];
      setFetchingThreadId(nextId);
      setProcessedThreadIds(prev => new Set([...prev, nextId]));
    }
  }, [threadIds, processedThreadIds, archivedIds, fetchingThreadId, emails]);

  // Fetch current thread data
  const { data: currentThreadData, error: threadError } = useQuery(
    trpc.mail.get.queryOptions(
      { id: fetchingThreadId! },
      { 
        enabled: !!fetchingThreadId,
        staleTime: 60 * 1000,
        retry: 0, // Don't retry to speed up processing
      }
    )
  );
  
  // Handle fetch errors quickly
  useEffect(() => {
    if (threadError && fetchingThreadId) {
      // Skip this thread and move to the next
      setFetchingThreadId(null);
    }
  }, [threadError, fetchingThreadId]);

  // Mutations
  const generateReply = useMutation(trpc.ai.compose.mutationOptions());
  const sendEmail = useMutation(trpc.mail.send.mutationOptions());
  const markAsRead = useMutation(trpc.mail.markAsRead.mutationOptions());
  const bulkArchive = useMutation(trpc.mail.bulkArchive.mutationOptions());

  // Process fetched thread
  useEffect(() => {
    if (!currentThreadData || !fetchingThreadId) return;

    // Skip if archived
    if (archivedIds.has(fetchingThreadId)) {
      setFetchingThreadId(null);
      return;
    }

    // Get the latest non-draft message
    const messages = currentThreadData.messages || [];
    const nonDraftMessages = messages.filter(m => !m.isDraft);
    
    if (nonDraftMessages.length === 0) {
      setFetchingThreadId(null);
      return;
    }

    // Sort by date to get latest
    const latestMessage = nonDraftMessages.sort((a, b) => 
      new Date(b.receivedOn || 0).getTime() - new Date(a.receivedOn || 0).getTime()
    )[0];

    if (!latestMessage) {
      setFetchingThreadId(null);
      return;
    }

    // Skip if it's from the user (double check)
    const senderEmail = latestMessage.sender?.email?.toLowerCase();
    // @ts-expect-error - from field might exist in some email types
    const fromEmail = latestMessage.from?.emailAddress?.address?.toLowerCase();
    
    // Check both sender and from fields to be thorough
    if (senderEmail === userEmail || fromEmail === userEmail) {
      // Skip emails from self
      setFetchingThreadId(null);
      return;
    }
    
    // Also skip if no valid sender email
    if (!senderEmail && !fromEmail) {
      setFetchingThreadId(null);
      return;
    }

    // Use the valid sender email we found
    const validSenderEmail = senderEmail || fromEmail || '';
    
    const emailData: EmailData = {
      threadId: fetchingThreadId,
      subject: latestMessage.subject || 'No Subject',
      // @ts-expect-error - from field might exist in some email types
      sender: latestMessage.sender?.name || latestMessage.sender?.email || latestMessage.from?.emailAddress?.name || 'Unknown',
      senderEmail: validSenderEmail,
      // @ts-expect-error - snippet field might exist in some email types
      content: stripHtml(latestMessage.decodedBody || latestMessage.snippet || '').result.substring(0, 2000),
      receivedOn: latestMessage.receivedOn,
      generatedReply: '',
      editedReply: '',
      isGenerating: false,
    };

    setEmails(prev => {
      // Don't add if already exists
      if (prev.some(e => e.threadId === fetchingThreadId)) {
        return prev;
      }
      return [...prev, emailData];
    });
    // Immediately process next thread
    setFetchingThreadId(null);
  }, [currentThreadData, fetchingThreadId, userEmail, archivedIds]);

  const currentEmail = emails[currentIndex];

  // Generate AI reply for current email
  useEffect(() => {
    const generateCurrentReply = async () => {
      if (!currentEmail) return;
      if (currentEmail.generatedReply || currentEmail.isGenerating) return;

      setEmails(prev => 
        prev.map((e, i) => 
          i === currentIndex ? { ...e, isGenerating: true } : e
        )
      );

      try {
        const result = await generateReply.mutateAsync({
          prompt: 'Reply to this email professionally and concisely. Be helpful and friendly.',
          threadMessages: [{
            from: currentEmail.senderEmail,
            to: [userEmail || ''],
            subject: currentEmail.subject,
            body: currentEmail.content,
            cc: [],
          }],
          to: [currentEmail.senderEmail],
          emailSubject: currentEmail.subject,
          cc: [],
        });

        setEmails(prev => 
          prev.map((e, i) => 
            i === currentIndex 
              ? { ...e, generatedReply: result.newBody, editedReply: result.newBody, isGenerating: false }
              : e
          )
        );
      } catch {
        // Fallback reply if AI generation fails
        const fallbackReply = `Hi ${currentEmail.sender.split(' ')[0] || 'there'},\n\nThanks for your email. I'll review this and get back to you shortly.\n\nBest,\n${activeConnection?.name || userEmail?.split('@')[0]}`;
        
        setEmails(prev => 
          prev.map((e, i) => 
            i === currentIndex 
              ? { 
                  ...e, 
                  generatedReply: fallbackReply,
                  editedReply: fallbackReply,
                  isGenerating: false 
                }
              : e
          )
        );
      }
    };

    generateCurrentReply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, emails.length]);

  // Send reply and archive
  const sendReplyAndArchive = useCallback(async () => {
    if (!currentEmail || !currentEmail.editedReply || currentEmail.isGenerating || isProcessing) return;

    setIsProcessing(true);

    try {
      // Convert plain text with newlines to HTML format
      const formattedMessage = currentEmail.editedReply
        .split('\n')
        .map(line => line.trim() ? `<p>${line}</p>` : '<br/>')
        .join('');

      // Send the reply
      await sendEmail.mutateAsync({
        to: [{ email: currentEmail.senderEmail }],
        subject: currentEmail.subject.startsWith('Re:') 
          ? currentEmail.subject 
          : `Re: ${currentEmail.subject}`,
        message: formattedMessage,
        threadId: currentEmail.threadId,
      });

      // Use bulkArchive which marks as read AND removes from inbox
      await bulkArchive.mutateAsync({
        ids: [currentEmail.threadId],
      });
      
      // Also explicitly mark as read to be sure
      await markAsRead.mutateAsync({
        ids: [currentEmail.threadId],
      });

      // Add to archived set to prevent re-fetching
      archivedIds.add(currentEmail.threadId);
      sessionStorage.setItem('founderMode_archivedIds', JSON.stringify(Array.from(archivedIds)));
      
      // Also add to processed IDs to prevent re-processing
      setProcessedThreadIds(prev => new Set([...prev, currentEmail.threadId]));

      // Remove from list
      setEmails(prev => prev.filter(e => e.threadId !== currentEmail.threadId));
      
      // Reset index if needed
      if (emails.length <= 1) {
        setCurrentIndex(0);
      } else if (currentIndex >= emails.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['mail.listThreads'] });
      await queryClient.invalidateQueries({ queryKey: ['mail.get', currentEmail.threadId] });
      await queryClient.invalidateQueries({ queryKey: ['useThreads'] });
      
      // Force refetch to update the unread list
      refetch();
      
    } catch (error) {
      console.error('Failed to send/archive:', error);
      console.error('Failed to send email. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [currentEmail, sendEmail, markAsRead, bulkArchive, currentIndex, emails.length, isProcessing, queryClient, archivedIds, refetch]);

  // Archive without sending
  const archiveOnly = useCallback(async () => {
    if (!currentEmail || isProcessing) return;

    setIsProcessing(true);

    try {
      // Use bulkArchive which removes from inbox
      await bulkArchive.mutateAsync({
        ids: [currentEmail.threadId],
      });
      
      // Also explicitly mark as read
      await markAsRead.mutateAsync({
        ids: [currentEmail.threadId],
      });

      // Add to archived set to prevent re-fetching
      archivedIds.add(currentEmail.threadId);
      sessionStorage.setItem('founderMode_archivedIds', JSON.stringify(Array.from(archivedIds)));
      
      // Also add to processed IDs to prevent re-processing
      setProcessedThreadIds(prev => new Set([...prev, currentEmail.threadId]));

      // Remove from list
      setEmails(prev => prev.filter(e => e.threadId !== currentEmail.threadId));
      
      // Reset index if needed
      if (emails.length <= 1) {
        setCurrentIndex(0);
      } else if (currentIndex >= emails.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['mail.listThreads'] });
      await queryClient.invalidateQueries({ queryKey: ['mail.get', currentEmail.threadId] });
      await queryClient.invalidateQueries({ queryKey: ['useThreads'] });
      
      // Force refetch to update the unread list
      refetch();
      
    } catch (error) {
      console.error('Failed to archive:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [currentEmail, markAsRead, bulkArchive, currentIndex, emails.length, isProcessing, queryClient, archivedIds, refetch]);

  // Regenerate AI reply
  const regenerateReply = useCallback(async () => {
    if (!currentEmail || currentEmail.isGenerating) return;

    setEmails(prev => 
      prev.map((e, i) => 
        i === currentIndex ? { ...e, isGenerating: true } : e
      )
    );

    try {
      const result = await generateReply.mutateAsync({
        prompt: 'Write a different reply to this email. Keep it professional and helpful.',
        threadMessages: [{
          from: currentEmail.senderEmail,
          to: [userEmail || ''],
          subject: currentEmail.subject,
          body: currentEmail.content,
          cc: [],
        }],
        to: [currentEmail.senderEmail],
        emailSubject: currentEmail.subject,
        cc: [],
      });

      setEmails(prev => 
        prev.map((e, i) => 
          i === currentIndex 
            ? { ...e, generatedReply: result.newBody, editedReply: result.newBody, isGenerating: false }
            : e
        )
      );
    } catch (error) {
      console.error('Failed to regenerate:', error);
    }
  }, [currentEmail, currentIndex, generateReply, userEmail]);

  // Update edited reply
  const updateEditedReply = useCallback((value: string) => {
    setEmails(prev => 
      prev.map((e, i) => 
        i === currentIndex ? { ...e, editedReply: value } : e
      )
    );
  }, [currentIndex]);

  // Navigate between emails
  const goToNext = useCallback(() => {
    if (currentIndex < emails.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, emails.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in textarea/input
      const target = e.target as HTMLElement;
      const isTextarea = target.tagName === 'TEXTAREA';
      const isInput = target.tagName === 'INPUT';
      const isEditable = isTextarea || isInput;
      
      // Tab: Generate new AI Email (when not in editable fields)
      if (e.key === 'Tab' && !isEditable) {
        e.preventDefault();
        e.stopPropagation();
        regenerateReply();
        return false;
      }
      
      // Cmd+Enter: Send & Archive (works everywhere)
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sendReplyAndArchive();
        return false;
      }
      
      // Cmd+Delete: Archive (when not in editable fields)
      if ((e.key === 'Delete' || e.key === 'Backspace') && (e.metaKey || e.ctrlKey) && !isEditable) {
        e.preventDefault();
        archiveOnly();
        return false;
      }
      
      // Arrow navigation (when not in editable fields)
      if (e.key === 'ArrowRight' && !isEditable) {
        goToNext();
      } else if (e.key === 'ArrowLeft' && !isEditable) {
        goToPrevious();
      }
    };

    // Use capture phase to catch Tab before default behavior
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [goToNext, goToPrevious, regenerateReply, sendReplyAndArchive, archiveOnly]);

  // Check if connection is loading
  if (isLoadingConnection) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading connection...</p>
        </div>
      </div>
    );
  }

  // Check if user email is available
  if (!userEmail) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">No active email connection. Please connect your email account.</p>
          <Button onClick={() => navigate('/settings/connections')} variant="outline">
            Go to Connections
          </Button>
        </div>
      </div>
    );
  }

  // Loading state - show loading only if we're actually loading initial data
  if ((isLoading || fetchingThreadId) && emails.length === 0) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">
            {isLoading ? 'Loading unread emails...' : 'Processing emails...'}
          </p>
        </div>
      </div>
    );
  }



  // No emails state
  if (emails.length === 0 && !fetchingThreadId && !isLoading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Inbox Zero! 🎉</h1>
            <p className="text-lg text-muted-foreground">No unread emails in your inbox</p>
            <p className="text-sm text-muted-foreground mt-2">
              {archivedIds.size > 0 && `Processed ${archivedIds.size} emails this session`}
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={() => refetch()} variant="outline" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => navigate('/mail/inbox')} variant="outline" size="lg">
              Back to Inbox
            </Button>
            {archivedIds.size > 0 && (
              <Button 
                onClick={() => {
                  sessionStorage.removeItem('founderMode_archivedIds');
                  window.location.reload();
                }} 
                variant="outline" 
                size="sm"
              >
                Clear Archive Cache
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const timeAgo = currentEmail ? formatDistanceToNow(new Date(currentEmail.receivedOn), { addSuffix: true }) : '';

  return (
    <div className="w-full min-h-screen bg-background overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold mb-2">
            {currentIndex + 1}/{emails.length} Unread Emails
          </h1>
          <p className="text-sm text-muted-foreground">{timeAgo}</p>
        </div>

        {/* Email Content */}
        {currentEmail && (
          <div className="space-y-4">
            {/* Original Email */}
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{currentEmail.sender}</span>
                    <span className="text-muted-foreground text-sm">-</span>
                    <span className="text-muted-foreground text-sm">{currentEmail.subject}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{currentEmail.senderEmail}</p>
                </div>
              </div>
              
              <div className="pl-4 text-sm leading-normal whitespace-pre-wrap max-h-[350px] overflow-y-auto">
                {currentEmail.content}
              </div>
            </div>

            {/* AI Generated Reply */}
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">AI Draft Reply (editable):</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={regenerateReply}
                  disabled={currentEmail.isGenerating}
                  title="Generate new reply (Shift+Tab)"
                >
                  <RefreshCw className={`h-4 w-4 ${currentEmail.isGenerating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {currentEmail.isGenerating ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">Generating AI reply...</span>
                </div>
              ) : (
                <textarea
                  value={currentEmail.editedReply || ''}
                  onChange={(e) => updateEditedReply(e.target.value)}
                  className="w-full text-sm leading-normal resize-vertical bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-ring rounded p-2 min-h-[250px] h-[300px] max-h-[500px] overflow-y-auto"
                  placeholder="Type your reply here..."
                />
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
                  <div className="mt-6 space-y-3">
            <div className="text-center text-xs text-muted-foreground">
              Tab: Generate New AI Email • Cmd+Enter: Send & Archive • Cmd+Delete: Archive
            </div>
          
          <div className="flex items-center justify-center gap-3">
            <Button 
              onClick={archiveOnly}
              variant="outline"
              size="default"
              disabled={isProcessing}
            >
              Archive <X className="ml-2 h-4 w-4" />
            </Button>
            
            <Button 
              onClick={sendReplyAndArchive}
              size="default"
              disabled={!currentEmail?.editedReply || currentEmail?.isGenerating || isProcessing}
              className="min-w-[180px]"
            >
              Send & Archive <Check className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {emails.length > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                onClick={goToPrevious}
                variant="ghost"
                size="sm"
                disabled={currentIndex === 0}
              >
                ← Previous
              </Button>
              <Button
                onClick={goToNext}
                variant="ghost"
                size="sm"
                disabled={currentIndex >= emails.length - 1}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}