import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ScheduleSendPickerProps {
  value?: string | undefined;
  onChange: (value?: string) => void;
  className?: string;
}

export const ScheduleSendPicker: React.FC<ScheduleSendPickerProps> = ({
  value,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const [localValue, setLocalValue] = useState<string>(() => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const iso = d.toISOString();
    return iso.substring(0, 16);
  });

  useEffect(() => {
    if (isOpen && !value && !localValue) {
      const now = new Date();
      setLocalValue(now.toISOString().substring(0, 16));
    }
  }, [isOpen, value, localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (!e.target.value) {
      onChange(undefined);
      return;
    }
    const selected = new Date(e.target.value);
    onChange(selected.toISOString());
  };

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
          <span>{localValue ? format(new Date(localValue), 'dd MMM yyyy hh:mm aaa') : 'Send later'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-64 p-4" align="start" side="top" sideOffset={8}>
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold">Choose date & time</label>
          <input
            type="datetime-local"
            value={localValue}
            onChange={handleChange}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};