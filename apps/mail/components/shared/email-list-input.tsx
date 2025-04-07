import { useState } from 'react';
import { EmailTag } from './email-tag';
import { toast } from 'sonner';
import { isValidEmail } from '@/lib/utils';

interface EmailListInputProps {
  emails: string[];
  onEmailsChange: (emails: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChangeComplete?: () => void;
}

export function EmailListInput({
  emails,
  onEmailsChange,
  disabled,
  placeholder,
  className = '',
  onChangeComplete,
}: EmailListInputProps) {
  const [input, setInput] = useState('');

  const handleAddEmail = (email: string) => {
    const cleanedEmail = email.trim().replace(/,$/, '');
    if (!cleanedEmail) return;

    if (emails.includes(cleanedEmail)) {
      setInput('');
      return;
    }

    if (!isValidEmail(cleanedEmail)) {
      toast.error(`Invalid email format: ${cleanedEmail}`);
      return;
    }

    onEmailsChange([...emails, cleanedEmail]);
    setInput('');
    onChangeComplete?.();
  };

  const handleRemoveEmail = (index: number) => {
    onEmailsChange(emails.filter((_, i) => i !== index));
    onChangeComplete?.();
  };

  const handleEditEmail = (index: number, newEmail: string) => {
    const cleanedEmail = newEmail.trim().replace(/,$/, '');
    if (!cleanedEmail) {
      handleRemoveEmail(index);
      return;
    }

    if (!isValidEmail(cleanedEmail)) {
      toast.error(`Invalid email format: ${cleanedEmail}`);
      return;
    }

    if (emails.includes(cleanedEmail)) {
      toast.error(`Email already exists: ${cleanedEmail}`);
      return;
    }

    onEmailsChange(emails.map((email, i) => (i === index ? cleanedEmail : email)));
    onChangeComplete?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === ',' || e.key === 'Enter' || e.key === ' ') && input.trim()) {
      e.preventDefault();
      handleAddEmail(input);
    } else if (e.key === 'Backspace' && !input && emails.length > 0) {
      handleRemoveEmail(emails.length - 1);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {emails.map((email, index) => (
        <EmailTag
          key={index}
          email={email}
          disabled={disabled}
          onRemove={() => handleRemoveEmail(index)}
          onEdit={(newEmail) => handleEditEmail(index, newEmail)}
        />
      ))}
      <input
        type="email"
        disabled={disabled}
        className="text-md min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
        placeholder={emails.length ? '' : placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) {
            handleAddEmail(input);
          }
        }}
      />
    </div>
  );
}
