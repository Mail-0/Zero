import { useThemePresetStore } from '@/store/theme-preset-store';
import { tryCatch } from '@/components/theme/utils/try-catch';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { type ThemeStyles } from '@/types/theme';
import { useState, useCallback } from 'react';
import type { Theme } from '@/types/theme';
import { toast } from 'sonner';
import * as React from 'react';

type MutationState<T> = {
  isLoading: boolean;
  error: Error | null;
  data: T | null;
};

type ThemeMutationResult = {
  success: boolean;
  theme?: Theme;
  error?: string;
  details?: any;
};

const handleMutationError = (
  error: any,
  setError: (error: Error | null) => void,
  setIsAuthRequired: (value: boolean) => void,
) => {
  console.error('Mutation error:', error);

  if (error.message === 'Unauthorized') {
    setIsAuthRequired(true);
    toast.error('Authentication Required', {
      description: 'Please sign in to continue.',
    });
  } else {
    setError(error);
    toast.error('Operation Failed', {
      description: error.message || 'An unexpected error occurred.',
    });
  }
};

const handleMutationSuccess = (theme: Theme | undefined, operation: string) => {
  if (theme) {
    toast(`Theme ${operation}`, {
      description: `Theme "${theme.name}" ${operation.toLowerCase()} successfully.`,
    });
  }
};

export function useThemeActions() {
  const { registerPreset, updatePreset, unregisterPreset } = useThemePresetStore();
  const [isAuthRequired, setIsAuthRequired] = useState(false);

  const trpc = useTRPC();

  const [createState, setCreateState] = useState<MutationState<Theme>>({
    isLoading: false,
    error: null,
    data: null,
  });

  const [updateState, setUpdateState] = useState<MutationState<Theme>>({
    isLoading: false,
    error: null,
    data: null,
  });

  const [deleteState, setDeleteState] = useState<MutationState<boolean>>({
    isLoading: false,
    error: null,
    data: null,
  });

  const { mutateAsync: createThemeMutation } = useMutation(
    trpc.theme.createTheme.mutationOptions(),
  );

  // const { mutateAsync: deleteThemeMutation } = useMutation(
  //   trpc.theme.deleteTheme.mutationOptions()
  // );

  const executeMutation = async <T>(
    action: () => Promise<ThemeMutationResult>,
    setState: React.Dispatch<React.SetStateAction<MutationState<T>>>,
    successHandler: (result: ThemeMutationResult) => T | null,
  ) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    setIsAuthRequired(false);

    const [error, result] = await tryCatch(action());

    if (error) {
      handleMutationError(
        error,
        (err) => setState((prev) => ({ ...prev, error: err, isLoading: false })),
        setIsAuthRequired,
      );
      return null;
    }

    if (result.success) {
      const data = successHandler(result);
      setState((prev) => ({ ...prev, isLoading: false, data }));
      return data;
    } else {
      const error = new Error(result.error || 'Operation failed');
      setState((prev) => ({ ...prev, isLoading: false, error }));
      toast.error('Operation Failed', {
        description: result.error || 'Could not complete the operation.',
      });
      return null;
    }
  };

  const createTheme = useCallback(
    async (data: { name: string; styles: ThemeStyles }) => {
      return executeMutation<Theme>(
        async () => {
          try {
            const theme = await createThemeMutation(data);
            return { success: true, theme };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        },
        setCreateState,
        (result) => {
          if (result.theme) {
            const theme: Theme = result.theme;
            handleMutationSuccess(theme, 'Created');
            registerPreset(theme.id, {
              label: theme.name,
              source: 'SAVED',
              createdAt: theme.createdAt.toISOString(),
              styles: theme.styles,
            });
            return theme;
          }
          return null;
        },
      );
    },
    [createThemeMutation, registerPreset],
  );

  // const deleteTheme = useCallback(async (themeId: string) => {
  //   return executeMutation<boolean>(
  //     async () => {
  //       try {
  //         const result = await deleteThemeMutation({ id: themeId });
  //         return { success: true, theme: result };
  //       } catch (error) {
  //         return { success: false, error: (error as Error).message };
  //       }
  //     },
  //     setDeleteState,
  //     (result) => {
  //       if (result.success) {
  //         handleMutationSuccess(result.theme, "Deleted");
  //         unregisterPreset(themeId);
  //         toast.success("Theme Deleted Successfully");
  //         return true;
  //       }
  //       return false;
  //     }
  //   );
  // }, [deleteThemeMutation, unregisterPreset]);

  return {
    createTheme,
    // deleteTheme,
    isCreatingTheme: createState.isLoading,
    isUpdatingTheme: updateState.isLoading,
    isDeletingTheme: deleteState.isLoading,
    createError: createState.error,
    updateError: updateState.error,
    deleteError: deleteState.error,
    isMutating: createState.isLoading || updateState.isLoading || deleteState.isLoading,
    mutationError: createState.error || updateState.error || deleteState.error,
    isAuthRequired,
    setIsAuthRequired,
  };
}
