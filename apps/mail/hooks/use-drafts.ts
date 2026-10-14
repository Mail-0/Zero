import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';

/** Shared by the query and by intent prefetches, so a prefetched draft is reused as-is. */
export const DRAFT_STALE_MS = 1000 * 60 * 60;

export const useDraft = (id: string | null) => {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const draftQuery = useQuery(
    trpc.drafts.get.queryOptions(
      { id: id! },
      { enabled: !!session?.user.id && !!id, staleTime: DRAFT_STALE_MS },
    ),
  );
  return draftQuery;
};
