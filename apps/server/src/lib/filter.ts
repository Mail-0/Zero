import type { FilterSuggestion } from './utils';

export const filterSuggestions: FilterSuggestion[] = [
  // "is:" filters
  {
    prefix: 'is',
    filter: 'is:all',
    description: 'Show all emails',
  },
  {
    prefix: 'is',
    filter: 'is:important',
    description: 'Show important emails',
  },
  {
    prefix: 'is',
    filter: 'is:personal',
    description: 'Show personal emails',
  },
  {
    prefix: 'is',
    filter: 'is:updates',
    description: 'Show update emails',
  },
  {
    prefix: 'is',
    filter: 'is:promotions',
    description: 'Show promotional emails',
  },
  {
    prefix: 'is',
    filter: 'is:unread',
    description: 'Show unread emails',
  },
  {
    prefix: 'is',
    filter: 'is:read',
    description: 'Show read emails',
  },
  {
    prefix: 'is',
    filter: 'is:starred',
    description: 'Show starred emails',
  },
  {
    prefix: 'is',
    filter: 'is:social',
    description: 'Show social emails',
  },

  // "has:" filters
  {
    prefix: 'has',
    filter: 'has:attachment',
    description: 'Emails with attachments',
  },

  // "from:" filters
  {
    prefix: 'from',
    filter: 'from:me',
    description: "Emails you've sent",
  },

  // "to:" filters
  {
    prefix: 'to',
    filter: 'to:me',
    description: "Emails where you're the direct recipient",
  },

  // "date:" filters
  {
    prefix: 'after',
    filter: 'after:date',
    description: 'Emails after a specific date',
  },
  {
    prefix: 'before',
    filter: 'before:date',
    description: 'Emails before a specific date',
  },
  {
    prefix: 'draft',
    filter: '',
    description: 'Emails in the draft folder',
  },
];

export const getFilterSuggestionGridColumns = (count: number, isMobile: boolean): string => {
  if (count <= 0) return 'grid-cols-1';

  if (isMobile) {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    return 'grid-cols-3';
  }

  if (count <= 4) return 'grid-cols-4';
  if (count <= 6) return 'grid-cols-5';
  return 'grid-cols-6';
};

export const matchFilterPrefix = (text: string): [string, string, string] | null => {
  const regex = /(\w+):([^:\s]*)$/;
  const match = text.match(regex);
  if (match && match[1]) {
    return [match[0], match[1], match[2] || ''];
  }
  return null;
};

export const filterSuggestionsFunction = (
  suggestions: FilterSuggestion[],
  prefix: string,
  query: string,
): FilterSuggestion[] => {
  if (!suggestions?.length) return [];

  if (prefix === 'from' || prefix === 'to') {
    return handleEmailFilters(suggestions, prefix, query);
  }

  if (prefix === 'after' || prefix === 'before') {
    return suggestions.filter((suggestion) => suggestion.prefix === prefix);
  }

  if (!query) {
    return suggestions.filter((suggestion) => suggestion.prefix === prefix);
  }

  return filterByPrefixAndQuery(suggestions, prefix, query);
};

export const handleEmailFilters = (
  suggestions: FilterSuggestion[],
  prefix: string,
  query: string,
): FilterSuggestion[] => {
  if (!query) {
    return suggestions.filter((suggestion) => suggestion.prefix === prefix);
  }

  if (query && query !== 'me') {
    return [
      {
        prefix,
        filter: `${prefix}:${query.toLowerCase()}`,
        description:
          prefix === 'from'
            ? `Emails from senders containing "${query}"`
            : `Emails to recipients containing "${query}"`,
      },
    ];
  }

  return suggestions.filter(
    (suggestion) =>
      suggestion.prefix === prefix &&
      suggestion.filter.toLowerCase().includes(`${prefix}:${query.toLowerCase()}`),
  );
};

export const filterByPrefixAndQuery = (
  suggestions: FilterSuggestion[],
  prefix: string,
  query: string,
): FilterSuggestion[] => {
  const lowerQuery = query.toLowerCase();

  return suggestions.filter((suggestion) => {
    if (suggestion.prefix !== prefix) return false;

    const colonIndex = suggestion.filter.indexOf(':');
    if (colonIndex === -1) return false;

    const filterValue = suggestion.filter.substring(colonIndex + 1).toLowerCase();
    return filterValue.includes(lowerQuery);
  });
};
