'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { useTRPCClient } from '@/providers/query-provider';
import type { ThemeSettings } from '@zero/db/schema';
import { useSWRConfig } from 'swr';

export function useUserThemes() {
  const client = useTRPCClient();
  const { data, error, isLoading, mutate } = useSWR(
    'user-themes', 
    () => client.themes.getUserThemes.query()
  );

  return {
    themes: data?.themes || [],
    isLoading,
    error,
    mutate,
  };
}

export function usePublicThemes() {
  const client = useTRPCClient();
  const { data, error, isLoading, mutate } = useSWR(
    'public-themes', 
    () => client.themes.getPublicThemes.query()
  );

  return {
    themes: data?.themes || [],
    isLoading,
    error,
    mutate,
  };
}

export function useTheme(id: string | null | undefined) {
  const client = useTRPCClient();
  const { data, error, isLoading, mutate } = useSWR(
    id ? `theme-${id}` : null,
    () => id ? client.themes.getById.query(id) : null
  );

  const update = useCallback(
    async (updateData: {
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => {
      if (!id) throw new Error("Theme ID is required for update.");
      const result = await client.themes.update.mutate({
        id,
        ...updateData,
      });
      if (result.success) {
        mutate();
      }
      return result;
    },
    [id, mutate, client]
  );

  const remove = useCallback(async () => {
    if (!id) throw new Error("Theme ID is required for delete.");
    const result = await client.themes.delete.mutate(id);
    if (result.success) {
      mutate(undefined); 
    }
    return result;
  }, [id, mutate, client]);

  return {
    theme: data?.theme,
    isLoading,
    error,
    update,
    remove,
    mutate,
  };
}

export function useConnectionTheme(connectionId: string | null | undefined) {
  const client = useTRPCClient();
  const { data, error, isLoading, mutate } = useSWR(
    connectionId ? `connection-theme-${connectionId}` : null,
    () => connectionId ? client.themes.getConnectionTheme.query(connectionId) : null,
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      dedupingInterval: 5000, 
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 3000);
      }
    }
  );

  return {
    theme: data?.success ? data.theme : null,
    isLoading,
    error,
    mutate,
  };
}

export function useThemeActions() {
  const client = useTRPCClient();
  const { mutate: mutateSWR } = useSWRConfig();
  
  const revalidateUserThemes = () => mutateSWR('user-themes');
  const revalidatePublicThemes = () => mutateSWR('public-themes');

  const create = useCallback(
    async (themeData: {
      name: string;
      connectionId?: string;
      settings: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await client.themes.create.mutate(themeData);
      if (result.success) {
        revalidateUserThemes();
        if (themeData.isPublic) {
          revalidatePublicThemes();
        }
      }
      return result;
    },
    [client, revalidateUserThemes, revalidatePublicThemes]
  );

  const update = useCallback(
    async (themeData: {
      id: string;
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await client.themes.update.mutate(themeData);
      if (result.success) {
        revalidateUserThemes();
        mutateSWR(`theme-${themeData.id}`);
        if (themeData.connectionId) {
          mutateSWR(`connection-theme-${themeData.connectionId}`);
        }
      }
      return result;
    },
    [client, revalidateUserThemes, mutateSWR]
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await client.themes.delete.mutate(id);
      if (result.success) {
        revalidateUserThemes();
        mutateSWR(`theme-${id}`, undefined, { revalidate: false });
      }
      return result;
    },
    [client, revalidateUserThemes, mutateSWR]
  );

  const copy = useCallback(
    async (id: string) => {
      const result = await client.themes.copyPublicTheme.mutate(id);
      if (result.success) {
        revalidateUserThemes();
      }
      return result;
    },
    [client, revalidateUserThemes]
  );

  const initializeDefaults = useCallback(async () => {
    const result = await client.themes.createDefaultThemes.mutate();
    if (result.success) {
      revalidateUserThemes();
    }
    return result;
  }, [client, revalidateUserThemes]);

  const addPresetThemes = useCallback(async () => {
    const result = await client.themes.createPresetThemes.mutate();
    if (result.success) {
      revalidateUserThemes();
    }
    return result;
  }, [client, revalidateUserThemes]);

  const applyToConnection = useCallback(async (themeId: string, targetConnectionId?: string) => {
    const result = await client.themes.applyThemeToConnection.mutate({ themeId, connectionId: targetConnectionId });
    if (result.success) {
      revalidateUserThemes();
      const castResult = result as unknown as { success: boolean; connectionId?: string | null; theme?: any }; 
      if (castResult.connectionId) {
        mutateSWR(`connection-theme-${castResult.connectionId}`);
      }
    }
    return result;
  }, [client, revalidateUserThemes, mutateSWR]);

  return {
    create,
    update,
    remove,
    copy,
    initializeDefaults,
    addPresetThemes,
    applyToConnection,
  };
} 
 