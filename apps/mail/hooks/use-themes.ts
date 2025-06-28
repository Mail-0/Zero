import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveConnection } from './use-connections';
import { useTRPC } from '@/providers/query-provider';

// Hook to get user's themes
export const useThemes = () => {
  const trpc = useTRPC();
  return useQuery(trpc.themes.list.queryOptions());
};

// Hook to get public themes (marketplace)
export const usePublicThemes = () => {
  const trpc = useTRPC();
  return useQuery(trpc.themes.public.queryOptions());
};

// Hook to get a specific theme
export const useTheme = (themeId: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.themes.get.queryOptions({ themeId }));
};

// Hook to get connection's active theme
export const useConnectionTheme = (connectionId?: string) => {
  const trpc = useTRPC();
  const { data: activeConnection } = useActiveConnection();

  return useQuery(
    trpc.themes.getConnectionTheme.queryOptions({
      connectionId: connectionId || activeConnection?.id,
    }),
    {
      enabled: !!(connectionId || activeConnection?.id),
    },
  );
};

// Hook to create a theme
export const useCreateTheme = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.themes.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.themes.list.queryKey(),
      });
    },
  });
};

// Hook to update a theme
export const useUpdateTheme = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.themes.update.mutationOptions(),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.themes.list.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.themes.get.queryKey({ themeId: variables.themeId }),
      });
    },
  });
};

// Hook to delete a theme
export const useDeleteTheme = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.themes.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.themes.list.queryKey(),
      });
    },
  });
};

// Hook to copy a public theme
export const useCopyTheme = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.themes.copy.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.themes.list.queryKey(),
      });
    },
  });
};

// Hook to set theme for connection
export const useSetConnectionTheme = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.themes.setConnectionTheme.mutationOptions(),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.themes.getConnectionTheme.queryKey({
          connectionId: variables.connectionId,
        }),
      });
    },
  });
};

// Hook to remove theme from connection
export const useRemoveConnectionTheme = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.themes.removeConnectionTheme.mutationOptions(),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.themes.getConnectionTheme.queryKey({
          connectionId: variables.connectionId,
        }),
      });
    },
  });
};
