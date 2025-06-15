import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';

export function useEmailAliases() {
  const trpc = useTRPC();
  const emailAliasesQuery = useQuery(
    trpc.mail.getEmailAliases.queryOptions(void 0, {
      initialData: [] as { email: string; name: string; primary?: boolean }[],
    }),
  );
  return emailAliasesQuery;
}
