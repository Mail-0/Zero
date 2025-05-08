'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useSession } from '@/lib/auth-client';
import { useConnectionTheme } from '@/hooks/use-themes';
import { ThemeSettings } from '@zero/db/schema';
import { defaultThemeSettings } from '@zero/db/theme_settings_default';
import { useTheme as useNextTheme } from 'next-themes';
import { colord, extend, HslColor } from 'colord';

interface CustomThemeContextProps {
  themeSettings: ThemeSettings;
  isLoading: boolean;
  applyThemeSettings: (settings: ThemeSettings) => void;
}

const CustomThemeContext = createContext<CustomThemeContextProps | undefined>(
  undefined
);

export function useCustomTheme() {
  const context = useContext(CustomThemeContext);
  if (!context) {
    throw new Error('useCustomTheme must be used within a CustomThemeProvider');
  }
  return context;
}

const LOCAL_STORAGE_KEY_PREFIX = 'customTheme-';

// Helper to convert color to HSL string format required by Tailwind CSS variables
function toHslString(colorValue: string | undefined): string {
  if (!colorValue) return '0 0% 0%'; // Default to black if undefined
  try {
    const hsl: HslColor = colord(colorValue).toHsl();
    // Return CSS variable format: H S% L%
    return `${hsl.h.toFixed(0)} ${hsl.s.toFixed(0)}% ${hsl.l.toFixed(0)}%`;
  } catch (e) {
    console.error(`Failed to parse color or call .toHsl(): ${colorValue}`, e);
    return '0 0% 0%'; // Default on error
  }
}

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const connectionId = session?.connectionId;
  const { theme: dbTheme, isLoading: isLoadingDbTheme, mutate: mutateConnectionTheme } = useConnectionTheme(connectionId || '');
  const { resolvedTheme: systemThemeMode } = useNextTheme(); // 'light' or 'dark'

  const [appliedSettings, setAppliedSettings] = useState<ThemeSettings | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const currentThemeSettings = useMemo(() => {
    return appliedSettings || defaultThemeSettings;
  }, [appliedSettings]);

  // 1. Initialize from localStorage or DB on connection change
  useEffect(() => {
    if (connectionId) {
      const cacheKey = `${LOCAL_STORAGE_KEY_PREFIX}${connectionId}`;
      try {
        const cachedSettings = localStorage.getItem(cacheKey);
        if (cachedSettings) {
          console.log('Applying theme from localStorage for connection:', connectionId);
          setAppliedSettings(JSON.parse(cachedSettings));
          setIsInitialized(true);
          // Optionally revalidate in background
          mutateConnectionTheme(); 
        } else if (dbTheme) {
          console.log('Applying theme from DB fetch for connection:', connectionId);
          setAppliedSettings(dbTheme.settings);
          localStorage.setItem(cacheKey, JSON.stringify(dbTheme.settings));
          setIsInitialized(true);
        } else if (!isLoadingDbTheme) {
          // No theme in cache or DB, use default
          console.log('No theme found, applying default for connection:', connectionId);
          setAppliedSettings(defaultThemeSettings);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Error handling theme initialization:', error);
        setAppliedSettings(defaultThemeSettings); // Fallback on error
        setIsInitialized(true);
      }
    } else {
      // No active connection, apply default settings
      setAppliedSettings(defaultThemeSettings);
      setIsInitialized(true);
    }
  }, [connectionId, dbTheme, isLoadingDbTheme, mutateConnectionTheme]);

  // 2. Apply theme settings to CSS variables when they change
  useEffect(() => {
    if (!appliedSettings || typeof window === 'undefined') return;

    console.log('Updating CSS variables with new theme settings');
    const root = document.documentElement;
    const settings = appliedSettings;

    // --- Apply Colors --- 
    // Update the core ShadCN/Tailwind CSS variables
    root.style.setProperty('--background', toHslString(settings.colors.background));
    root.style.setProperty('--foreground', toHslString(settings.colors.foreground));
    root.style.setProperty('--primary', toHslString(settings.colors.primary));
    // Assuming primary-foreground is derived or a fixed contrast color for now
    // root.style.setProperty('--primary-foreground', toHslString(calculateContrastColor(settings.colors.primary)));
    root.style.setProperty('--secondary', toHslString(settings.colors.secondary));
    root.style.setProperty('--accent', toHslString(settings.colors.accent));
    root.style.setProperty('--muted', toHslString(settings.colors.muted));
    root.style.setProperty('--border', toHslString(settings.colors.border));
    // Need to handle card, popover, destructive etc. - map them or use primary/secondary/muted?
    // For simplicity, let's map card/popover to background/muted initially
    root.style.setProperty('--card', toHslString(settings.colors.background)); // Or settings.colors.muted?
    root.style.setProperty('--popover', toHslString(settings.colors.background)); // Or settings.colors.muted?
    root.style.setProperty('--card-foreground', toHslString(settings.colors.foreground));
    root.style.setProperty('--popover-foreground', toHslString(settings.colors.foreground));

    // --- Apply Corner Radius --- 
    root.style.setProperty('--radius', `${settings.cornerRadius}px`);

    // --- Apply Fonts --- 
    // Tailwind primarily uses utility classes for fonts (e.g., font-sans, text-lg, font-bold).
    // Directly setting --font-family-sans might work if Tailwind picks it up.
    // A more robust way might involve dynamically adding a class to the body or using inline styles
    // where needed, but let's try the variable first.
    root.style.setProperty('--font-family-sans', settings.fonts.family);
    // We won't override base font size/weight via CSS vars as it conflicts easily with Tailwind utils.
    // Components needing specific themed font styles might need inline styles.

    // --- Apply Background --- 
    // Clear previous background styles first
    document.body.style.background = '';
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';

    if (settings.background.type === 'color') {
      // Let the --background CSS variable handle this via Tailwind's bg-background class
      // document.body.style.backgroundColor = settings.background.value;
    } else if (settings.background.type === 'gradient') {
      document.body.style.background = settings.background.value;
    } else if (settings.background.type === 'image') {
      document.body.style.backgroundImage = `url(${settings.background.value})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    }

    // --- Apply Shadows (Complex) --- 
    // Tailwind uses utility classes (shadow-sm, shadow-md, etc.). Overriding these
    // via CSS variables is not standard. Components needing custom shadows might
    // need inline styles: `style={{ boxShadow: \`0 0 ${settings.shadows.intensity}px ${settings.shadows.color}\` }}`
    // We could set a general --shadow-color variable if useful elsewhere.
    // root.style.setProperty('--shadow-color', settings.shadows.color);

    // --- Apply Spacing (Complex) --- 
    // Similar to shadows, Tailwind uses utility classes (p-4, m-2). Overriding base
    // spacing globally via CSS vars is difficult. The settings are likely for component-level use.

  }, [appliedSettings]);

  // Function to manually apply settings (e.g., after creating/editing)
  const applyThemeSettings = (settings: ThemeSettings) => {
    console.log('Manually applying theme settings and caching');
    setAppliedSettings(settings);
    if (connectionId) {
      const cacheKey = `${LOCAL_STORAGE_KEY_PREFIX}${connectionId}`;
      localStorage.setItem(cacheKey, JSON.stringify(settings));
    }
  };

  const value = useMemo(() => ({
    themeSettings: currentThemeSettings,
    isLoading: !isInitialized,
    applyThemeSettings,
  }), [currentThemeSettings, isInitialized, applyThemeSettings]);

  return (
    <CustomThemeContext.Provider value={value}>
      {children}
    </CustomThemeContext.Provider>
  );
} 