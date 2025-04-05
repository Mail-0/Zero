'use client';
import { generateHTML, generateJSON } from '@tiptap/core';
import { useConnections } from '@/hooks/use-connections';
import { useContacts } from '@/hooks/use-contacts';
import { createDraft, getDraft } from '@/actions/drafts';
import { getReauthUrl } from '@/actions/connections';
import { ArrowUpIcon, Paperclip, X, RefreshCw, UserCheck } from 'lucide-react';
import { SidebarToggle } from '../ui/sidebar-toggle';
import Paragraph from '@tiptap/extension-paragraph';
import Document from '@tiptap/extension-document';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { AIAssistant } from './ai-assistant';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import { type JSONContent } from 'novel';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';
import * as React from 'react';
import Editor from './editor';
import './prosemirror.css';

const MAX_VISIBLE_ATTACHMENTS = 12;

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const createEmptyDocContent = (): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
});

export function CreateEmail({
  initialTo = '',
  initialSubject = '',
  initialBody = '',
}: {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}) {
  const [toInput, setToInput] = React.useState('');
  const [toEmails, setToEmails] = React.useState<string[]>(initialTo ? [initialTo] : []);
  const [subjectInput, setSubjectInput] = React.useState(initialSubject);
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [resetEditorKey, setResetEditorKey] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [reauthUrl, setReauthUrl] = React.useState('');
  const [messageContent, setMessageContent] = React.useState(initialBody);
  const [draftId, setDraftId] = useQueryState('draftId');
  
  const [defaultValue, setDefaultValue] = React.useState<JSONContent | null>(() => {
    if (initialBody) {
      try {
        return generateJSON(initialBody, [Document, Paragraph, Text, Bold]);
      } catch (error) {
        console.error('Error parsing initial body:', error);
        return createEmptyDocContent();
      }
    }
    return null;
  });

  const { data: session } = useSession();
  const { data: connections } = useConnections();
  const { contacts, needsContactsPermission, refreshContacts } = useContacts();

  const activeAccount = React.useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.activeConnection?.id);
  }, [session, connections]);

  const userName =
    activeAccount?.name || session?.activeConnection?.name || session?.user?.name || '';
  const userEmail =
    activeAccount?.email || session?.activeConnection?.email || session?.user?.email || '';

  React.useEffect(() => {
    if (!draftId && !defaultValue) {
      setDefaultValue(createEmptyDocContent());
    }
  }, [draftId, defaultValue]);

  // Check if we need to request contacts permission and get the reauth URL
  React.useEffect(() => {
    if (needsContactsPermission && !reauthUrl) {
      const fetchReauthUrl = async () => {
        try {
          const { url } = await getReauthUrl();
          setReauthUrl(url);
        } catch (error) {
          console.error('Error getting reauth URL:', error);
        }
      };
      fetchReauthUrl();
    }
  }, [needsContactsPermission, reauthUrl]);

  React.useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) {
        setDefaultValue(createEmptyDocContent());
        return;
      }

      try {
        const draft = await getDraft(draftId);

        if (!draft) {
          toast.error('Draft not found');
          return;
        }

        setDraftId(draft.id);

        if (draft.to?.length) {
          setToEmails(draft.to);
        }
        if (draft.subject) {
          setSubjectInput(draft.subject);
        }

        if (draft.content) {
          try {
            const json = generateJSON(draft.content, [Document, Paragraph, Text, Bold]);
            setDefaultValue(json);
            setMessageContent(draft.content);
          } catch (error) {
            console.error('Error parsing draft content:', error);
          }
        }

        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Error loading draft:', error);
        toast.error('Failed to load draft');
      }
    };

    loadDraft();
  }, [draftId]);

  const t = useTranslations();

  const handleAddEmail = (email: string) => {
    const trimmedEmail = email.trim().replace(/,$/, '');

    if (!trimmedEmail) return;

    if (toEmails.includes(trimmedEmail)) {
      setToInput('');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast.error(`Invalid email format: ${trimmedEmail}`);
      return;
    }

    setToEmails([...toEmails, trimmedEmail]);
    setToInput('');
    setHasUnsavedChanges(true);
  };

  const saveDraft = React.useCallback(async () => {
    if (!hasUnsavedChanges) return;
    if (!toEmails.length && !subjectInput && !messageContent) return;

    try {
      setIsLoading(true);
      const draftData = {
        to: toEmails.join(', '),
        subject: subjectInput,
        message: messageContent || '',
        attachments: attachments,
        id: draftId,
      };

      const response = await createDraft(draftData);

      if (response?.id && response.id !== draftId) {
        setDraftId(response.id);
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsLoading(false);
    }
  }, [toEmails, subjectInput, messageContent, attachments, draftId, hasUnsavedChanges]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      saveDraft();
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, saveDraft]);

  React.useEffect(() => {
    setHasUnsavedChanges(true);
  }, [messageContent]);

  const handleSendEmail = async () => {
    if (!toEmails.length) {
      toast.error('Please enter at least one recipient email address');
      return;
    }

    if (!messageContent.trim() || messageContent === JSON.stringify(defaultValue)) {
      toast.error('Please enter a message');
      return;
    }

    if (!subjectInput.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    try {
      setIsLoading(true);
      await sendEmail({
        to: toEmails.join(','),
        subject: subjectInput,
        message: messageContent,
        attachments: attachments,
      });

      setIsLoading(false);
      toast.success(t('pages.createEmail.emailSentSuccessfully'));

      setToInput('');
      setToEmails([]);
      setSubjectInput('');
      setAttachments([]);
      setMessageContent('');

      setDefaultValue(createEmptyDocContent());
      setResetEditorKey((prev) => prev + 1);

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error sending email:', error);
      setIsLoading(false);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
      setHasUnsavedChanges(true);
    }
  };

  // Add refs for to input and suggestion dropdown
  const toInputRef = React.useRef<HTMLInputElement>(null);
  const suggestionsRef = React.useRef<HTMLDivElement>(null);
  const [emailSuggestions, setEmailSuggestions] = React.useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = React.useState<number>(-1);
  const [showSuggestions, setShowSuggestions] = React.useState<boolean>(false);

  // Combined suggestion source type for email autofill
  type ContactSuggestion = {
    email: string;
    name?: string;
    source: 'connection' | 'google'; // Where this suggestion came from
    picture?: string; // Optional profile image
  };

  // Filter connections and contacts to get email suggestions
  const getEmailSuggestions = React.useCallback((input: string): string[] => {
    if (!input) return [];
    
    // Removed console.log for production
    
    const inputLower = input.toLowerCase();
    const allSuggestions: ContactSuggestion[] = [];
    
    // When input is very short (1-2 chars), show more suggestions
    const isShortInput = inputLower.length <= 2;
    
    // Add suggestions from mail connections
    if (connections?.length) {
      connections.forEach(conn => {
        if (!toEmails.includes(conn.email) && 
            (isShortInput || 
             conn.email.toLowerCase().includes(inputLower) || 
             conn.name?.toLowerCase()?.includes(inputLower))) {
          allSuggestions.push({
            email: conn.email,
            name: conn.name,
            source: 'connection',
            picture: conn.picture
          });
        }
      });
    }
    
    // Always add user's own email as a suggestion
    if (userEmail && !toEmails.includes(userEmail)) {
      if (isShortInput || userEmail.toLowerCase().includes(inputLower)) {
        allSuggestions.push({
          email: userEmail,
          name: userName || 'Me (Your Email)',
          source: 'connection',
          picture: undefined
        });
      }
    }
    
    // Add suggestions from Google contacts
    if (contacts?.length) {
      // Log contacts for debugging
      console.log(`Found ${contacts.length} contacts for suggestions:`, 
        contacts.slice(0, 5).map(c => ({ email: c.email, name: c.name })));
        
      contacts.forEach(contact => {
        if (!toEmails.includes(contact.email) && 
            (isShortInput || 
             contact.email.toLowerCase().includes(inputLower) || 
             contact.name?.toLowerCase()?.includes(inputLower))) {
          allSuggestions.push({
            email: contact.email,
            name: contact.name,
            source: 'google',
            picture: contact.profilePhotoUrl
          });
        }
      });
      
      // If we still don't have suggestions but have contacts, show first 5 contacts
      if (allSuggestions.length === 0 && contacts.length > 0 && inputLower.length === 0) {
        console.log("No matching suggestions found, showing first contacts");
        contacts.slice(0, 5).forEach(contact => {
          if (!toEmails.includes(contact.email)) {
            allSuggestions.push({
              email: contact.email,
              name: contact.name,
              source: 'google',
              picture: contact.profilePhotoUrl
            });
          }
        });
      }
    }
    
    // Removed console.log for production
    
    // Sort by relevance - exact matches first, then alphabetically
    allSuggestions.sort((a, b) => {
      // Exact match on email
      const aExactEmail = a.email.toLowerCase() === inputLower;
      const bExactEmail = b.email.toLowerCase() === inputLower;
      if (aExactEmail && !bExactEmail) return -1;
      if (!aExactEmail && bExactEmail) return 1;
      
      // Exact match on name
      const aExactName = a.name?.toLowerCase() === inputLower;
      const bExactName = b.name?.toLowerCase() === inputLower;
      if (aExactName && !bExactName) return -1;
      if (!aExactName && bExactName) return 1;
      
      // Sort alphabetically by email if no exact matches
      return a.email.localeCompare(b.email);
    });
    
    // Remove duplicates while preserving the contact details
    const uniqueEmails = new Map<string, ContactSuggestion>();
    
    // Add each contact to the map, prioritizing those with profile pictures
    allSuggestions.forEach(suggestion => {
      const existing = uniqueEmails.get(suggestion.email);
      
      // Add if we don't have this email yet, or if this one has a picture but the existing one doesn't
      if (!existing || (!existing.picture && suggestion.picture)) {
        uniqueEmails.set(suggestion.email, suggestion);
      }
    });
    
    // Convert back to an array and return just the emails
    return Array.from(uniqueEmails.values())
      .map(suggestion => suggestion.email)
      .slice(0, 5); // Limit to 5 suggestions
  }, [connections, contacts, toEmails, userEmail, userName]);
  
  // Get contact details by email from either connections or Google contacts
  const getContactByEmail = React.useCallback((email: string): { name?: string, picture?: string } | undefined => {
    // First check connections
    const conn = connections?.find(conn => conn.email === email);
    if (conn) {
      return { name: conn.name, picture: conn.picture };
    }
    
    // Then check Google contacts
    const contact = contacts?.find(contact => contact.email === email);
    if (contact) {
      return { name: contact.name, picture: contact.profilePhotoUrl };
    }
    
    return undefined;
  }, [connections, contacts]);

  // Helper function to update suggestions
  const updateSuggestions = React.useCallback((inputValue: string) => {
    // Get suggestions even for empty input to show default suggestions
    const suggestions = getEmailSuggestions(inputValue);
    setEmailSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  }, [getEmailSuggestions]);
  
  // Update suggestions when input changes
  React.useEffect(() => {
    updateSuggestions(toInput);
  }, [toInput, updateSuggestions]);

  // Handle selecting a suggestion via click
  const handleSuggestionClick = (email: string) => {
    handleAddEmail(email);
    setShowSuggestions(false);
  };

  // Handle keyboard navigation for suggestions
  const handleToInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && emailSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < emailSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        handleAddEmail(emailSuggestions[selectedSuggestionIndex]);
        setShowSuggestions(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
      }
    }
    
    // Handle regular input behavior
    if ((e.key === ',' || e.key === 'Enter' || e.key === ' ') && toInput.trim() && selectedSuggestionIndex === -1) {
      e.preventDefault();
      handleAddEmail(toInput);
    } else if (e.key === 'Backspace' && !toInput && toEmails.length > 0) {
      setToEmails((emails) => emails.slice(0, -1));
      setHasUnsavedChanges(true);
    }
  };

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) && 
          toInputRef.current && !toInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if "/" is pressed and no input/textarea is focused
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        toInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  React.useEffect(() => {
    if (initialTo) {
      const emails = initialTo.split(',').map(email => email.trim());
      const validEmails = emails.filter(email => isValidEmail(email));
      if (validEmails.length > 0) {
        setToEmails(validEmails);
      } else {
        setToInput(initialTo);
      }
    }
    
    if (initialSubject) {
      setSubjectInput(initialSubject);
    }
    
    if (initialBody && !defaultValue) {
      setDefaultValue({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: initialBody
              }
            ]
          }
        ]
      });
      setMessageContent(initialBody);
    }
  }, [initialTo, initialSubject, initialBody, defaultValue]);

  return (
    <div
      className="bg-offsetLight dark:bg-offsetDark relative flex h-full flex-col overflow-hidden shadow-inner md:rounded-2xl md:border md:shadow-sm"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="bg-background/80 border-primary/30 absolute inset-0 z-50 m-4 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm">
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <Paperclip className="text-muted-foreground h-12 w-12" />
            <p className="text-lg font-medium">{t('pages.createEmail.dropFilesToAttach')}</p>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-1.5 p-2 transition-colors">
        <SidebarToggle className="h-fit px-2" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pt-4 md:px-2">
            <div className="space-y-3 md:px-1">
              <div className="flex items-center">
                <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                  {t('common.mailDisplay.to')}
                </div>
                <div className="group relative left-[2px] flex w-full flex-wrap items-center rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
                  {toEmails.map((email, index) => (
                    <div
                      key={index}
                      className="bg-accent flex items-center gap-1 rounded-md border px-2 text-sm font-medium"
                    >
                      <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {email}
                      </span>
                      <button
                        type="button"
                        disabled={isLoading}
                        className="text-muted-foreground hover:text-foreground ml-1 rounded-full"
                        onClick={() => {
                          setToEmails((emails) => emails.filter((_, i) => i !== index));
                          setHasUnsavedChanges(true);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="relative flex-1">
                    {contacts?.length === 0 && (
                      <div className="absolute -top-9 right-0 z-20 flex items-center gap-2 rounded bg-amber-100 dark:bg-amber-900 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-100 shadow-sm">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>{needsContactsPermission ? 'Reconnect to enable contacts' : 'No contacts found'}</span>
                        <a 
                          href={'/api/v1/mail/auth/google/init?scope=contacts'}
                          className="bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 rounded px-2 py-0.5 font-medium flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {needsContactsPermission ? 'Connect' : 'Refresh'}
                        </a>
                      </div>
                    )}
                    <input
                      ref={toInputRef}
                      disabled={isLoading}
                      type="email"
                      className="text-md relative left-[3px] min-w-[120px] w-full bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
                      placeholder={toEmails.length ? '' : t('pages.createEmail.example')}
                      value={toInput}
                      onChange={(e) => {
                        setToInput(e.target.value);
                        updateSuggestions(e.target.value);
                      }}
                      onKeyDown={handleToInputKeyDown}
                      onFocus={() => {
                        updateSuggestions(toInput);
                      }}
                      onBlur={(e) => {
                        // Delay hiding suggestions to allow clicks on the suggestions
                        setTimeout(() => {
                          if (toInput.trim() && !showSuggestions) {
                            handleAddEmail(toInput);
                          }
                        }, 200);
                      }}
                    />
                    {showSuggestions && emailSuggestions.length > 0 && (
                      <div 
                        ref={suggestionsRef}
                        className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md bg-background shadow-lg border border-border"
                      >
                        <ul className="py-1">
                          {emailSuggestions.map((email, index) => {
                            const contactInfo = getContactByEmail(email);
                            return (
                              <li
                                key={email}
                                className={`px-4 py-2 text-sm cursor-pointer ${
                                  index === selectedSuggestionIndex
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent hover:text-accent-foreground'
                                }`}
                                onClick={() => handleSuggestionClick(email)}
                                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                              >
                                <div className="flex items-center gap-2">
                                  {contactInfo?.picture && (
                                    <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full">
                                      <img 
                                        src={contactInfo.picture} 
                                        alt={contactInfo.name || email}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 overflow-hidden">
                                    {contactInfo?.name ? (
                                      <>
                                        <div className="font-medium truncate">{contactInfo.name}</div>
                                        <div className="text-muted-foreground text-xs truncate">{email}</div>
                                      </>
                                    ) : (
                                      <div className="truncate">{email}</div>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                  {t('common.searchBar.subject')}
                </div>
                <input
                  disabled={isLoading}
                  type="text"
                  className="text-md relative left-[7.5px] w-full bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
                  placeholder={t('common.searchBar.subject')}
                  value={subjectInput}
                  onChange={(e) => {
                    setSubjectInput(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>

              <div className="flex">
                <div className="text-muted-foreground text-md relative -top-[1px] w-20 flex-shrink-0 pr-3 pt-2 text-right font-[600] opacity-50 md:w-24">
                  {t('pages.createEmail.body')}
                </div>
                <div className="w-full">
                  {defaultValue && (
                    <Editor
                      initialValue={defaultValue}
                      onChange={(newContent) => {
                        setMessageContent(newContent);
                        if (newContent.trim() !== '') {
                          setHasUnsavedChanges(true);
                        }
                      }}
                      key={resetEditorKey}
                      placeholder={t('pages.createEmail.writeYourMessageHere')}
                      onAttachmentsChange={setAttachments}
                      onCommandEnter={handleSendEmail}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-offsetLight dark:bg-offsetDark sticky bottom-0 left-0 right-0 flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="mr-1 pb-2 pt-2">
              <AIAssistant
                currentContent={messageContent}
                subject={subjectInput}
                recipients={toEmails}
                userContext={{ name: userName, email: userEmail }}
                onContentGenerated={(jsonContent, newSubject) => {
                  console.log('CreateEmail: Received AI-generated content', {
                    jsonContentType: jsonContent.type,
                    hasContent: Boolean(jsonContent.content),
                    contentLength: jsonContent.content?.length || 0,
                    newSubject: newSubject,
                  });

                  try {
                    // Update the editor content with the AI-generated content
                    setDefaultValue(jsonContent);

                    // Extract and set the text content for validation purposes
                    // This ensures the submit button is enabled immediately
                    if (jsonContent.content && jsonContent.content.length > 0) {
                      // Extract text content from JSON structure recursively
                      const extractTextContent = (node: any): string => {
                        if (!node) return '';

                        if (node.text) return node.text;

                        if (node.content && Array.isArray(node.content)) {
                          return node.content.map(extractTextContent).join(' ');
                        }

                        return '';
                      };

                      // Process all content nodes
                      const textContent = jsonContent.content
                        .map(extractTextContent)
                        .join('\n')
                        .trim();
                      setMessageContent(textContent);
                    }

                    // Update the subject if provided
                    if (newSubject && (!subjectInput || subjectInput.trim() === '')) {
                      console.log('CreateEmail: Setting new subject from AI', newSubject);
                      setSubjectInput(newSubject);
                    }

                    // Mark as having unsaved changes
                    setHasUnsavedChanges(true);

                    // Reset the editor to ensure it picks up the new content
                    setResetEditorKey((prev) => prev + 1);

                    console.log('CreateEmail: Successfully applied AI content');
                  } catch (error) {
                    console.error('CreateEmail: Error applying AI content', error);
                    toast.error('Error applying AI content to your email. Please try again.');
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="default"
              className="h-9 w-9 overflow-hidden rounded-full"
              onClick={handleSendEmail}
              disabled={
                isLoading || !toEmails.length || !messageContent.trim() || !subjectInput.trim()
              }
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
