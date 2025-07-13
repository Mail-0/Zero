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
  const [{ value: query }] = useSearchValue();
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
  }, [folder, query]);

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        ref={checkboxRef}
        disabled={isFetchingIds}
        checked={isIndeterminate ? 'indeterminate' : isAllLoadedSelected}
        onCheckedChange={handleToggle}
        className={cn('hidden', className)}
        id="select-all"
      />
      <label
        htmlFor="select-all"
        className={cn(
          'text-muted-foreground flex items-center gap-1 text-xs font-medium transition-colors',
          isIndeterminate && 'text-primary',
        )}
      >
        <span
          className={cn(
            'border-muted-foreground flex items-center justify-center rounded border p-0.5 transition-colors',
            {
              'border-primary bg-primary': isAllLoadedSelected,
            },
          )}
        >
          <Check
            className={cn('text-muted-foreground/30 h-2 w-2 transition-colors', {
              'text-black': isAllLoadedSelected,
            })}
          />
        </span>
        Select all
      </label>
    </div>
  );
}
