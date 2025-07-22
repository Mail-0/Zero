import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useSearchValue } from '@/hooks/use-search-value';
import { trpcClient } from '@/providers/query-provider';
import { useMail } from '@/components/mail/use-mail';
import { Checkbox } from '@/components/ui/checkbox';
import { useThreads } from '@/hooks/use-threads';
import { useParams } from 'react-router';
import { Check } from '../icons/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function SelectAllCheckbox({ className }: { className?: string }) {
  const [mail, setMail] = useMail();
  const [, loadedThreads] = useThreads();
  const [searchValue] = useSearchValue();
  const { value: query } = searchValue;
  const { folder = 'inbox' } = useParams<{ folder: string }>() ?? {};

  const [isFetchingIds, setIsFetchingIds] = useState(false);
  const allIdsCache = useRef<string[] | null>(null);

  const checkboxRef = useRef<HTMLButtonElement>(null);

  const loadedIds = useMemo(() => loadedThreads.map((t) => t.id), [loadedThreads]);

  const isAllLoadedSelected = useMemo(() => {
    if (loadedIds.length === 0) return false;
    return loadedIds.every((id) => mail.bulkSelected.includes(id));
  }, [loadedIds, mail.bulkSelected]);

  const isIndeterminate = useMemo(() => {
    return mail.bulkSelected.length > 0 && !isAllLoadedSelected;
  }, [mail.bulkSelected.length, isAllLoadedSelected]);

  const fetchAllMatchingThreadIds = useCallback(async (): Promise<string[]> => {
    const ids: string[] = [];
    let cursor = '';
    const MAX_PER_PAGE = 500;

    try {
      while (true) {
        const page = await trpcClient.mail.listThreads.query({
          folder,
          q: query,
          maxResults: MAX_PER_PAGE,
          cursor,
        });
        if (page?.threads?.length) {
          ids.push(...page.threads.map((t: { id: string }) => t.id));
        }
        if (!page?.nextPageToken) break;
        cursor = page.nextPageToken;
      }
    } catch (err: any) {
      console.error('Failed to fetch all thread IDs', err);
      toast.error(err?.message ?? 'Failed to select all emails');
    }

    return ids;
  }, [folder, query]);

  const handleToggle = useCallback(() => {
    if (isFetchingIds) return;

    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
      return;
    }

    setMail((prev) => ({ ...prev, bulkSelected: loadedIds }));

    toast(
      `${loadedIds.length} conversation${loadedIds.length !== 1 ? 's' : ''} on this page selected.`,
      {
        action: {
          label: 'Select all conversations',
          onClick: async () => {
            try {
              if (!allIdsCache.current) {
                setIsFetchingIds(true);
                allIdsCache.current = await fetchAllMatchingThreadIds();
                setIsFetchingIds(false);
              }
              const allIds = allIdsCache.current ?? [];
              setMail((prev) => ({ ...prev, bulkSelected: allIds }));
            } catch (err) {
              console.error(err);
              setIsFetchingIds(false);
              toast.error('Failed to select all conversations');
            }
          },
        },
        className: '!w-auto whitespace-nowrap',
      },
    );
  }, [isFetchingIds, mail.bulkSelected.length, loadedIds, fetchAllMatchingThreadIds, setMail]);

  useEffect(() => {
    allIdsCache.current = null;
  }, [folder, query, searchValue]);

  return (
    <button
      onClick={handleToggle}
      disabled={isFetchingIds}
      className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      aria-label="Select all emails"
      aria-pressed={isAllLoadedSelected}
      type="button"
    >
      <Checkbox
        checked={isIndeterminate ? 'indeterminate' : isAllLoadedSelected}
        className="h-4 w-4 pointer-events-none"
        aria-hidden="true"
      />
      Select all
    </button>
  );
}
