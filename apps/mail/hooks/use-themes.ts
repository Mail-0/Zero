'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { 
  createTheme as createThemeAction,
  updateTheme as updateThemeAction,
  deleteTheme as deleteThemeAction,
  getUserThemes as getUserThemesAction,
  getPublicThemes as getPublicThemesAction,
  getThemeById as getThemeByIdAction,
  getConnectionTheme as getConnectionThemeAction,
  copyPublicTheme as copyPublicThemeAction,
  createDefaultThemes as createDefaultThemesAction,
  createPresetThemes as createPresetThemesAction,
  applyThemeToConnection as applyThemeToConnectionAction,
} from '@/actions/themes';
import { ThemeSettings } from '@zero/db/schema';
import { useSWRConfig } from 'swr';

export function useUserThemes() {
  const { data, error, isLoading, mutate } = useSWR('user-themes', getUserThemesAction);

  return {
    themes: data?.themes || [],
    isLoading,
    error,
    mutate,
  };
}

export function usePublicThemes() {
  const { data, error, isLoading, mutate } = useSWR('public-themes', getPublicThemesAction);

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
    () => getThemeByIdAction(id)
  );

  const update = useCallback(
    async (updateData: {
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await updateThemeAction({
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
    const result = await deleteThemeAction(id);
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
    () => getConnectionThemeAction(connectionId)
  );

  return {
    theme: data?.theme,
    isLoading,
    error,
    mutate,
  };
}

export function useThemeActions() {
  const { mutate: mutateSWR } = useSWRConfig();
  const { mutate: mutateUserThemes } = useUserThemes();
  const { mutate: mutatePublicThemes } = usePublicThemes();

  const create = useCallback(
    async (themeData: {
      name: string;
      connectionId?: string;
      settings: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await createThemeAction(themeData);
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
    async (themeData: {
      id: string;
      name?: string;
      connectionId?: string | null;
      settings?: ThemeSettings;
      isPublic?: boolean;
    }) => {
      const result = await updateThemeAction(themeData);
      if (result.success) {
        mutateUserThemes();
        mutateSWR(`theme-${themeData.id}`);
        if (themeData.connectionId) {
          mutateSWR(`connection-theme-${themeData.connectionId}`);
        }
      }
      return result;
    },
    [mutateUserThemes, mutateSWR]
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await deleteThemeAction(id);
      if (result.success) {
        mutateUserThemes();
        mutateSWR(`theme-${id}`, undefined, { revalidate: false });
      }
      return result;
    },
    [mutateUserThemes, mutateSWR]
  );

  const copy = useCallback(
    async (id: string) => {
      const result = await copyPublicThemeAction(id);
      if (result.success) {
        mutateUserThemes();
      }
      return result;
    },
    [mutateUserThemes]
  );

  const initializeDefaults = useCallback(async () => {
    const result = await createDefaultThemesAction();
    if (result.success) {
      mutateUserThemes();
    }
    return result;
  }, [mutateUserThemes]);

  const addPresetThemes = useCallback(async () => {
    const result = await createPresetThemesAction();
    if (result.success) {
      mutateUserThemes();
    }
    return result;
  }, [mutateUserThemes]);

  const applyToConnection = useCallback(async (themeId: string, targetConnectionId?: string) => {
    const result = await applyThemeToConnectionAction(themeId, targetConnectionId);
    if (result.success) {
      mutateUserThemes();
      if (result.connectionId) {
        mutateSWR(`connection-theme-${result.connectionId}`);
      }
    }
    return result;
  }, [mutateUserThemes, mutateSWR]);

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
