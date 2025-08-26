import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const getLocalTimeFromDate = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const getNowTime = () => getLocalTimeFromDate(new Date());

interface ScheduleSendPickerProps {
  value?: string | undefined;
  onChange: (value?: string) => void;
  className?: string;
  onValidityChange?: (isValid: boolean) => void;
}

export const ScheduleSendPicker: React.FC<ScheduleSendPickerProps> = ({
  value,
  onChange,
  className,
  onValidityChange,
}) => {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const isScheduling = !!value;
  const selectedDate = value ? new Date(value) : undefined;
  const time = value ? getLocalTimeFromDate(new Date(value)) : getNowTime();

  const emitChange = useCallback((datePart: Date | undefined, timePart: string, validate: boolean = false) => {
    if (!datePart) {
      onChange(undefined);
      if (validate) {
        onValidityChange?.(true);
      }
      return;
    }

    const [hhStr, mmStr = '00'] = timePart.split(':');
    const hours = Number(hhStr);
    const minutes = Number(mmStr);

    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      if (validate) {
        onValidityChange?.(false);
      }
      return;
    }

    const combinedDate = new Date(datePart);
    combinedDate.setHours(hours, minutes, 0, 0);

    if (validate && combinedDate.getTime() < Date.now()) {
      toast.error('Scheduled time cannot be in the past');
      onValidityChange?.(false);
      return;
    }

    if (validate) {
      onValidityChange?.(true);
    }
    onChange(combinedDate.toISOString());
  }, [onChange, onValidityChange]);

  const handleDateSelect = useCallback((d?: Date) => {
    emitChange(d, time, false);
  }, [emitChange, time]);

  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    emitChange(selectedDate, val, false);
  }, [selectedDate, emitChange]);

  const handleDatePickerClose = useCallback((open: boolean) => {
    setDatePickerOpen(open);
    if (!open && selectedDate) {
      emitChange(selectedDate, time, true);
    }
  }, [selectedDate, time, emitChange]);

  const handleTimePickerClose = useCallback((open: boolean) => {
    setTimePickerOpen(open);
    if (!open && selectedDate) {
      emitChange(selectedDate, time, true);
    }
  }, [selectedDate, time, emitChange]);

  const handleToggleScheduling = useCallback(() => {
    if (isScheduling) {
      onChange(undefined);
    } else {
      const now = new Date();
      emitChange(now, getNowTime());
    }
  }, [isScheduling, onChange, emitChange]);

  const formatTime12Hour = (timeStr: string) => {
    try {
      const [hhStr, mmStr = '00'] = timeStr.split(':');
      const preview = new Date();
      preview.setHours(Number(hhStr), Number(mmStr), 0, 0);
      return format(preview, 'hh:mm aaa');
    } catch {
      return timeStr;
    }
  };

  const triggerLabel = (() => {
    if (!selectedDate) return 'Send later';
    try {
      const formattedTime = formatTime12Hour(time);
      const formattedDate = format(selectedDate, 'dd MMM yyyy');
      return `${formattedDate} ${formattedTime}`;
    } catch {
      return 'Send later';
    }
  })();

  if (isScheduling) {
    return (
      <>
        <Popover open={datePickerOpen} onOpenChange={handleDatePickerClose}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent',
                className,
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              <span>
                {selectedDate ? format(selectedDate, 'dd MMM yyyy') : 'Select Date'}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="z-[100] w-auto p-4" align="start" side="top" sideOffset={8}>
            <div className="space-y-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={{ before: startOfToday() }}
                className="rounded-md"
                captionLayout="dropdown"
              />
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={timePickerOpen} onOpenChange={handleTimePickerClose}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent',
                className,
              )}
            >
              <Clock className="h-4 w-4" />
              <span>{formatTime12Hour(time)}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="z-[100] w-auto p-4" align="start" side="top" sideOffset={8}>
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Select Time</h3>
              <Input
                type="time"
                value={time}
                onChange={handleTimeChange}
                className="w-full"
              />
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={handleToggleScheduling}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-sm bg-background hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors cursor-pointer',
            className,
          )}
        >
          <span>Cancel</span>
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggleScheduling}
      className={cn(
        'flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent',
        className,
      )}
    >
      <Clock className="h-4 w-4" />
      <span>{triggerLabel}</span>
    </button>
  );
};