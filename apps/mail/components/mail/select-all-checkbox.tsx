import { Checkbox } from '@/components/ui/checkbox';
import { useMail } from '@/components/mail/use-mail';
import { useThreads } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { trpcClient } from '@/providers/query-provider';
import useSearchLabels from '@/hooks/use-labels-search';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

export default function SelectAllCheckbox({ className }: { className?: string }) {
  const [mail, setMail] = useMail();
  const [, loadedThreads] = useThreads();
  const [{ value: query }] = useSearchValue();
  const { labels } = useSearchLabels();
  const { folder = 'inbox' } = useParams<{ folder: string }>() ?? {};

  const [isFetchingIds, setIsFetchingIds] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ fetched: 0, total: 0 });
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
    const MAX_PER_PAGE = 1000;

    setFetchProgress({ fetched: 0, total: 0 });

    try {
      while (true) {
        const page = await trpcClient.mail.listThreads.query({
          folder,
          q: query,
          max: MAX_PER_PAGE,
          cursor,
          labelIds: labels,
        });
        if (page?.threads?.length) {
          ids.push(...page.threads.map((t: { id: string }) => t.id));
          setFetchProgress(prev => ({ ...prev, fetched: ids.length }));
        }
        if (!page?.nextPageToken) break;
        cursor = page.nextPageToken;
      }
    } catch (err: any) {
      console.error('Failed to fetch all thread IDs', err);
      toast.error(err?.message ?? 'Failed to select all emails');
    }

    return ids;
  }, [folder, query, labels]);

  const handleToggle = useCallback(async () => {
    if (isFetchingIds) return;

    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
      return;
    }

    setMail((prev) => ({ ...prev, bulkSelected: loadedIds }));
    
    setIsFetchingIds(true);
    const allIds = await fetchAllMatchingThreadIds();
    setIsFetchingIds(false);
    toast(
      `${loadedIds.length} conversation${loadedIds.length !== 1 ? 's' : ''} on this page selected.`,
      {
        action: {
          label: `Select all ${allIds.length} conversation${allIds.length !== 1 ? 's' : ''}`,
          onClick: () => setMail((prev) => ({ ...prev, bulkSelected: allIds })),
        },
        className: '!w-auto whitespace-nowrap',
      },
    );
  }, [mail.bulkSelected.length, loadedIds, fetchAllMatchingThreadIds, isFetchingIds, setMail]);

  return (
    <span className={cn("inline-block", className)}>
      {isFetchingIds ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-4 w-4 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-sm bg-muted-foreground/10 animate-pulse" />
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground relative z-10" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {fetchProgress.fetched > 0 
              ? `Loading emails... (${fetchProgress.fetched} found)`
              : 'Loading emails...'
            }
          </TooltipContent>
        </Tooltip>
      ) : (
        <Checkbox
          ref={checkboxRef}
          disabled={isFetchingIds}
          checked={isIndeterminate ? 'indeterminate' : isAllLoadedSelected}
          onCheckedChange={handleToggle}
          className="h-4 w-4 transition-all duration-200 hover:scale-105"
        />
      )}
    </span>
  );
}