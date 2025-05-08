'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { 
  createTheme,
  updateTheme,
  deleteTheme,
  getUserThemes,
  getPublicThemes,
  getThemeById,
  getConnectionTheme,
  copyPublicTheme,
  createDefaultThemes,
  applyThemeToConnection,
} from '@/actions/themes';
import { ThemeSettings } from '@zero/db/schema';

export function useUserThemes() {
  const { data, error, isLoading, mutate } = useSWR('user-themes', getUserThemes);

  return {
    themes: data?.themes || [],
    isLoading,
    error,
    mutate,
  };
}

export function usePublicThemes() {
  const { data, error, isLoading, mutate } = useSWR('public-themes', getPublicThemes);

  return {
    themes: data?.themes || [],
    isLoading,
    error,
    mutate,
  };
}

export function useTheme(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `theme-${id}` : null,
    () => getThemeById(id)
  );

  const update = useCallback(
    async (updateData: {
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await updateTheme({
        id,
        ...updateData,
      });
      if (result.success) {
        mutate();
      }
      return result;
    },
    [id, mutate]
  );

  const remove = useCallback(async () => {
    const result = await deleteTheme(id);
    if (result.success) {
      mutate(undefined);
    }
    return result;
  }, [id, mutate]);

  return {
    theme: data?.theme,
    isLoading,
    error,
    update,
    remove,
    mutate,
  };
}

export function useConnectionTheme(connectionId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    connectionId ? `connection-theme-${connectionId}` : null,
    () => getConnectionTheme(connectionId)
  );

  return {
    theme: data?.theme,
    isLoading,
    error,
    mutate,
  };
}

export function useThemeActions() {
  const { mutate: mutateUserThemes } = useUserThemes();
  const { mutate: mutatePublicThemes } = usePublicThemes();

  const create = useCallback(
    async (themeData: {
      name: string;
      connectionId?: string;
      settings: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await createTheme(themeData);
      if (result.success) {
        mutateUserThemes();
        if (themeData.isPublic) {
          mutatePublicThemes();
        }
      }
      return result;
    },
    [mutateUserThemes, mutatePublicThemes]
  );

  const update = useCallback(
    async (updateData: {
      id: string;
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await updateTheme(updateData);
      if (result.success) {
        mutateUserThemes();
        if (updateData.isPublic) {
          mutatePublicThemes();
        }
      }
      return result;
    },
    [mutateUserThemes, mutatePublicThemes]
  );

  const copy = useCallback(
    async (id: string) => {
      const result = await copyPublicTheme(id);
      if (result.success) {
        mutateUserThemes();
      }
      return result;
    },
    [mutateUserThemes]
  );

  const initializeDefaults = useCallback(async () => {
    const result = await createDefaultThemes();
    if (result.success) {
      mutateUserThemes();
    }
    return result;
  }, [mutateUserThemes]);

  const applyToConnection = useCallback(async (themeId: string, targetConnectionId?: string) => {
    const result = await applyThemeToConnection(themeId, targetConnectionId);
    if (result.success) {
      mutateUserThemes();
    }
    return result;
  }, [mutateUserThemes]);

  return {
    create,
    update,
    copy,
    initializeDefaults,
    applyToConnection,
  };
} 