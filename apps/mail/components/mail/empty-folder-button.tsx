import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/providers/query-provider';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { useSearchValue } from '@/hooks/use-search-value';
import ConfirmationDialog from '../ui/confirmation-dialog';
import { Trash2 } from 'lucide-react';

interface Props {
  folder: string;
}

interface ListThreadsParams {
  folder: string;
  q: string;
  maxResults: number;
  cursor: string;
}

// A small utility component to permanently delete all emails in the currently opened folder (spam / bin)
export default function EmptyFolderButton({ folder }: Props) {
  const { optimisticDeleteThreads, optimisticMoveThreadsTo } = useOptimisticActions();
  const [searchValue] = useSearchValue();

  const handleEmptyFolder = useCallback(async () => {
    // Add input validation and rate limiting
    if (!['spam', 'bin'].includes(folder)) {
      toast.error('Invalid folder. Only spam and bin folders can be emptied.');
      return;
    }

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
            maxResults: MAX_PER_PAGE,
            cursor,
          });
          
          if (page?.threads?.length) {
            page.threads.forEach((t: { id: string }) => ids.add(t.id));
          }
          if (!page?.nextPageToken) break;
          cursor = page.nextPageToken;
        } catch (error) {
          console.error('Failed to fetch emails from server', error);
          if (ids.size === 0) {
            // Complete failure - no emails fetched at all
            toast.error('Failed to connect to server. Please try again.');
            return;
          } else {
            // Partial failure - some emails were fetched
            toast.error(`Failed to load all emails. ${ids.size} emails will be processed, but some may remain.`);
          }
          break;
        }
      }

      if (!ids.size) {
        toast.success('Folder already empty');
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
    }
  }, [folder, optimisticDeleteThreads, optimisticMoveThreadsTo, searchValue.value]);

  const confirmText =
    folder === 'spam'
      ? 'This will delete all emails in the Spam folder and move them to Bin. Continue?'
      : 'This will permanently delete all emails in the Bin folder. Continue?';
  const title = folder === 'spam' ? 'Empty Spam?' : 'Empty Bin?';

  return (
    <ConfirmationDialog
      title={title}
      description={confirmText}
      onConfirm={handleEmptyFolder}
      trigger={
        <Button
          size="sm"
          variant="destructive"
          className="h-8 px-3 text-xs font-medium"
        >
          {folder === 'spam' ? 'Empty Spam' : 'Empty Bin'}
        </Button>
      }
    />
  );
} 