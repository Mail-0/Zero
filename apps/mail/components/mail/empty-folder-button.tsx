import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/providers/query-provider';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { useSearchValue } from '@/hooks/use-search-value';

interface Props {
  folder: string;
}

interface ListThreadsParams {
  folder: string;
  q: string;
  max: number;
  cursor: string;
}

// A small utility component to permanently delete all emails in the currently opened folder (spam / bin)
export default function EmptyFolderButton({ folder }: Props) {
  const { optimisticDeleteThreads, optimisticMoveThreadsTo } = useOptimisticActions();
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue] = useSearchValue();

  const handleEmptyFolder = useCallback(async () => {
    // Add input validation and rate limiting
    if (isLoading) return;
    if (!['spam', 'bin'].includes(folder)) {
      toast.error('Invalid folder. Only spam and bin folders can be emptied.');
      return;
    }

    const confirmText =
      folder === 'spam'
        ? 'This will delete all emails in the Spam folder and move them to Bin. Continue?'
        : 'This will permanently delete all emails in the Bin folder. Continue?';

    if (!window.confirm(confirmText)) return;

    setIsLoading(true);
    try {
      const ids = new Set<string>();
      let cursor = '';
      const MAX_PER_PAGE = 100;
      const MAX_PAGES = 1000; // Safety limit
      let pageCount = 0;

      while (true) {
        // Add safety mechanism for pagination loop
        if (++pageCount > MAX_PAGES) {
          console.warn('Maximum page limit reached, stopping pagination');
          break;
        }

        // Fetch mails in pages of 100 until there is no nextPageToken
        try {
          const page = await trpcClient.mail.listThreads.query({
            folder,
            q: searchValue.value,
            max: MAX_PER_PAGE,
            cursor,
          } satisfies ListThreadsParams);
          
          if (page?.threads?.length) {
            page.threads.forEach((t: { id: string }) => ids.add(t.id));
          }
          if (!page?.nextPageToken) break;
          cursor = page.nextPageToken;
        } catch (error) {
          console.error('Pagination failed', error);
          break;
        }
      }

      if (!ids.size) {
        toast.success('Folder already empty');
        setIsLoading(false);
        return;
      }

      const idsArray = Array.from(ids);
      if (folder === 'spam') {
        // Move all spam to bin
        optimisticMoveThreadsTo(idsArray, folder, 'bin');
      } else {
        // Permanently delete everything from bin
        optimisticDeleteThreads(idsArray, folder);
      }
    } catch (error: unknown) {
      console.error('Failed to empty folder', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to empty folder';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [folder, isLoading, optimisticDeleteThreads, optimisticMoveThreadsTo, searchValue.value]);

  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={isLoading}
      onClick={handleEmptyFolder}
      className="px-4 flex items-center justify-center"
    >
      {folder === 'spam' ? 'Empty Spam' : 'Empty Bin'}
    </Button>
  );
} 