import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';

const CATEGORY_PALETTES = [
  'border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/60 dark:text-violet-100',
  'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/60 dark:text-sky-100',
  'border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-100',
  'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-100',
  'border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/60 dark:text-rose-100',
  'border-cyan-200/80 bg-cyan-50 text-cyan-900 dark:border-cyan-500/40 dark:bg-cyan-950/60 dark:text-cyan-100',
  'border-indigo-200/80 bg-indigo-50 text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-950/60 dark:text-indigo-100',
  'border-orange-200/80 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-950/60 dark:text-orange-100',
] as const;

const ICON_PALETTES = [
  'text-violet-600 dark:text-violet-300',
  'text-sky-600 dark:text-sky-300',
  'text-emerald-600 dark:text-emerald-300',
  'text-amber-600 dark:text-amber-300',
  'text-rose-600 dark:text-rose-300',
  'text-cyan-600 dark:text-cyan-300',
  'text-indigo-600 dark:text-indigo-300',
  'text-orange-600 dark:text-orange-300',
] as const;

function getCategoryPaletteIndex(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % CATEGORY_PALETTES.length;
}

export function formatCategoryDisplayName(name: string): string {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const paletteIndex = getCategoryPaletteIndex(category.toLowerCase());

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide shadow-sm',
        CATEGORY_PALETTES[paletteIndex],
        className,
      )}
      title={`Category: ${formatCategoryDisplayName(category)}`}
    >
      <LayoutGrid className={cn('h-3 w-3 shrink-0', ICON_PALETTES[paletteIndex])} />
      <span className="truncate">{formatCategoryDisplayName(category)}</span>
    </span>
  );
}
