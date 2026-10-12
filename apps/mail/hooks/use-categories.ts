import { useTRPC } from '@/providers/query-provider';
import { useSettings } from '@/hooks/use-settings';
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

const CATEGORY_SEPARATOR = ',';
const ALL_MAIL_ID = 'All Mail';
// Categories that narrow down the other selected categories (AND) instead of adding to them (OR)
const FILTER_CATEGORY_IDS = new Set(['Unread']);

export function parseCategoryIds(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(CATEGORY_SEPARATOR)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function serializeCategoryIds(ids: string[]): string {
  return ids.join(CATEGORY_SEPARATOR);
}

/**
 * Toggle a category in the current selection.
 * - "All Mail" is exclusive: selecting it clears every other category.
 * - Selecting any other category removes "All Mail".
 * - Deselecting the last category falls back to "All Mail".
 */
export function toggleCategoryId(current: string[], id: string): string[] {
  if (id === ALL_MAIL_ID) return [ALL_MAIL_ID];
  const withoutAll = current.filter((c) => c !== ALL_MAIL_ID);
  const next = withoutAll.includes(id) ? withoutAll.filter((c) => c !== id) : [...withoutAll, id];
  return next.length ? next : [ALL_MAIL_ID];
}

const wrap = (parts: string[]) =>
  parts.length === 1 ? parts[0] : parts.map((p) => `(${p})`).join(' OR ');

/**
 * Build a single search query from multiple selected categories.
 * Regular categories are OR'd together; filter categories (e.g. Unread) are AND'd on top.
 */
export function buildCategorySearchValue(
  ids: string[],
  categories: { id: string; searchValue: string }[],
): string {
  const selected = categories.filter((c) => ids.includes(c.id) && c.searchValue);
  if (!selected.length) return '';

  const base = selected.filter((c) => !FILTER_CATEGORY_IDS.has(c.id)).map((c) => c.searchValue);
  const filters = selected.filter((c) => FILTER_CATEGORY_IDS.has(c.id)).map((c) => c.searchValue);

  if (!base.length) return filters.map((f) => (filters.length > 1 ? `(${f})` : f)).join(' ');
  if (!filters.length) return wrap(base);
  return [`(${wrap(base)})`, ...filters.map((f) => `(${f})`)].join(' ');
}

export function useDefaultCategoryId(): string {
  const categories = useCategorySettings();
  const defaultCat = categories.find((c) => c.isDefault) ?? categories[0];
  return defaultCat?.id ?? 'All Mail';
}
