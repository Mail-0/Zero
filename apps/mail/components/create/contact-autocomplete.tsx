import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useContactSuggestions, type Contact } from '@/hooks/use-contacts';
import { X, Mail } from 'lucide-react';
import { useTranslations } from 'use-intl';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ContactAutocompleteProps {
  value: string[];
  onChange: (value: string[]) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  type?: 'to' | 'cc' | 'bcc';
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

export const ContactAutocomplete = forwardRef<HTMLInputElement, ContactAutocompleteProps>(
  ({ value = [], onChange, onFocus, onBlur, placeholder, className, autoFocus, disabled, type = 'to' }, ref) => {
    const t = useTranslations();
    const [inputValue, setInputValue] = useState('');
    const [open, setOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    
    const { suggestions, isLoading } = useContactSuggestions(inputValue, true); // Always fetch when there's input

    // Handle ref forwarding
    useEffect(() => {
      if (ref && 'current' in ref && inputRef.current) {
        ref.current = inputRef.current;
      }
    }, [ref]);

    // Auto focus
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [autoFocus]);

    const handleAddEmail = (email: string) => {
      const trimmedEmail = email.trim();
      if (trimmedEmail && !value.includes(trimmedEmail)) {
        if (isValidEmail(trimmedEmail)) {
          onChange([...value, trimmedEmail]);
          toast.success('Contact added');
        } else {
          toast.error('Please enter a valid email address');
        }
      } else if (value.includes(trimmedEmail)) {
        toast.error('This email is already in the list');
      }
      setInputValue('');
      setOpen(false);
      setFocusedIndex(-1);
      inputRef.current?.focus();
    };

    const handleRemoveEmail = (emailToRemove: string) => {
      onChange(value.filter(email => email !== emailToRemove));
      inputRef.current?.focus();
    };

    const updateDropdownPosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      // Open dropdown immediately when typing starts
      if (newValue.length > 0) {
        updateDropdownPosition();
        setOpen(true);
      } else {
        setOpen(false);
      }
      setFocusedIndex(-1);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
        e.preventDefault();
        if (focusedIndex >= 0 && suggestions[focusedIndex]) {
          handleAddEmail(suggestions[focusedIndex].email);
        } else {
          handleAddEmail(e.currentTarget.value.trim());
        }
      } else if ((e.key === ' ' || e.key === 'Tab') && e.currentTarget.value.trim()) {
        e.preventDefault();
        if (focusedIndex >= 0 && suggestions[focusedIndex]) {
          handleAddEmail(suggestions[focusedIndex].email);
        } else {
          handleAddEmail(e.currentTarget.value.trim());
        }
      } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
        e.preventDefault();
        handleRemoveEmail(value[value.length - 1]);
              } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open && inputValue.length > 0) {
            updateDropdownPosition();
            setOpen(true);
          }
          setFocusedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Escape') {
        setOpen(false);
        setFocusedIndex(-1);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      const emails = pastedText
        .split(/[,;\s]+/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const validEmails: string[] = [];
      const invalidEmails: string[] = [];

      emails.forEach((email) => {
        if (isValidEmail(email)) {
          const emailLower = email.toLowerCase();
          if (!value.some((e) => e.toLowerCase() === emailLower)) {
            validEmails.push(email);
          }
        } else {
          invalidEmails.push(email);
        }
      });

      if (validEmails.length > 0) {
        onChange([...value, ...validEmails]);
        if (validEmails.length === 1) {
          toast.success('Email address added');
        } else {
          toast.success(`${validEmails.length} email addresses added`);
        }
      }

      if (invalidEmails.length > 0) {
        toast.error(
          `Invalid email ${invalidEmails.length === 1 ? 'address' : 'addresses'}: ${invalidEmails.join(', ')}`,
        );
      }
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Don't process blur if we're about to click on the dropdown
      const relatedTarget = e.relatedTarget as Element;
      const dropdownElement = document.querySelector('[data-contact-dropdown="true"]');
      
      if (dropdownElement?.contains(relatedTarget)) {
        return;
      }
      
      // Delay to allow clicking on suggestions
      setTimeout(() => {
        // Check if dropdown is still open and if we're clicking inside it
        const activeElement = document.activeElement;
        const currentDropdown = document.querySelector('[data-contact-dropdown="true"]');
        
        if (currentDropdown?.contains(activeElement)) {
          return;
        }
        
        // Only add email if user types and blurs without pressing enter, and it looks like an email
        if (e.currentTarget.value.trim() && e.currentTarget.value.includes('@')) {
          handleAddEmail(e.currentTarget.value.trim());
        } else {
          // Just clear the input if it's not a valid email
          setInputValue('');
        }
        setOpen(false);
        onBlur?.(e);
      }, 150);
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(e);
      // Open dropdown if there's already input
      if (inputValue.length > 0) {
        updateDropdownPosition();
        setOpen(true);
      }
    };

    // Update dropdown position on scroll/resize
    useEffect(() => {
      if (open) {
        const handleUpdate = () => updateDropdownPosition();
        window.addEventListener('scroll', handleUpdate, true);
        window.addEventListener('resize', handleUpdate);
        return () => {
          window.removeEventListener('scroll', handleUpdate, true);
          window.removeEventListener('resize', handleUpdate);
        };
      }
    }, [open]);

    // Handle outside clicks to close dropdown
    useEffect(() => {
      if (!open) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        
        // Don't close if clicking on the input or wrapper
        if (wrapperRef.current?.contains(target)) {
          return;
        }
        
        // Don't close if clicking on the dropdown itself
        const dropdownElement = document.querySelector('[data-contact-dropdown="true"]');
        if (dropdownElement?.contains(target)) {
          return;
        }
        
        setOpen(false);
        setFocusedIndex(-1);
      };

      // Use capture phase to ensure we catch the event before other handlers
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }, [open]);

    const getInitials = (name: string | null, email: string) => {
      if (name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      }
      return email.split('@')[0].slice(0, 2).toUpperCase();
    };

    const shouldShowDropdown = open && inputValue.length > 0 && (suggestions.length > 0 || isLoading);

    return (
      <div 
        ref={wrapperRef}
        className={cn(
          "flex flex-wrap items-center gap-2",
          className
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((email) => (
          <div
            key={email}
            className="flex items-center gap-1 rounded-full border px-1 py-0.5 pr-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span className="flex gap-1 py-0.5 text-sm text-black dark:text-white">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-offsetLight text-muted-foreground rounded-full text-xs font-bold dark:bg-[#373737] dark:text-[#9B9B9B]">
                  {email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {email}
            </span>
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveEmail(email);
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onPaste={handlePaste}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={value.length === 0 ? placeholder : ''}
            className="h-6 w-full bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white"
            disabled={disabled}
          />
        </div>
        
        {/* Gmail-style dropdown using portal */}
        {shouldShowDropdown && typeof document !== 'undefined' && createPortal(
          <div 
            data-contact-dropdown="true"
            className="fixed z-[99999] max-h-[300px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left,
              minWidth: Math.max(dropdownPosition.width, 300),
              maxWidth: 400,
              pointerEvents: 'auto',
            }}
            onMouseDown={(e) => {
              // Prevent the event from bubbling up and triggering outside click
              e.stopPropagation();
            }}
          >
            <div className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Searching contacts...
                  </span>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      {inputValue.includes('@') ? (
                        <>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {inputValue}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Press Enter to add this email
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          No contacts found
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {suggestions.map((contact, index) => (
                    <div
                      key={contact.email}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddEmail(contact.email);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700",
                        focusedIndex === index && "bg-blue-50 dark:bg-blue-900/20"
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        {contact.picture && <AvatarImage src={contact.picture} />}
                        <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {getInitials(contact.name, contact.email)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 overflow-hidden">
                        <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {contact.name || contact.email.split('@')[0]}
                        </div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {contact.email}
                        </div>
                      </div>
                    
                    </div>
                  ))}
                  
                  {/* Add current input as option if it looks like an email */}
                  {inputValue.includes('@') && !suggestions.some(s => s.email.toLowerCase() === inputValue.toLowerCase()) && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddEmail(inputValue);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="flex cursor-pointer items-center gap-3 border-t border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Add "{inputValue}"
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Press Enter to add this email
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
);

ContactAutocomplete.displayName = 'ContactAutocomplete'; 