import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { matchFilterPrefix, filterSuggestionsFunction, filterSuggestions } from '@/lib/filter';
import { cn, extractFilterValue, type FilterSuggestion, FOLDER_NAMES, formatDate, getEmailLogo } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, SlidersHorizontal, CalendarIcon, X, Send, BarChart2, Globe, Video, PlaneTakeoff, AudioLines, Clock, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchValue } from '@/hooks/use-search-value';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { type DateRange } from 'react-day-picker';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
import { format } from 'date-fns';
import { Toggle } from '../ui/toggle';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useRouter, useSearchParams } from 'next/navigation';
import items from './demo.json';

function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

function DateFilter({ date, setDate }: { date: DateRange; setDate: (date: DateRange) => void }) {
  const t = useTranslations('common.searchBar');

  return (
    <div className="grid gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'justify-start text-left font-normal',
              !date && 'text-muted-foreground',
              'bg-muted/50 h-10 rounded-md',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>{t('pickDateRange')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-md p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(range) => range && setDate(range)}
            numberOfMonths={useIsMobile() ? 1 : 2}
            disabled={(date) => date > new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

type SearchForm = {
  subject: string;
  from: string;
  to: string;
  q: string;
  dateRange: DateRange;
  category: string;
  folder: string;
};

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  short?: string;
  end?: string;
}

const allActions = [
  {
    id: "1",
    label: "Book tickets",
    icon: <PlaneTakeoff className="h-4 w-4 text-blue-500" />,
    description: "Operator",
    short: "⌘K",
    end: "Agent",
  },
  {
    id: "2",
    label: "Summarize",
    icon: <BarChart2 className="h-4 w-4 text-orange-500" />,
    description: "gpt-4o",
    short: "⌘cmd+p",
    end: "Command",
  },
  {
    id: "3",
    label: "Screen Studio",
    icon: <Video className="h-4 w-4 text-purple-500" />,
    description: "gpt-4o",
    short: "",
    end: "Application",
  },
  {
    id: "4",
    label: "Talk to Jarvis",
    icon: <AudioLines className="h-4 w-4 text-green-500" />,
    description: "gpt-4o voice",
    short: "",
    end: "Active",
  },
  {
    id: "5",
    label: "Translate",
    icon: <Globe className="h-4 w-4 text-blue-500" />,
    description: "gpt-4o",
    short: "",
    end: "Command",
  },
];

interface SearchHistory {
  id: string;
  query: string;
  timestamp: number;
}

const MAX_HISTORY_ITEMS = 10;
const STORAGE_KEY = 'mail_search_history';

function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistory[]>([]);

  useEffect(() => {
    // Load history from localStorage on mount
    const savedHistory = localStorage.getItem(STORAGE_KEY);
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return;

    setHistory((prev) => {
      const newHistory = [
        {
          id: Date.now().toString(),
          query: query.trim(),
          timestamp: Date.now(),
        },
        ...prev.filter((item) => item.query !== query.trim()),
      ].slice(0, MAX_HISTORY_ITEMS);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, addToHistory, clearHistory };
}

interface SearchResult {
  id: string;
  threadId?: string;
  sender: {
    name: string;
    email: string;
  };
  subject: string;
  receivedOn: string;
  unread: boolean;
}

export function SearchBar() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [, setSearchValue] = useSearchValue();
  const [value, setValue] = useState<SearchForm>({
    folder: '',
    subject: '',
    from: '',
    to: '',
    q: '',
    dateRange: {
      from: undefined,
      to: undefined,
    },
    category: '',
  });

  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const debouncedQuery = useDebounce(value.q, 200);

  const t = useTranslations();

  const [suggestionsState, setSuggestionsState] = useState({
    show: false,
    filtered: [] as FilterSuggestion[],
    activeIndex: 0,
    activePrefix: null as string | null,
  });

  const [datePickerState, setDatePickerState] = useState({
    show: false,
    filterType: null as 'after' | 'before' | null,
    position: { left: 0, top: 0 },
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const form = useForm<SearchForm>({
    defaultValues: value,
  });

  const formValues = useMemo(
    () => ({
      q: form.watch('q'),
    }),
    [form.watch('q')],
  );

  const filtering = useMemo(
    () =>
      value.q.length > 0 ||
      value.from.length > 0 ||
      value.to.length > 0 ||
      value.dateRange.from ||
      value.dateRange.to ||
      value.category ||
      value.folder,
    [value],
  );

  const container = {
    hidden: { opacity: 0, height: 0 },
    show: {
      opacity: 1,
      height: 'auto',
      transition: {
        height: {
          duration: 0.4,
        },
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: {
        height: {
          duration: 0.3,
        },
        opacity: {
          duration: 0.2,
        },
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: {
        duration: 0.2,
      },
    },
  };

  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [showActions, setShowActions] = useState(false);

  const { history, addToHistory, clearHistory } = useSearchHistory();

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const folder = value.folder ? value.folder.toUpperCase() : '';

  useEffect(() => {
    if (!isFocused) {
      setShowActions(false);
      return;
    }

    if (!value.q) {
      setShowActions(true);
      return;
    }

    const normalizedQuery = value.q.toLowerCase().trim();
    const hasFilterPrefix = matchFilterPrefix(value.q);
    
    if (!hasFilterPrefix) {
      setIsSearching(true);
      setIsLoading(true);
      
      // Simulate API delay
      setTimeout(() => {
        // Use the same filtering logic as mail list
        const results = (items as SearchResult[]).filter(item => {
          const searchTerm = normalizedQuery;
          return (
            item.subject.toLowerCase().includes(searchTerm) ||
            item.sender.name.toLowerCase().includes(searchTerm) ||
            item.sender.email.toLowerCase().includes(searchTerm)
          );
        }).slice(0, 5);
        
        setSearchResults(results);
        setIsLoading(false);
      }, 300);
    } else {
      setIsSearching(false);
    }
  }, [value.q, isFocused]);

  const handleActionClick = useCallback((action: Action) => {
    setSelectedAction(action);
    setShowActions(false);
    // Handle the action here
    console.log('Selected action:', action);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const cursorPosition = e.target.selectionStart || 0;

      if (!inputValue.trim()) {
        setSuggestionsState((prev) => ({ ...prev, show: false }));
        setDatePickerState((prev) => ({ ...prev, show: false }));
        form.setValue('q', '');
        return;
      }

      setIsTyping(true);
      const textBeforeCursor = inputValue.substring(0, cursorPosition);
      const match = matchFilterPrefix(textBeforeCursor);

      if (match) {
        const [, prefix, query] = match;
        const suggestions = filterSuggestionsFunction(filterSuggestions, prefix, query);

        if (prefix === 'after' || prefix === 'before') {
          setDatePickerState((prev) => ({
            ...prev,
            filterType: prefix as 'after' | 'before',
          }));

          const inputEl = inputRef.current;
          if (inputEl) {
            const span = document.createElement('span');
            span.style.visibility = 'hidden';
            span.style.position = 'absolute';
            span.style.whiteSpace = 'pre';
            span.style.font = window.getComputedStyle(inputEl).font;
            span.textContent = textBeforeCursor;
            document.body.appendChild(span);

            const rect = inputEl.getBoundingClientRect();
            const spanWidth = span.getBoundingClientRect().width;

            document.body.removeChild(span);

            setDatePickerState((prev) => ({
              ...prev,
              position: {
                left: Math.min(spanWidth, rect.width - 320),
                top: rect.height,
              },
            }));
          }
        }

        setSuggestionsState({
          show: true,
          filtered: suggestions,
          activeIndex: 0,
          activePrefix: prefix,
        });
      } else {
        setSuggestionsState((prev) => ({ ...prev, show: false, activePrefix: null }));
        setDatePickerState((prev) => ({ ...prev, show: false, filterType: null }));
      }

      form.setValue('q', inputValue);
    },
    [form],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!suggestionsState.show) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          setSuggestionsState((prev) => ({
            ...prev,
            activeIndex: prev.activeIndex > 0 ? prev.activeIndex - 1 : prev.filtered.length - 1,
          }));
        } else {
          setSuggestionsState((prev) => ({
            ...prev,
            activeIndex: prev.activeIndex < prev.filtered.length - 1 ? prev.activeIndex + 1 : 0,
          }));
        }
        return;
      }

      const handleArrowNavigation = (direction: 'right' | 'left' | 'down' | 'up') => {
        e.preventDefault();
        // Estimate columns based on container width and button width
        const containerWidth = 600; // Max width of the dropdown
        const buttonWidth = isMobile ? 80 : 100; // The minmax value from grid
        const gap = 12; // gap-3 is 12px
        const columns = Math.floor((containerWidth + gap) / (buttonWidth + gap));

        setSuggestionsState((prev) => {
          let nextIndex = prev.activeIndex;

          switch (direction) {
            case 'right':
              nextIndex =
                prev.activeIndex < prev.filtered.length - 1
                  ? prev.activeIndex + 1
                  : prev.activeIndex;
              break;
            case 'left':
              nextIndex = prev.activeIndex > 0 ? prev.activeIndex - 1 : 0;
              break;
            case 'down':
              nextIndex = prev.activeIndex + columns;
              nextIndex = nextIndex < prev.filtered.length ? nextIndex : prev.activeIndex;
              break;
            case 'up':
              nextIndex = prev.activeIndex - columns;
              nextIndex = nextIndex >= 0 ? nextIndex : prev.activeIndex;
              break;
          }

          return { ...prev, activeIndex: nextIndex };
        });
      };

      if (e.key === 'ArrowRight') handleArrowNavigation('right');
      else if (e.key === 'ArrowLeft') handleArrowNavigation('left');
      else if (e.key === 'ArrowDown') handleArrowNavigation('down');
      else if (e.key === 'ArrowUp') handleArrowNavigation('up');

      if (e.key === 'Enter' && suggestionsState.show) {
        e.preventDefault();
        const suggestion = suggestionsState.filtered?.[suggestionsState.activeIndex];
        if (suggestion) {
          handleSuggestionClick(suggestion.filter);
        }
        return;
      }

      if (e.key === 'Escape') {
        setSuggestionsState((prev) => ({ ...prev, show: false }));
      }
    },
    [suggestionsState, isMobile],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setSuggestionsState((prev) => ({ ...prev, show: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const submitSearch = useCallback(
    (data: SearchForm) => {
      if (data.q) {
        const processedQuery = data.q
          .replace(/from:([^\s]+)/g, (_, address) =>
            address.toLowerCase() === 'me' ? 'from:me' : `from:${address.toLowerCase()}`,
          )
          .replace(/to:([^\s]+)/g, (_, address) =>
            address.toLowerCase() === 'me' ? 'to:me' : `to:${address.toLowerCase()}`,
          );

        addToHistory(processedQuery);
      }

      // Show search results in dropdown
      setIsSearching(true);
      // Filter demo items for search results
      const results = (items as SearchResult[]).filter(item => 
        item.subject.toLowerCase().includes(data.q.toLowerCase()) ||
        item.sender.name.toLowerCase().includes(data.q.toLowerCase())
      ).slice(0, 5);
      setSearchResults(results);
    },
    [addToHistory],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      const inputValue = form.getValues().q || '';
      const cursorPosition = inputRef.current?.selectionStart || 0;

      const textBeforeCursor = inputValue.substring(0, cursorPosition);
      const textAfterCursor = inputValue.substring(cursorPosition);

      const match = matchFilterPrefix(textBeforeCursor);

      if (match) {
        const [fullMatch] = match;
        const startPos = textBeforeCursor.lastIndexOf(fullMatch);

        if ((match[1] === 'after' || match[1] === 'before') && suggestion.endsWith('date')) {
          setDatePickerState((prev) => ({ ...prev, show: true }));
          setSuggestionsState((prev) => ({ ...prev, show: false }));
          return;
        }

        const newValue = inputValue.substring(0, startPos) + suggestion + ' ' + textAfterCursor;

        form.setValue('q', newValue);

        submitSearch({
          ...form.getValues(),
          q: newValue,
        });
      }

      setSuggestionsState((prev) => ({ ...prev, show: false }));
      inputRef.current?.focus();
    },
    [form, submitSearch],
  );

  const handleDateSelect = useCallback(
    (dateRange: DateRange | undefined) => {
      if (!dateRange || !datePickerState.filterType) return;

      let filterText = '';

      if (datePickerState.filterType === 'after' && dateRange.from) {
        const formattedDate = format(dateRange.from, 'yyyy/MM/dd');
        filterText = `after:${formattedDate}`;

        if (dateRange.to) {
          const formattedEndDate = format(dateRange.to, 'yyyy/MM/dd');
          filterText += ` before:${formattedEndDate}`;
        }
      } else if (datePickerState.filterType === 'before' && dateRange.to) {
        const formattedDate = format(dateRange.to, 'yyyy/MM/dd');
        filterText = `before:${formattedDate}`;

        if (dateRange.from) {
          const formattedStartDate = format(dateRange.from, 'yyyy/MM/dd');
          filterText = `after:${formattedStartDate} before:${formattedDate}`;
        }
      }

      if (!filterText) return;

      const inputValue = form.getValues().q || '';
      const cursorPosition = inputRef.current?.selectionStart || 0;

      const textBeforeCursor = inputValue.substring(0, cursorPosition);
      const textAfterCursor = inputValue.substring(cursorPosition);

      const match = matchFilterPrefix(textBeforeCursor);

      if (match) {
        const [fullMatch] = match;
        const startPos = textBeforeCursor.lastIndexOf(fullMatch);
        const newValue = inputValue.substring(0, startPos) + filterText + ' ' + textAfterCursor;

        form.setValue('q', newValue);

        submitSearch({
          ...form.getValues(),
          q: newValue,
        });
      }

      setDatePickerState((prev) => ({ ...prev, show: false }));
      inputRef.current?.focus();
    },
    [datePickerState.filterType, form, submitSearch],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDatePickerState((prev) => ({ ...prev, show: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const renderSuggestions = useCallback(() => {
    const { show, filtered = [] } = suggestionsState;
    if (!show || filtered.length === 0) return null;

    return (
      <div
        className="border-border bg-background animate-in fade-in-50 slide-in-from-top-2 absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border shadow-md duration-150"
        role="listbox"
        aria-label="Search filter suggestions"
        style={{
          maxWidth: isMobile ? 'calc(100vw - 24px)' : '600px',
          maxHeight: isMobile ? '50vh' : '400px',
        }}
      >
        <div className="p-3">
          {suggestionsState.activePrefix && (
            <div className="mb-2 px-1">
              <div className="text-muted-foreground text-xs">
                <span className="font-medium">{suggestionsState.activePrefix}:</span> filters
              </div>
            </div>
          )}

          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '80px' : '100px'}, 1fr))`,
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {filtered.map((suggestion, index) => {
              const value = extractFilterValue(suggestion.filter);
              const isEmailFilter = suggestion.prefix === 'from' || suggestion.prefix === 'to';

              return (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.filter)}
                  role="option"
                  aria-selected={index === suggestionsState.activeIndex}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-md px-2 py-3 transition-all',
                    'hover:border-accent/30 focus-visible:ring-ring border focus:outline-none focus-visible:ring-2',
                    'h-[80px]',
                    index === suggestionsState.activeIndex
                      ? 'bg-accent/15 border-accent/30 text-accent-foreground'
                      : 'hover:bg-muted/50 border-transparent',
                  )}
                  onMouseEnter={() =>
                    !isMobile && setSuggestionsState((prev) => ({ ...prev, activeIndex: index }))
                  }
                  title={suggestion.description}
                >
                  <div className="text-foreground flex h-6 w-6 items-center justify-center">
                    {suggestion.icon}
                  </div>

                  <div
                    className={cn(
                      'w-full truncate text-center text-xs',
                      isEmailFilter ? '' : 'capitalize',
                    )}
                  >
                    {isEmailFilter ? value.toLowerCase() : value}
                  </div>
                </button>
              );
            })}
          </div>

          {!isMobile && filtered.length > 1 && (
            <div className="text-muted-foreground border-border/15 mt-2 border-t pt-2 text-center text-[9px]">
              <kbd className="border-border/30 rounded border px-1 text-[9px]">↹</kbd> to navigate •
              <kbd className="border-border/30 ml-1 rounded border px-1 text-[9px]">↵</kbd> to
              select
            </div>
          )}
        </div>
      </div>
    );
  }, [suggestionsState, isMobile, handleSuggestionClick]);

  const renderDatePicker = useCallback(() => {
    if (!datePickerState.show) return null;

    return (
      <div
        ref={datePickerRef}
        className="border-border bg-background animate-in fade-in-50 slide-in-from-top-2 absolute z-50 mt-1 overflow-hidden rounded-lg border shadow-md duration-150"
        style={{
          left: Math.max(0, datePickerState.position.left - (isMobile ? 160 : 320)), // Adjust based on device
          top: `${datePickerState.position.top}px`,
        }}
      >
        <div className="p-1">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={new Date()}
            selected={undefined}
            onSelect={handleDateSelect}
            numberOfMonths={isMobile ? 1 : 2}
            disabled={(date) => date > new Date()}
            className="rounded-md border-none"
          />
        </div>
      </div>
    );
  }, [datePickerState, isMobile, handleDateSelect]);

  useEffect(() => {
    const subscription = form.watch((data) => {
      setValue(data as SearchForm);
    });
    return () => subscription.unsubscribe();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [form.watch]);

  const resetSearch = useCallback(() => {
    form.reset();
    setSearchValue({
      value: '',
      highlight: '',
      folder: '',
    });
  }, [form, setSearchValue]);

  const handleHistoryClick = useCallback((query: string) => {
    form.setValue('q', query);
    submitSearch({ ...value, q: query });
    setIsFocused(false);
  }, [form, submitSearch, value]);

  const handleClearHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearHistory();
  }, [clearHistory]);

  // Update the handleSearchResultClick to use the searchParams hook
  const handleSearchResultClick = useCallback((result: SearchResult) => {
    const threadId = result.threadId ?? result.id;
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set('threadId', threadId);
    router.push(`/mail/${folder}?${currentParams.toString()}`);
    setIsFocused(false);
  }, [folder, router, searchParams]);

  return (
    <div className="relative flex-1 md:max-w-[600px]">
      <form className="relative flex items-center" onSubmit={form.handleSubmit(submitSearch)}>
        <AnimatePresence mode="popLayout">
          {value.q.length > 0 ? (
            <motion.div
              key="send"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute left-2.5"
            >
              <Send className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </motion.div>
          ) : (
            <motion.div
              key="search"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute left-2.5"
            >
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
        <Input
          placeholder={t('common.searchBar.search')}
          ref={inputRef}
          className="pl-9 pr-14 h-8"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          value={formValues.q}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
        <AnimatePresence>
          {isFocused && (showActions || suggestionsState.show || isSearching) && (
            <motion.div
              className="border-border bg-background absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border-2 shadow-md md:max-w-[600px]"
              variants={container}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <motion.div className="p-3">
                {showActions && !value.q ? (
                  <>
                    <div className="mb-2 px-1 flex items-center justify-between">
                      <div className="text-muted-foreground text-xs">
                        <span className="font-medium">Recent Searches</span>
                      </div>
                      {history.length > 0 && (
                        <button
                          onClick={handleClearHistory}
                          className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Clear
                        </button>
                      )}
                    </div>
                    <motion.ul className="space-y-1">
                      {history.length > 0 ? (
                        history.map((item) => (
                          <motion.li
                            key={item.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer rounded-md"
                            onClick={() => handleHistoryClick(item.query)}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{item.query}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </motion.li>
                        ))
                      ) : (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          No recent searches
                        </li>
                      )}
                    </motion.ul>
                  </>
                ) : isSearching ? (
                  <>
                    <div className="mb-2 px-1 flex items-center justify-between">
                      <div className="text-muted-foreground text-xs">
                        <span className="font-medium">Search Results</span>
                      </div>
                    </div>
                    {isLoading ? (
                      <div className="flex flex-col gap-2 py-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2">
                            <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <motion.ul className="space-y-1">
                        {searchResults.length > 0 ? (
                          searchResults.map((result) => (
                            <motion.li
                              key={result.id}
                              className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer rounded-md"
                              variants={item}
                              onClick={() => handleSearchResultClick(result)}
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6 rounded-full">
                                    <AvatarImage src={getEmailLogo(result.sender.email)} className="rounded-full" />
                                    <AvatarFallback className="rounded-full">{result.sender.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{result.sender.name}</span>
                                  {result.unread && (
                                    <span className="size-2 rounded bg-[#006FFE]" />
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground ml-8">{result.subject}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(result.receivedOn.split('.')[0] || '')}
                              </span>
                            </motion.li>
                          ))
                        ) : (
                          <li className="px-3 py-2 text-sm text-muted-foreground">
                            No results found
                          </li>
                        )}
                      </motion.ul>
                    )}
                  </>
                ) : (
                  <>
                    {suggestionsState.activePrefix && (
                      <div className="mb-2 px-1">
                        <div className="text-muted-foreground text-xs">
                          <span className="font-medium">{suggestionsState.activePrefix}:</span> filters
                        </div>
                      </div>
                    )}
                    <motion.div
                      className="grid gap-3"
                      style={{
                        gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '80px' : '100px'}, 1fr))`,
                        maxHeight: '300px',
                        overflowY: 'auto',
                      }}
                    >
                      {suggestionsState.filtered.map((suggestion, index) => {
                        const value = extractFilterValue(suggestion.filter);
                        const isEmailFilter = suggestion.prefix === 'from' || suggestion.prefix === 'to';

                        return (
                          <motion.button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion.filter)}
                            role="option"
                            aria-selected={index === suggestionsState.activeIndex}
                            className={cn(
                              'flex flex-col items-center justify-center gap-1.5 rounded-md px-2 py-3 transition-all',
                              'hover:border-accent/30 focus-visible:ring-ring border focus:outline-none focus-visible:ring-2',
                              'h-[80px]',
                              index === suggestionsState.activeIndex
                                ? 'bg-accent/15 border-accent/30 text-accent-foreground'
                                : 'hover:bg-muted/50 border-transparent',
                            )}
                            onMouseEnter={() =>
                              !isMobile && setSuggestionsState((prev) => ({ ...prev, activeIndex: index }))
                            }
                            title={suggestion.description}
                            variants={item}
                          >
                            <div className="text-foreground flex h-6 w-6 items-center justify-center">
                              {suggestion.icon}
                            </div>

                            <div
                              className={cn(
                                'w-full truncate text-center text-xs',
                                isEmailFilter ? '' : 'capitalize',
                              )}
                            >
                              {isEmailFilter ? value.toLowerCase() : value}
                            </div>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {renderDatePicker()}
        <div className="absolute right-1 z-20 flex items-center gap-1">
          {filtering && (
            <button
              type="button"
              onClick={resetSearch}
              className="ring-offset-background focus:ring-ring rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t('common.searchBar.clearSearch')}</span>
            </button>
          )}
          {/* <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'text-muted-foreground hover:bg-muted/70 hover:text-foreground h-7 w-7 rounded-md p-0',
                  popoverOpen && 'bg-muted/70 text-foreground',
                )}
                type="button"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">{t('common.searchBar.advancedSearch')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="bg-popover w-[min(calc(100vw-2rem),400px)] rounded-md border p-4 shadow-lg sm:w-[500px] md:w-[600px]"
              side="bottom"
              sideOffset={15}
              alignOffset={-8}
              align="end"
            >
              <div className="space-y-5">
                <div>
                  <h2 className="mb-3 text-xs font-semibold">
                    {t('common.searchBar.quickFilters')}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted h-7 rounded-md text-xs"
                      onClick={() => form.setValue('q', 'is:unread')}
                    >
                      {t('common.searchBar.unread')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted h-7 rounded-md text-xs"
                      onClick={() => form.setValue('q', 'has:attachment')}
                    >
                      {t('common.searchBar.hasAttachment')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted h-7 rounded-md text-xs"
                      onClick={() => form.setValue('q', 'is:starred')}
                    >
                      {t('common.searchBar.starred')}
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="grid gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">
                      {t('common.searchBar.searchIn')}
                    </label>
                    <Select
                      onValueChange={(value) => form.setValue('folder', value)}
                      value={form.watch('folder')}
                    >
                      <SelectTrigger className="bg-muted/50 h-8 rounded-md capitalize">
                        <SelectValue placeholder="All Mail" />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {FOLDER_NAMES.map((inbox) => (
                          <SelectItem key={inbox} value={inbox} className="capitalize">
                            {inbox}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">{t('common.searchBar.subject')}</label>
                    <Input
                      placeholder={t('common.searchBar.subject')}
                      {...form.register('subject')}
                      className="bg-muted/50 h-8 rounded-md"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">
                        {t('common.mailDisplay.from')}
                      </label>
                      <Input
                        placeholder={t('common.searchBar.sender')}
                        {...form.register('from')}
                        className="bg-muted/50 h-8 rounded-md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold">{t('common.mailDisplay.to')}</label>
                      <Input
                        placeholder={t('common.searchBar.recipient')}
                        {...form.register('to')}
                        className="bg-muted/50 h-8 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">
                      {t('common.searchBar.dateRange')}
                    </label>
                    <DateFilter
                      date={value.dateRange}
                      setDate={(range) => form.setValue('dateRange', range)}
                    />
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div>
                  <h2 className="mb-3 text-xs font-semibold">{t('common.searchBar.category')}</h2>
                  <div className="flex flex-wrap gap-2">
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'primary'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'primary' : '')
                      }
                    >
                      {t('common.mailCategories.primary')}
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'updates'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'updates' : '')
                      }
                    >
                      {t('common.mailCategories.updates')}
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'promotions'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'promotions' : '')
                      }
                    >
                      {t('common.mailCategories.promotions')}
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'social'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'social' : '')
                      }
                    >
                      {t('common.mailCategories.social')}
                    </Toggle>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    onClick={resetSearch}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground h-8 rounded-md text-xs transition-colors"
                  >
                    {t('common.searchBar.reset')}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md text-xs shadow-none transition-colors"
                    type="submit"
                    onClick={() => setPopoverOpen(false)}
                  >
                    {t('common.searchBar.applyFilters')}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover> */}
        </div>
      </form>
    </div>
  );
}
