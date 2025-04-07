'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { isValidEmail } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EmailTagProps {
  email: string;
  onRemove: () => void;
  disabled?: boolean;
  onEdit?: (newEmail: string) => void;
}

export function EmailTag({ email, onRemove, disabled, onEdit }: EmailTagProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(email);

  const handleEdit = (event: React.FocusEvent<HTMLInputElement>) => {
    const newEmail = event.target.value.trim();

    // Cancel edit if empty
    if (!newEmail) {
      setIsEditing(false);
      setEditValue(email);
      return;
    }

    // Skip if unchanged
    if (newEmail === email) {
      setIsEditing(false);
      return;
    }

    // Validate email format
    if (!isValidEmail(newEmail)) {
      event.preventDefault();
      toast.error(`Invalid email format: ${newEmail}`);
      event.target.focus();
      return;
    }

    // Update email
    onEdit?.(newEmail);
    setIsEditing(false);
  };

  return (
    <div className="bg-accent flex items-center gap-1 rounded-md border px-2 text-sm font-medium">
      {isEditing ? (
        <input
          type="email"
          className="bg-accent focus:outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              setIsEditing(false);
              setEditValue(email);
            }
          }}
          disabled={disabled}
          autoFocus
        />
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="max-w-[160px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap"
                onClick={() => {
                  if (!disabled && onEdit) {
                    setIsEditing(true);
                    setEditValue(email);
                  }
                }}
              >
                {email}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{email}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <button
        type="button"
        disabled={disabled}
        className="text-muted-foreground hover:text-foreground ml-1 rounded-full"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
