import { parseNaturalLanguageSearch, parseNaturalLanguageDate } from '@/lib/utils';
import { useSearchValue } from '@/hooks/use-search-value';
import { useState, useEffect, useCallback } from 'react';
import { Search } from '@/components/icons/icons';
import { type DateRange } from 'react-day-picker';
import { Input } from '@/components/ui/input';
import { useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import React from 'react';

type SearchForm = {
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  q: string;
  dateRange: DateRange;
  category: string;
  folder: string;
  has: any;
  fileName: any;
  deliveredTo: string;
  unicorn: string;
};

export function SearchBar() {
  // const [popoverOpen, setPopoverOpen] = useState(false);
  const [, setSearchValue] = useSearchValue();
  const [isSearching, setIsSearching] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;

  const form = useForm<SearchForm>({
    defaultValues: {
      folder: '',
      subject: '',
      from: '',
      to: '',
      cc: '',
      bcc: '',
      q: '',
      dateRange: {
        from: undefined,
        to: undefined,
      },
      category: '',
      has: '',
      fileName: '',
      deliveredTo: '',
      unicorn: '',
    },
  });

  const q = form.watch('q');

  useEffect(() => {
    if (pathname !== '/mail/inbox') {
      resetSearch();
    }
  }, [pathname]);

  const submitSearch = useCallback(
    async (data: SearchForm) => {
      setIsSearching(true);
      let searchTerms = [];

      try {
        if (data.q.trim()) {
          const searchTerm = data.q.trim();

          // Parse natural language date queries
          const dateRange = parseNaturalLanguageDate(searchTerm);
          if (dateRange) {
            if (dateRange.from) {
              // Format date according to Gmail's requirements (YYYY/MM/DD)
              const fromDate = format(dateRange.from, 'yyyy/MM/dd');
              searchTerms.push(`after:${fromDate}`);
            }
            if (dateRange.to) {
              // Format date according to Gmail's requirements (YYYY/MM/DD)
              const toDate = format(dateRange.to, 'yyyy/MM/dd');
              searchTerms.push(`before:${toDate}`);
            }

            // For date queries, we don't want to search the content
            const cleanedQuery = searchTerm
              .replace(/emails?\s+from\s+/i, '')
              .replace(/\b\d{4}\b/g, '')
              .replace(
                /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
                '',
              )
              .trim();

            if (cleanedQuery) {
              searchTerms.push(cleanedQuery);
            }
          } else {
            // Parse natural language search patterns
            const parsedTerm = parseNaturalLanguageSearch(searchTerm);
            if (parsedTerm !== searchTerm) {
              searchTerms.push(parsedTerm);
            } else {
              if (searchTerm.includes('@')) {
                searchTerms.push(`from:${searchTerm}`);
              } else {
                searchTerms.push(
                  `(from:${searchTerm} OR from:"${searchTerm}" OR subject:"${searchTerm}" OR "${searchTerm}")`,
                );
              }
            }
          }
        }

        // Add filters
        if (data.folder) searchTerms.push(`in:${data.folder.toLowerCase()}`);
        if (data.has) searchTerms.push(`has:${data.has.toLowerCase()}`);
        if (data.fileName) searchTerms.push(`filename:${data.fileName}`);
        if (data.deliveredTo) searchTerms.push(`deliveredto:${data.deliveredTo.toLowerCase()}`);
        if (data.unicorn) searchTerms.push(`+${data.unicorn}`);

        let searchQuery = searchTerms.join(' ');
        searchQuery = extractMetaText(searchQuery) || '';

        console.log('Final search query:', {
          value: searchQuery,
          highlight: data.q,
          folder: data.folder ? data.folder.toUpperCase() : '',
          isLoading: true,
          isAISearching: false,
        });

        setSearchValue({
          value: searchQuery,
          highlight: data.q,
          folder: data.folder ? data.folder.toUpperCase() : '',
          isLoading: true,
          isAISearching: false,
        });
      } catch (error) {
        console.error('Search error:', error);
        if (data.q) {
          const searchTerm = data.q.trim();
          const parsedTerm = parseNaturalLanguageSearch(searchTerm);
          if (parsedTerm !== searchTerm) {
            searchTerms.push(parsedTerm);
          } else {
            if (searchTerm.includes('@')) {
              searchTerms.push(`from:${searchTerm}`);
            } else {
              searchTerms.push(
                `(from:${searchTerm} OR from:"${searchTerm}" OR subject:"${searchTerm}" OR "${searchTerm}")`,
              );
            }
          }
        }
        setSearchValue({
          value: searchTerms.join(' '),
          highlight: data.q,
          folder: data.folder ? data.folder.toUpperCase() : '',
          isLoading: true,
          isAISearching: false,
        });
      } finally {
        setIsSearching(false);
      }
    },
    [setSearchValue],
  );

  const resetSearch = useCallback(() => {
    form.reset({
      folder: '',
      subject: '',
      from: '',
      to: '',
      cc: '',
      bcc: '',
      q: '',
      dateRange: {
        from: undefined,
        to: undefined,
      },
      category: '',
      has: '',
      fileName: '',
      deliveredTo: '',
      unicorn: '',
    });
    setSearchValue({
      value: '',
      highlight: '',
      folder: '',
      isLoading: false,
      isAISearching: false,
    });
  }, [form, setSearchValue]);

  return (
    <div className="relative flex-1">
      <form className="relative flex items-center" onSubmit={form.handleSubmit(submitSearch)}>
        <Search
          className="fill-muted-foreground absolute left-2.5 top-[10px] z-10 h-3.5 w-3.5 dark:fill-[#727272]"
          aria-hidden="true"
        />

        <div className="relative w-full">
          <Input
            placeholder={'Search'}
            className="text-muted-foreground placeholder:text-muted-foreground/70 h-[32px] w-full select-none rounded-md border bg-white pl-8 pr-14 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-none dark:bg-[#141414]"
            {...form.register('q')}
            value={q}
            disabled={isSearching}
          />
          {q && (
            <button
              type="button"
              onClick={resetSearch}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
              disabled={isSearching}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function extractMetaText(text: string) {
  // Check if the text contains a query enclosed in quotes
  const quotedQueryMatch = text.match(/["']([^"']+)["']/);
  if (quotedQueryMatch && quotedQueryMatch[1]) {
    // Return just the content inside the quotes
    return quotedQueryMatch[1].trim();
  }

  // Check for common patterns where the query is preceded by explanatory text
  const patternMatches = [
    // Match "Here is the converted query:" pattern
    text.match(/here is the (converted|enhanced) query:?\s*["']?([^"']+)["']?/i),
    // Match "The search query is:" pattern
    text.match(/the (search query|query) (is|would be):?\s*["']?([^"']+)["']?/i),
    // Match "I've converted your query to:" pattern
    text.match(/i('ve| have) converted your query to:?\s*["']?([^"']+)["']?/i),
    // Match "Converting to:" pattern
    text.match(/converting to:?\s*["']?([^"']+)["']?/i),
  ].filter(Boolean);

  if (patternMatches.length > 0 && patternMatches[0]) {
    // Return the captured query part (last capture group)
    const match = patternMatches[0];

    if (!match[match.length - 1]) return;

    return match[match.length - 1]!.trim();
  }

  // If no patterns match, remove common explanatory text and return
  let cleanedText = text
    // Remove "I focused on..." explanations
    .replace(/I focused on.*$/im, '')
    // Remove "Here's a precise..." explanations
    .replace(/Here's a precise.*$/im, '')
    // Remove any explanations after the query
    .replace(/\n\nThis (query|search).*$/im, '')
    // Remove any explanations before the query
    .replace(/^.*?(from:|to:|subject:|is:|has:|after:|before:)/i, '$1')
    // Clean up any remaining quotes
    .replace(/["']/g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedText;
}
