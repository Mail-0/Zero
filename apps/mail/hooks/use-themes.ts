'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTRPCClient } from '@/providers/query-provider';
import type { ThemeSettings } from '@zero/db/schema';

export function useUserThemes() {
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: ['user-themes'],
    queryFn: () => client.themes.getUserThemes.query(),
  });

  return {
    themes: data?.themes || [],
    isLoading,
    error,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['user-themes'] }),
  };
}

export function usePublicThemes() {
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: ['public-themes'],
    queryFn: () => client.themes.getPublicThemes.query(),
  });

  return {
    themes: data?.themes || [],
    isLoading,
    error,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['public-themes'] }),
  };
}

export function useTheme(id: string | null | undefined) {
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const queryKey = ['theme', id];

  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () => (id ? client.themes.getById.query(id) : Promise.resolve(null)),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updateData: {
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => {
      if (!id) throw new Error('Theme ID is required for update.');
      return client.themes.update.mutate({ id, ...updateData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
      // Potentially invalidate public themes if isPublic changes
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Theme ID is required for delete.');
      return client.themes.delete.mutate(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
      // Potentially invalidate public themes if it was public
      // And remove from cache
      queryClient.removeQueries({ queryKey });
    },
  });

  return {
    theme: data?.theme,
    isLoading,
    error,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}

export function useConnectionTheme(connectionId: string | null | undefined) {
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const queryKey = ['connection-theme', connectionId];

  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      connectionId
        ? client.themes.getConnectionTheme.query(connectionId)
        : Promise.resolve(null),
    enabled: !!connectionId,
    retry: (failureCount, err: any) => {
        if (err?.data?.code === 'NOT_FOUND') return false; // Don't retry if theme not found for connection
        return failureCount < 3;
    },
    retryDelay: 3000,
    refetchOnWindowFocus: false,
  });

  // Memoize the invalidate function using connectionId in the dependency array for stability
  const invalidate = useCallback(() => {
    // Reconstruct queryKey here or use the one from the outer scope if its stability is ensured.
    // For safety, using connectionId directly to form the key ensures this callback only changes when connectionId changes.
    queryClient.invalidateQueries({ queryKey: ['connection-theme', connectionId] });
  }, [queryClient, connectionId]);

  return {
    theme: data?.success ? data.theme : null,
    isLoading,
    error,
    invalidate, // Return the memoized function
  };
}

export function useThemeActions() {
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (themeData: {
      name: string;
      connectionId?: string;
      settings: ThemeSettings;
      isPublic?: boolean;
    }) => client.themes.create.mutate(themeData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
      if (variables.isPublic) {
        queryClient.invalidateQueries({ queryKey: ['public-themes'] });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (themeData: {
      id: string;
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => client.themes.update.mutate(themeData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
      queryClient.invalidateQueries({ queryKey: ['theme', variables.id] });
      if (variables.connectionId) {
        queryClient.invalidateQueries({ queryKey: ['connection-theme', variables.connectionId] });
      }
      // If isPublic status changes, invalidate public themes
      // This requires knowing the previous state or refetching based on variables.isPublic
      if (variables.isPublic !== undefined) {
         queryClient.invalidateQueries({ queryKey: ['public-themes'] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.themes.delete.mutate(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
      queryClient.removeQueries({ queryKey: ['theme', id] });
      // If it was a public theme, consider invalidating public-themes
      // This requires knowing if the deleted theme was public.
    },
  });

  const copyMutation = useMutation({
    mutationFn: (id: string) => client.themes.copyPublicTheme.mutate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
    },
  });

  const initializeDefaultsMutation = useMutation({
    mutationFn: () => client.themes.createDefaultThemes.mutate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
    },
  });
  
  const addPresetThemesMutation = useMutation({
    mutationFn: () => client.themes.createPresetThemes.mutate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
    },
  });

  const applyToConnectionMutation = useMutation({
    mutationFn: (data: { themeId: string; targetConnectionId?: string }) =>
      client.themes.applyThemeToConnection.mutate({ themeId: data.themeId, connectionId: data.targetConnectionId }),
    onSuccess: (result: any) => { // Cast to any to access potential connectionId for now
      queryClient.invalidateQueries({ queryKey: ['user-themes'] });
      if (result?.success && result?.connectionId) {
        queryClient.invalidateQueries({ queryKey: ['connection-theme', result.connectionId] });
      }
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    copy: copyMutation.mutateAsync,
    initializeDefaults: initializeDefaultsMutation.mutateAsync,
    addPresetThemes: addPresetThemesMutation.mutateAsync,
    applyToConnection: applyToConnectionMutation.mutateAsync,
  };
} 
 