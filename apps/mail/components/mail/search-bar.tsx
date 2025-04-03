import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSearchValue } from '@/hooks/use-search-value';
import { enhanceSearchQuery } from '@/actions/ai-search';
import { type DateRange } from 'react-day-picker';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import React from 'react';

const SEARCH_SUGGESTIONS = [
  '"Emails from last week..."',
  '"Emails with attachments..."',
  '"Unread emails..."',
  '"Emails from Caroline and Josh..."',
  '"Starred emails..."',
  '"Emails with links..."',
  '"Emails from last month..."',
];

type SearchForm = {
  subject: string;
  from: string;
  to: string;
  q: string;
  dateRange: DateRange;
  category: string;
  folder: string;
};

export function SearchBar() {
  const router = useRouter();
  const query = useSearchParams();
  const { threadId, folder } = useParams<{ threadId: string; folder: string }>();
  const [, setSearchValue] = useSearchValue();
  const [isSearching, setIsSearching] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SearchForm>({
    defaultValues: {
      folder: '',
      subject: '',
      from: '',
      to: '',
      q: query.get('q')?.trim() ?? '',
      dateRange: {
        from: undefined,
        to: undefined,
      },
      category: '',
    },
  });

  const formValues = useMemo(
    () => ({
      q: form.watch('q'),
    }),
    [form.watch('q')],
  );

  const [isFocused, setIsFocused] = useState(false);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const suggestionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isFocused && !formValues.q) {
      suggestionIntervalRef.current = setInterval(() => {
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentSuggestionIndex((prev) => (prev + 1) % SEARCH_SUGGESTIONS.length);
          setIsAnimating(false);
        }, 300);
      }, 3000);
    } else {
      if (suggestionIntervalRef.current) {
        clearInterval(suggestionIntervalRef.current);
      }
    }

    return () => {
      if (suggestionIntervalRef.current) {
        clearInterval(suggestionIntervalRef.current);
      }
    };
  }, [isFocused, formValues.q]);

  const submitSearch = useCallback(
    async (data: SearchForm) => {
      setIsSearching(true);
      let searchTerms = [];

      try {
        // Only enhance the query if there's a search term
        if (data.q.trim()) {
          setIsAISearching(true);
          const { enhancedQuery, error } = await enhanceSearchQuery(data.q.trim());

          if (error) {
            console.error('AI enhancement error:', error);
            // Fallback to original query if AI enhancement fails
            searchTerms.push(data.q.trim());
          } else {
            searchTerms.push(enhancedQuery);
          }
        }

        // Add any additional filters
        if (data.from) searchTerms.push(`from:${data.from.toLowerCase()}`);
        if (data.to) searchTerms.push(`to:${data.to.toLowerCase()}`);
        if (data.subject) searchTerms.push(`subject:(${data.subject})`);
        if (data.dateRange.from)
          searchTerms.push(`after:${format(data.dateRange.from, 'yyyy/MM/dd')}`);
        if (data.dateRange.to)
          searchTerms.push(`before:${format(data.dateRange.to, 'yyyy/MM/dd')}`);

        const searchQuery = searchTerms.join(' ');

        console.log('Final search query:', searchQuery);

        if (threadId) router.push(`/mail/${folder}/${threadId}/?q=${searchQuery}`);
        else router.push(`/mail/${folder}/?q=${searchQuery}`);

        setIsAISearching(false);

        setSearchValue({
          value: searchQuery,
          highlight: data.q,
          folder: folder,
          isLoading: true,
          isAISearching: isAISearching,
        });
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to regular search if AI fails
        if (data.q) {
          searchTerms.push(data.q.trim());
        }
        const searchQuery = searchTerms.join(' ');
        setSearchValue({
          value: searchQuery,
          highlight: data.q,
          folder: folder,
          isLoading: true,
          isAISearching: false,
        });
      } finally {
        setIsSearching(false);
      }
    },
    [setSearchValue, isAISearching],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      if (!inputValue.trim()) {
        form.setValue('q', '');
        resetSearch();
        return;
      }

      form.setValue('q', inputValue);
    },
    [form],
  );

  const resetSearch = useCallback(() => {
    form.reset();
    setSearchValue({
      value: '',
      highlight: '',
      folder: '',
      isLoading: false,
      isAISearching: false,
    });
  }, [form, setSearchValue]);

  return (
    <div className="relative flex-1 md:max-w-[600px]">
      <form className="relative flex items-center" onSubmit={form.handleSubmit(submitSearch)}>
        <Search className="text-muted-foreground absolute left-2.5 h-4 w-4" aria-hidden="true" />
        <div className="relative w-full">
          <Input
            placeholder={isFocused ? '' : 'Search...'}
            ref={inputRef}
            className="bg-muted/50 text-muted-foreground ring-muted placeholder:text-muted-foreground/70 h-8 w-full rounded-md border-none pl-9 pr-14 shadow-none transition-all duration-300"
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            value={formValues.q}
            disabled={isSearching}
          />
          {formValues.q && (
            <button
              type="button"
              onClick={resetSearch}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
              disabled={isSearching}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isFocused && !formValues.q && (
            <div
              className={cn(
                'text-muted-foreground/70 pointer-events-none absolute bottom-[5.5px] left-9 right-0 -translate-y-1/2 text-sm',
                isAnimating
                  ? 'translate-y-2 opacity-0 transition-all duration-300 ease-out'
                  : 'translate-y-0 opacity-100 transition-all duration-300 ease-in',
              )}
            >
              {SEARCH_SUGGESTIONS[currentSuggestionIndex]}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
