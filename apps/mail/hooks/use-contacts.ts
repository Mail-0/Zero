import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export const useContactSearch = (query: string, enabled = true) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.contacts.search.queryOptions({ query, limit: 10 }),
    enabled: enabled && query.length > 0,
  });
};

export const useRecentContacts = (limit = 20) => {
  const trpc = useTRPC();
  return useQuery(trpc.contacts.recent.queryOptions({ limit }));
};

export interface Contact {
  email: string;
  name: string | null;
  frequency: number;
  lastUsed: Date | null;
  source: 'sent' | 'received' | 'both';
  picture?: string | null;
}

export const useContactSuggestions = (currentInput: string, enabled = true) => {
  const { data: searchResults, isLoading: isSearching } = useContactSearch(currentInput, enabled);
  const { data: recentContacts, isLoading: isLoadingRecent } = useRecentContacts();

  const suggestions = useMemo(() => {
    if (currentInput.length > 0 && searchResults) {
      return searchResults;
    }
    return recentContacts || [];
  }, [currentInput, searchResults, recentContacts]);

  return {
    suggestions,
    isLoading: isSearching || isLoadingRecent,
  };
}; 