import {
  UserRound,
  Mail,
  AlertTriangle,
  User,
  Bell,
  Tag,
  MailQuestion,
  MailCheck,
  Star,
  Users,
  Paperclip,
  CalendarIcon,
} from 'lucide-react';
import type { FilterSuggestion } from './utils';
import React from 'react';

export const filterSuggestions: FilterSuggestion[] = [
  // "is:" filters
  {
    prefix: 'is',
    filter: 'is:all',
    description: 'Show all emails',
    icon: React.createElement(Mail, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'is',
    filter: 'is:important',
    description: 'Show important emails',
    icon: React.createElement(AlertTriangle, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'is',
    filter: 'is:personal',
    description: 'Show personal emails',
    icon: React.createElement(User, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'is',
    filter: 'is:updates',
    description: 'Show update emails',
    icon: React.createElement(Bell, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'is',
    filter: 'is:promotions',
    description: 'Show promotional emails',
    icon: React.createElement(Tag, { className: 'h-5 w-5 rotate-90' }),
  },
  {
    prefix: 'is',
    filter: 'is:unread',
    description: 'Show unread emails',
    icon: React.createElement(MailQuestion, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'is',
    filter: 'is:read',
    description: 'Show read emails',
    icon: React.createElement(MailCheck, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'is',
    filter: 'is:starred',
    description: 'Show starred emails',
    icon: React.createElement(Star, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'is',
    filter: 'is:social',
    description: 'Show social emails',
    icon: React.createElement(Users, { className: 'h-5 w-5' }),
  },

  // "has:" filters
  {
    prefix: 'has',
    filter: 'has:attachment',
    description: 'Emails with attachments',
    icon: React.createElement(Paperclip, { className: 'h-5 w-5' }),
  },

  // "from:" filters
  {
    prefix: 'from',
    filter: 'from:me',
    description: "Emails you've sent",
    icon: React.createElement(UserRound, { className: 'h-5 w-5' }),
  },

  // "to:" filters
  {
    prefix: 'to',
    filter: 'to:me',
    description: "Emails where you're the direct recipient",
    icon: React.createElement(Mail, { className: 'h-5 w-5' }),
  },

  // "date:" filters
  {
    prefix: 'after',
    filter: 'after:date',
    description: 'Emails after a specific date',
    icon: React.createElement(CalendarIcon, { className: 'h-5 w-5' }),
  },
  {
    prefix: 'before',
    filter: 'before:date',
    description: 'Emails before a specific date',
    icon: React.createElement(CalendarIcon, { className: 'h-5 w-5' }),
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
        icon:
          prefix === 'from'
            ? React.createElement(UserRound, { className: 'h-5 w-5' })
            : React.createElement(Mail, { className: 'h-5 w-5' }),
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
