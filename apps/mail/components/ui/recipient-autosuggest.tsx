'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useController, type Control } from 'react-hook-form';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback } from './avatar';

interface RecipientSuggestion {
  email: string;
  name?: string | null;
  displayText: string;
}

const isValidRecipientSuggestion = (item: unknown): item is RecipientSuggestion => {
  if (typeof item !== 'object' || item === null) return false;
  
  const obj = item as Record<string, unknown>;
  
  if (!('email' in obj) || !('displayText' in obj)) return false;
  
  const email = obj.email;
  const displayText = obj.displayText;
  const name = obj.name;
  
  if (typeof email !== 'string' || typeof displayText !== 'string') {
    return false;
  }
  
  if (name !== undefined && name !== null && typeof name !== 'string') {
    return false;
  }
  
  return true;
};

const validateSuggestions = (data: unknown): RecipientSuggestion[] => {
  if (!Array.isArray(data)) {
    if (data !== undefined && data !== null) {
      console.warn('Expected array for recipient suggestions, got:', typeof data);
    }
    return [];
  }
  
  const valid = data.filter(isValidRecipientSuggestion);
  const invalid = data.length - valid.length;
  
  if (invalid > 0) {
    console.warn(`Filtered out ${invalid} invalid recipient suggestions`);
  }
  
  return valid;
};

interface RecipientAutosuggestProps {
  control: Control<any>;
  name: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RecipientAutosuggest({
  control,
  name,
  placeholder = 'Enter email',
  className,
  disabled = false,
}: RecipientAutosuggestProps) {

  const {
    field: { value: recipients = [], onChange: onRecipientsChange },
  } = useController({
    control,
    name,
    defaultValue: [],
  });

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  
  const inputDomRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSetQuery = useDebounce((query: string) => {
    setDebouncedQuery(query);
  }, 300);

  const [debouncedQuery, setDebouncedQuery] = useState('');

  const trpc = useTRPC();
  const { data: allSuggestions = [], isLoading } = useQuery({
    ...trpc.mail.suggestRecipients.queryOptions({
      query: debouncedQuery,
      limit: 10,
    }),
    enabled: debouncedQuery.trim().length > 0 && !isComposing,
  });

  const filteredSuggestions = useMemo(() => {
    const validatedSuggestions = validateSuggestions(allSuggestions);
    return validatedSuggestions.filter((suggestion) => 
      !recipients.includes(suggestion.email)
    );
  }, [allSuggestions, recipients]);

  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  const addRecipient = useCallback((email: string) => {
    if (!recipients.includes(email) && isValidEmail(email)) {
      onRecipientsChange([...recipients, email]);
      setInputValue('');
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }, [recipients, onRecipientsChange, isValidEmail]);

  const removeRecipient = useCallback((index: number) => {
    const newRecipients = recipients.filter((_: string, i: number) => i !== index);
    onRecipientsChange(newRecipients);
  }, [recipients, onRecipientsChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSelectedIndex(-1);
    debouncedSetQuery(value);
    setIsOpen(value.trim().length > 0);
  }, [debouncedSetQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          addRecipient(filteredSuggestions[selectedIndex].email);
        } else if (inputValue.trim() && isValidEmail(inputValue.trim())) {
          addRecipient(inputValue.trim());
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      case 'Backspace':
        if (!inputValue && recipients.length > 0) {
          removeRecipient(recipients.length - 1);
        }
        break;
      case 'Tab':
        if (inputValue.trim() && isValidEmail(inputValue.trim())) {
          e.preventDefault();
          addRecipient(inputValue.trim());
        }
        break;
    }
  }, [inputValue, selectedIndex, filteredSuggestions, recipients, isComposing, addRecipient, removeRecipient, isValidEmail]);

  const handleSuggestionClick = useCallback((suggestion: RecipientSuggestion) => {
    addRecipient(suggestion.email);
  }, [addRecipient]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const emails = pastedText
      .split(/[,;\s]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && isValidEmail(email))
      .filter(email => !recipients.includes(email));
    
    if (emails.length > 0) {
      onRecipientsChange([...recipients, ...emails]);
    }
  }, [recipients, onRecipientsChange, isValidEmail]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      inputDomRef.current &&
      !inputDomRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }, []);

  const handleInputFocus = useCallback(() => {
    document.addEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    }, 150);
  }, [handleClickOutside]);

  return (
    <div className={cn('relative w-full', className)}>
      <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
        {recipients.map((email: string, index: number) => (
          <div
            key={`recipient-${email}-${index}`}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5"
          >
            <span className="flex gap-1 py-0.5 text-sm text-black dark:text-white">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-offsetLight text-muted-foreground rounded-full text-xs font-bold dark:bg-[#373737] dark:text-[#9B9B9B]">
                  {email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {email}
            </span>
            <button
              type="button"
              onClick={() => removeRecipient(index)}
              className="text-white/50 hover:text-white/90"
              disabled={disabled}
            >
              <X className="mt-0.5 h-3.5 w-3.5 fill-black dark:fill-[#9A9A9A]" />
            </button>
          </div>
        ))}
        <input
          ref={inputDomRef}
          type="email"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={recipients.length === 0 ? placeholder : ''}
          className="h-6 flex-1 bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white"
          disabled={disabled}
        />
      </div>

      {isOpen && (filteredSuggestions.length > 0 || isLoading) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          id="recipient-suggestions"
          role="listbox"
        >
          {isLoading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Loading suggestions...
            </div>
          )}
          {!isLoading && filteredSuggestions.length === 0 && debouncedQuery.trim().length > 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No suggestions</div>
          )}
          {filteredSuggestions.map((suggestion: RecipientSuggestion, index: number) => (
            <button
              key={suggestion.email}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-sm transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs font-bold">
                  {suggestion.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {suggestion.name || suggestion.email}
                </div>
                {suggestion.name && (
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.email}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 