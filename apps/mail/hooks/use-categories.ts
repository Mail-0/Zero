import { useSettings } from '@/hooks/use-settings';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface CategorySetting {
  id: 'Important' | 'All Mail' | 'Personal' | 'Promotions' | 'Updates' | 'Unread';
  name: string;
  searchValue: string;
  order: number;
  icon?: string;
  isDefault: boolean;
}

export function useCategorySettings(): CategorySetting[] {
  const { data } = useSettings();

  const trpc = useTRPC();
  const { data: defaultCategories = [] } = useQuery(
    trpc.categories.defaults.queryOptions(void 0, { staleTime: Infinity }),
  );

  if (!defaultCategories.length) return [];

  const merged = useMemo(() => {
    const overrides = (data?.settings.categories as CategorySetting[] | undefined) ?? [];

    const overridden = defaultCategories.map((cat) => {
      const custom = overrides.find((c) => c.id === cat.id);
      return custom
        ? {
            ...cat,
            ...custom,
          }
        : cat;
    });

    const sorted = overridden.sort((a, b) => a.order - b.order);
    return sorted;
  }, [data?.settings.categories, defaultCategories]);

  return merged;
}

export function useDefaultCategoryId(): string {
  const categories = useCategorySettings();
  const defaultCat = categories.find((c) => c.isDefault) ?? categories[0];
  return defaultCat?.id ?? 'All Mail';
}