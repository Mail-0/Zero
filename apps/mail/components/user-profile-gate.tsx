import { useTRPC } from '@/providers/query-provider';
import { useSession } from '@/lib/auth-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

export function UserProfileGate() {
  const { data: session, isPending: sessionPending } = useSession();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const location = useLocation();

  const profileCheck = useQuery(
    trpc.user.hasProfile.queryOptions(undefined, {
      enabled: !!session?.user?.id,
      staleTime: 0,
    }),
  );

  useEffect(() => {
    if (sessionPending || profileCheck.isLoading || !session?.user) {
      return;
    }

    if (profileCheck.data?.exists === false) {
      const returnPath = `${location.pathname}${location.search}`;
      navigate(`/settings/user-information?from=${encodeURIComponent(returnPath)}`, {
        replace: true,
      });
    }
  }, [
    sessionPending,
    profileCheck.isLoading,
    profileCheck.data?.exists,
    session?.user,
    navigate,
    location.pathname,
    location.search,
  ]);

  return null;
}
