import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ColorFormat } from "@/types";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

interface PreferencesStore {
  tailwindVersion: "3" | "4";
  colorFormat: ColorFormat;
  packageManager: PackageManager;
  setTailwindVersion: (version: "3" | "4") => void;
  setColorFormat: (format: ColorFormat) => void;
  setPackageManager: (pm: PackageManager) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      tailwindVersion: "4",
      colorFormat: "oklch",
      packageManager: "pnpm",
      setTailwindVersion: (version: "3" | "4") => {
        set({ tailwindVersion: version });
      },
      setColorFormat: (format: ColorFormat) => {
        set({ colorFormat: format });
      },
      setPackageManager: (pm: PackageManager) => {
        set({ packageManager: pm });
      },
    }),
    {
      name: "preferences-storage", // unique name for localStorage
    }
  )
); 