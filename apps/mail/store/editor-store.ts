import type { ThemeEditorState } from '@zero/mail/types/editor';
import type { ThemeStyles } from '@/types/theme';
import { persist } from 'zustand/middleware';
import { create } from 'zustand';

import { useThemePresetStore } from './theme-preset-store';
import { defaultThemeState } from '@/config/theme';
import { isDeepEqual } from '@/lib/utils';

export function getPresetThemeStyles(name: string): ThemeStyles {
  const defaultTheme = defaultThemeState.styles;
  if (name === 'default') {
    return defaultTheme;
  }

  const store = useThemePresetStore.getState();
  const preset = store.getPreset(name);
  if (!preset) {
    return defaultTheme;
  }

  return {
    light: {
      ...defaultTheme.light,
      ...(preset.styles.light || {}),
    },
    dark: {
      ...defaultTheme.dark,
      ...(preset.styles.light || {}),
      ...(preset.styles.dark || {}),
    },
  };
}

interface EditorStore {
  themeState: ThemeEditorState;
  themeCheckpoint: ThemeEditorState | null;
  setThemeState: (state: ThemeEditorState) => void;
  applyThemePreset: (preset: string) => void;
  saveThemeCheckpoint: () => void;
  restoreThemeCheckpoint: () => void;
  hasThemeChangedFromCheckpoint: () => boolean;
  hasUnsavedChanges: () => boolean;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      themeState: defaultThemeState,
      themeCheckpoint: null,
      setThemeState: (state: ThemeEditorState) => {
        const currentState = get().themeState;
        if (!isDeepEqual(currentState.styles, state.styles) || 
            currentState.currentMode !== state.currentMode || 
            currentState.preset !== state.preset) {
          set({ themeState: state });
        }
      },
      applyThemePreset: (preset: string) => {
        const themeState = get().themeState;
        const newStyles = getPresetThemeStyles(preset);
        const newThemeState: ThemeEditorState = {
          ...themeState,
          preset,
          styles: newStyles,
        };
        const updates: Partial<EditorStore> & { themeState: ThemeEditorState } = {
          themeState: newThemeState,
          themeCheckpoint: newThemeState,
        };
        set(updates);
      },
      saveThemeCheckpoint: () => {
        set({ themeCheckpoint: get().themeState });
      },
      restoreThemeCheckpoint: () => {
        const checkpoint = get().themeCheckpoint;
        if (checkpoint) {
          set({
            themeState: {
              ...checkpoint,
              currentMode: get().themeState.currentMode,
            },
          });
        } else {
          console.warn('No theme checkpoint available to restore to.');
        }
      },
      hasThemeChangedFromCheckpoint: () => {
        const checkpoint = get().themeCheckpoint;
        return !isDeepEqual(get().themeState, checkpoint);
      },
      hasUnsavedChanges: () => {
        const themeState = get().themeState;
        const presetThemeStyles = getPresetThemeStyles(themeState.preset ?? 'default');
        return !isDeepEqual(themeState.styles, presetThemeStyles);
      },
    }),
    {
      name: 'editor-storage',
    },
  ),
);
