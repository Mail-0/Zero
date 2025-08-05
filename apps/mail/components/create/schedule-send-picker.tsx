import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ScheduleSendPickerProps {
  value?: string | undefined;
  onChange: (value?: string) => void;
  className?: string;
  onValidityChange?: (isValid: boolean) => void;
}

const toLocalInputValue = (date: Date) => {
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
};

export const ScheduleSendPicker: React.FC<ScheduleSendPickerProps> = ({
  value,
  onChange,
  className,
  onValidityChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const [localValue, setLocalValue] = useState<string>(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return toLocalInputValue(d);
    }
    return '';
  });

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setLocalValue(toLocalInputValue(d));
      }
    } else {
      setLocalValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);

    if (!val) {
      onChange(undefined);
      onValidityChange?.(true);
      return;
    }

    const maybeDate = new Date(val);

    // Invalid date string
    if (isNaN(maybeDate.getTime())) {
      onValidityChange?.(false);
      return;
    }

    const now = new Date();
    if (maybeDate.getTime() < now.getTime()) {
      toast.error('Scheduled time cannot be in the past');
      onValidityChange?.(false);
      return;
    }

    onValidityChange?.(true);
    onChange(maybeDate.toISOString());
  };

  const displayValue = localValue || toLocalInputValue(new Date());

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent',
            className,
          )}
        >
          <Clock className="h-4 w-4" />
          <span>
            {(() => {
              if (!localValue) return 'Send later';
              const parsed = new Date(localValue);
              if (!isValid(parsed)) return 'Send later';
              try {
                return format(parsed, 'dd MMM yyyy hh:mm aaa');
              } catch (error) {
                console.error('Error formatting date', error);
                return 'Send later';
              }
            })()}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-64 p-4" align="start" side="top" sideOffset={8}>
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold">Choose date & time</label>
          <input
            type="datetime-local"
            value={displayValue}
            onChange={handleChange}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};