'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

interface EmailRecipientProps {
  emails: string[];
  onEmailsChange: (emails: string[]) => void;
  placeholder?: string;
  onHasChanges?: () => void;
}

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function AddRecipient({ emails, onEmailsChange, placeholder, onHasChanges }: EmailRecipientProps) {
  const [toInput, setToInput] = React.useState('');
  const [editingEmailIndex, setEditingEmailIndex] = React.useState<number | null>(null);
  const [editingEmailValue, setEditingEmailValue] = React.useState('');

  const handleAddEmail = (email: string) => {
    const trimmedEmail = email.trim().replace(/,$/, '');

    if (!trimmedEmail) return;

    if (!isValidEmail(trimmedEmail)) {
      toast.error(`Invalid email format: ${trimmedEmail}`);
      return;
    }

    if (emails.includes(trimmedEmail)) {
      toast.error(`Email already exists: ${trimmedEmail}`);
      return;
    }

    onEmailsChange([...emails, trimmedEmail]);
    setToInput('');
    onHasChanges?.();
  };

  const handleEmailEdit = (event: React.FocusEvent<HTMLInputElement>): void => {
    if (editingEmailIndex === null) return;

    const newEmail = event.target.value.trim();
    const currentEmail = emails[editingEmailIndex];

    // Clear email entry if edit input is empty
    if (!newEmail) {
      onEmailsChange(emails.filter((_, index) => index !== editingEmailIndex));
      setEditingEmailIndex(null);
      setEditingEmailValue('');
      onHasChanges?.();
      return;
    }

    // Skip validation if email hasn't changed
    if (newEmail === currentEmail) {
      setEditingEmailIndex(null);
      setEditingEmailValue('');
      return;
    }

    // Check email validity
    if (!isValidEmail(newEmail)) {
      event.preventDefault();
      toast.error(`Invalid email format: ${newEmail}`);
      event.target.focus();
      return;
    }

    // Check for duplicates if email has changed
    if (emails.includes(newEmail)) {
      event.preventDefault();
      toast.error(`Email already exists: ${newEmail}`);
      event.target.focus();
      return;
    }

    // Update email only if format is valid and not duplicate
    onEmailsChange(emails.map((email, index) => (index === editingEmailIndex ? newEmail : email)));
    onHasChanges?.();
    setEditingEmailIndex(null);
    setEditingEmailValue('');
  };

  return (
    <div className="group relative left-[2px] flex w-full flex-wrap items-center rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
      {emails.map((email, index) => (
        <div
          key={index}
          className="bg-accent flex items-center gap-1 rounded-md border px-2 text-sm font-medium mr-1 mb-1"
        >
          {editingEmailIndex === index ? (
            <input
              type="email"
              className="bg-accent max-w-[120px] focus:outline-none"
              value={editingEmailValue}
              onChange={(e) => setEditingEmailValue(e.target.value)}
              onBlur={handleEmailEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  setEditingEmailIndex(null);
                }
              }}
              autoFocus
            />
          ) : (
            <span
              className="max-w-[150px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap"
              onClick={() => {
                setEditingEmailIndex(index);
                setEditingEmailValue(email);
              }}
            >
              {email}
            </span>
          )}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground ml-1 rounded-full"
            onClick={() => {
              const newEmails = emails.filter((_, i) => i !== index);
              onEmailsChange(newEmails);
              onHasChanges?.();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <input
        type="email"
        className="text-md relative left-[3px] min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
        placeholder={emails.length ? '' : placeholder}
        value={toInput}
        onChange={(e) => setToInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === ',' || e.key === 'Enter' || e.key === ' ') && toInput.trim()) {
            e.preventDefault();
            handleAddEmail(toInput);
          } else if (e.key === 'Backspace' && !toInput && emails.length > 0) {
            e.preventDefault();
            const newEmails = [...emails];
            newEmails.pop();
            onEmailsChange(newEmails);
            onHasChanges?.();
          }
        }}
        onBlur={() => {
          if (toInput.trim()) {
            handleAddEmail(toInput);
          }
        }}
      />
    </div>
  );
}
