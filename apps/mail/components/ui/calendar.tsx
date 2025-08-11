import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { addMonths, subMonths, getYear, getMonth, setYear, setMonth, format } from 'date-fns';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  yearRange?: number; 
};

function Calendar({ className, classNames, showOutsideDays = true, captionLayout, yearRange = 10, ...props }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  
  const years = useMemo(() => Array.from({ length: yearRange }, (_, i) => new Date().getFullYear() + i), [yearRange]);
  
  const handleMonthChange = useCallback((monthIndex: string) => {
    const parsedMonth = parseInt(monthIndex, 10);
    
    
    if (!Number.isFinite(parsedMonth) || parsedMonth < 0 || parsedMonth > 11) {
      console.warn(`Invalid month value: ${monthIndex}. Expected 0-11, got ${parsedMonth}`);
      return;
    }
    
    const newDate = setMonth(currentMonth, parsedMonth);
    setCurrentMonth(newDate);
  }, [currentMonth]);
  
  const handleYearChange = useCallback((year: string) => {
    const parsedYear = parseInt(year, 10);
    if (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      console.warn(`Invalid year value: ${year}. Expected 1900-2100, got ${parsedYear}`);
      return; 
    }
    
    const newDate = setYear(currentMonth, parsedYear);
    setCurrentMonth(newDate);
  }, [currentMonth]);

  const handlePreviousMonth = useCallback((displayMonth: Date) => {
    setCurrentMonth(subMonths(displayMonth, 1));
  }, []);

  const handleNextMonth = useCallback((displayMonth: Date) => {
    setCurrentMonth(addMonths(displayMonth, 1));
  }, []);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      month={currentMonth}
      onMonthChange={setCurrentMonth}
      captionLayout={captionLayout}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100',
        ),
        day_range_end: 'day-range-end',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside:
          'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn('h-4 w-4', className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn('h-4 w-4', className)} {...props} />
        ),
        Caption: ({ displayMonth }) => (
          <div className="flex items-center justify-between w-full px-1">
            <button
              onClick={() => handlePreviousMonth(displayMonth)}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-3 -ml-2">
              <select 
                value={getMonth(displayMonth).toString()} 
                onChange={(e) => handleMonthChange(e.target.value)}
                className="h-8 w-[100px] rounded-md bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring border-none text-center"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const monthDate = new Date(2024, i, 1);
                  return (
                    <option key={i} value={i.toString()}>
                      {format(monthDate, 'MMMM')}
                    </option>
                  );
                })}
              </select>
              
              <select 
                value={getYear(displayMonth).toString()} 
                onChange={(e) => handleYearChange(e.target.value)}
                className="h-8 w-[80px] rounded-md bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring border-none text-center"
              >
                {years.map((year) => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => handleNextMonth(displayMonth)}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
