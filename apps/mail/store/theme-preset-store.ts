import { create } from "zustand";
import type { ThemePreset } from "@/types/theme";
import { defaultPresets } from "@/components/theme/utils/theme-presets";

interface ThemePresetStore {
  presets: Record<string, ThemePreset>;
  registerPreset: (name: string, preset: ThemePreset) => void;
  unregisterPreset: (name: string) => void;
  updatePreset: (name: string, preset: ThemePreset) => void;
  getPreset: (name: string) => ThemePreset | undefined;
  getAllPresets: () => Record<string, ThemePreset>;
  loadSavedPresets: (savedThemes: any[]) => void;
}

export const useThemePresetStore = create<ThemePresetStore>()((set, get) => ({
  presets: defaultPresets,
  registerPreset: (name: string, preset: ThemePreset) => {
    set((state) => ({
      presets: {
        ...state.presets,
        [name]: preset,
      },
    }));
  },
  unregisterPreset: (name: string) => {
    set((state) => {
      const { [name]: _, ...remainingPresets } = state.presets;
      return {
        presets: remainingPresets,
      };
    });
  },
  loadSavedPresets: (savedThemes: any[]) => {
    try {
      const savedPresets = savedThemes.reduce((acc: Record<string, ThemePreset>, theme) => {
        acc[theme.id] = {
          label: theme.name,
          styles: theme.styles,
          source: "SAVED",
        };
        return acc;
      }, {} as Record<string, ThemePreset>);

      set((state) => ({
        presets: {
          ...state.presets,
          ...savedPresets,
        },
      }));
    } catch (error) {
      console.error("Failed to load saved presets:", error);
    }
  },
  updatePreset: (name: string, preset: ThemePreset) => {
    set((state) => ({
      presets: {
        ...state.presets,
        [name]: preset,
      },
    }));
  },
  getPreset: (name: string) => {
    return get().presets[name];
  },
  getAllPresets: () => {
    return get().presets;
  },
}));
