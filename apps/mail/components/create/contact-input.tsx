import { useContacts } from '@/hooks/use-contacts';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import React from 'react';

type Props = {
  type: 'to' | 'cc' | 'bcc';
  emails: string[];
  setEmails: React.Dispatch<React.SetStateAction<string[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  selectedContactIndex: number;
  setSelectedContactIndex: React.Dispatch<React.SetStateAction<number>>;
  isLoading: boolean;
  handleEmailInputChange: (type: 'to' | 'cc' | 'bcc', value: string) => void;
  handleAddEmail: (type: 'to' | 'cc' | 'bcc', email: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
};

const ContactInput = ({
  type,
  emails,
  setEmails,
  input,
  setInput,
  selectedContactIndex,
  setSelectedContactIndex,
  isLoading,
  handleEmailInputChange,
  handleAddEmail,
  inputRef,
  placeholder,
  setHasUnsavedChanges,
}: Props) => {
  const t = useTranslations();

  const contacts = useContacts();

  const filteredContacts = React.useMemo(() => {
    const searchTerm = input.toLowerCase();
    return contacts.filter(
      (contact) =>
        (contact.email?.toLowerCase().includes(searchTerm) ||
          contact.name?.toLowerCase().includes(searchTerm)) &&
        !emails.includes(contact.email),
    );
  }, [contacts, input, emails]);

  return (
    <div className="group relative left-[2px] flex w-full flex-wrap items-center rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
      {emails.map((email, index) => (
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
              setEmails((prevEmails) => prevEmails.filter((_, i) => i !== index));
              setHasUnsavedChanges(true);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          disabled={isLoading}
          type="text"
          className="text-md relative left-[3px] w-full min-w-[120px] bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
          placeholder={emails.length ? '' : placeholder || t('pages.createEmail.example')}
          value={input}
          onChange={(e) => handleEmailInputChange(type, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (filteredContacts.length > 0 && e.key === 'Enter') {
                const selectedEmail = filteredContacts[selectedContactIndex]?.email;
                if (selectedEmail) handleAddEmail(type, selectedEmail);
                setSelectedContactIndex(0);
              } else if (input.trim()) {
                handleAddEmail(type, input);
              }
            } else if (e.key === 'ArrowDown' && filteredContacts.length > 0) {
              e.preventDefault();
              setSelectedContactIndex((prev) => Math.min(prev + 1, filteredContacts.length - 1));
            } else if (e.key === 'ArrowUp' && filteredContacts.length > 0) {
              e.preventDefault();
              setSelectedContactIndex((prev) => Math.max(prev - 1, 0));
            }
          }}
        />
        {input && filteredContacts.length > 0 && (
          <div className="bg-background absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border shadow-lg">
            {filteredContacts.map((contact, index) => (
              <button
                key={contact.email}
                className={`w-full px-3 py-2 text-left text-sm ${selectedContactIndex === index ? 'bg-accent' : 'hover:bg-accent/50'}`}
                onClick={() => {
                  handleAddEmail(type, contact.email);
                  setSelectedContactIndex(0);
                }}
              >
                <div className="font-medium">{contact.name || contact.email}</div>
                {contact.name && (
                  <div className="text-muted-foreground text-xs">{contact.email}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactInput;
