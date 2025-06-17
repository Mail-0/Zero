import { useSettings } from '@/hooks/use-settings';
import { useMemo } from 'react';

export interface CategorySetting {
  id: 'Important' | 'All Mail' | 'Personal' | 'Promotions' | 'Updates' | 'Unread';
  name: string;
  searchValue: string;
  order: number;
  isDefault?: boolean;
}

/**
 * Returns the user customised category settings if present, falling back to sensible defaults.
 */
export function useCategorySettings(): CategorySetting[] {
  const { data } = useSettings();

  // Fallback defaults – must stay in sync with server defaults
  const defaultCategories: CategorySetting[] = [
    {
      id: 'Important',
      name: 'Important',
      searchValue: 'is:important NOT is:sent NOT is:draft',
      order: 0,
      isDefault: false,
    },
    {
      id: 'All Mail',
      name: 'All Mail',
      searchValue: 'NOT is:draft (is:inbox OR (is:sent AND to:me))',
      order: 1,
      isDefault: true,
    },
    {
      id: 'Personal',
      name: 'Personal',
      searchValue: 'is:personal NOT is:sent NOT is:draft',
      order: 2,
      isDefault: false,
    },
    {
      id: 'Promotions',
      name: 'Promotions',
      searchValue: 'is:promotions NOT is:sent NOT is:draft',
      order: 3,
      isDefault: false,
    },
    {
      id: 'Updates',
      name: 'Updates',
      searchValue: 'is:updates NOT is:sent NOT is:draft',
      order: 4,
      isDefault: false,
    },
    {
      id: 'Unread',
      name: 'Unread',
      searchValue: 'is:unread NOT is:sent NOT is:draft',
      order: 5,
      isDefault: false,
    },
  ];

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

    // Ensure every override id present – ignore unknown ids for safety
    const sorted = overridden.sort((a, b) => a.order - b.order);
    return sorted;
  }, [data?.settings.categories]);

  return merged;
}

// Added util to easily get default category id
export function useDefaultCategoryId(): string {
  const categories = useCategorySettings();
  const defaultCat = categories.find((c) => c.isDefault) ?? categories[0];
  return defaultCat?.id ?? 'All Mail';
} 