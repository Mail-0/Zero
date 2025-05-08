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

const GOOGLE_FONT_LINK_ID = 'custom-theme-google-font';

function loadGoogleFont(fontFamily: string | undefined, fontWeight: number | undefined) {
  if (typeof window === 'undefined' || !fontFamily) return;

  const existingLink = document.getElementById(GOOGLE_FONT_LINK_ID);
  if (existingLink) {
    existingLink.remove();
  }

  if (fontFamily === defaultThemeSettings.fonts.family || !fontFamily.trim()) {
    // Don't load if it's the default (e.g., 'Geist') or empty
    return;
  }

  // Load a common set of weights for better typographic flexibility
  const weightsToLoad = '300;400;500;700'; 
  const fontQuery = `${fontFamily.replace(/ /g, '+')}:wght@${weightsToLoad}`;
  const link = document.createElement('link');
  link.id = GOOGLE_FONT_LINK_ID;
  link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
  console.log('Loading Google Font:', fontFamily, fontWeight);
}

function removeGoogleFontLink() {
  if (typeof window === 'undefined') return;
  const existingLink = document.getElementById(GOOGLE_FONT_LINK_ID);
  if (existingLink) {
    existingLink.remove();
    console.log('Removed Google Font link.');
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

  // 2. Apply theme settings to CSS variables, respecting light/dark mode
  useEffect(() => {
    // Ensure execution only in the browser
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const customVars = [
      // Core Colors
      '--background', '--foreground', '--primary', '--primary-foreground', 
      '--secondary', '--secondary-foreground', '--accent', '--accent-foreground', 
      '--muted', '--muted-foreground', '--border', '--input', '--ring',
      // Component Colors
      '--card', '--card-foreground', '--popover', '--popover-foreground',
      '--destructive', '--destructive-foreground',
      // Radius
      '--radius',
      // Fonts (Attempted)
      '--font-family-sans' 
    ];

    const clearCustomStyles = () => {
      console.log('Clearing custom theme styles for dark mode or reset.');
      customVars.forEach(v => root.style.removeProperty(v));
      // Clear direct body styles
      document.body.style.fontFamily = '';
      document.body.style.fontSize = '';
      document.body.style.fontWeight = '';
      document.body.style.background = '';
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundRepeat = '';
      removeGoogleFontLink();
    };

    if (appliedSettings && appliedSettings !== defaultThemeSettings) {
      // Apply custom theme settings
      console.log('Applying custom theme settings');
      clearCustomStyles(); // Clear potential previous styles before applying new ones
      const settings = appliedSettings;

      // --- Apply Colors --- 
      root.style.setProperty('--background', toHslString(settings.colors.background));
      root.style.setProperty('--foreground', toHslString(settings.colors.foreground));
      
      root.style.setProperty('--card', toHslString(settings.colors.muted)); // Map card background to muted
      root.style.setProperty('--card-foreground', toHslString(settings.colors.foreground));
      
      root.style.setProperty('--popover', toHslString(settings.colors.muted)); // Map popover background to muted
      root.style.setProperty('--popover-foreground', toHslString(settings.colors.foreground));

      root.style.setProperty('--primary', toHslString(settings.colors.primary));
      // TODO: primary-foreground needs contrast calculation or a dedicated theme setting
      // root.style.setProperty('--primary-foreground', toHslString(settings.colors.primaryForeground || defaultLight.primaryForeground)); 
      
      root.style.setProperty('--secondary', toHslString(settings.colors.secondary));
      // TODO: secondary-foreground needs contrast calculation or dedicated setting

      root.style.setProperty('--muted', toHslString(settings.colors.muted));
      // TODO: muted-foreground needs contrast calculation or dedicated setting

      root.style.setProperty('--accent', toHslString(settings.colors.accent));
      // TODO: accent-foreground needs contrast calculation or dedicated setting

      // Destructive might not have a direct mapping, use default or add to settings
      // root.style.setProperty('--destructive', toHslString(settings.colors.destructive || defaultLight.destructive));
      // root.style.setProperty('--destructive-foreground', toHslString(settings.colors.destructiveForeground || defaultLight.destructiveForeground));

      root.style.setProperty('--border', toHslString(settings.colors.border));
      root.style.setProperty('--input', toHslString(settings.colors.border)); // Map input border to border
      root.style.setProperty('--ring', toHslString(settings.colors.primary)); // Map ring to primary

      // --- Apply Corner Radius --- 
      root.style.setProperty('--radius', `${settings.cornerRadius}px`);

      // --- Apply Fonts --- 
      // Attempt 1: Set CSS Variable (Tailwind *might* pick this up if configured)
       root.style.setProperty('--font-family-sans', settings.fonts.family);
      // Attempt 2: Directly style body (More reliable but less clean)
      // document.body.style.fontFamily = settings.fonts.family;
      loadGoogleFont(settings.fonts.family, settings.fonts.weight);
      document.body.style.fontSize = `${settings.fonts.size}px`;
      document.body.style.fontWeight = String(settings.fonts.weight);

      // --- Apply Background --- 
      if (settings.background.type === 'gradient') {
        document.body.style.background = settings.background.value;
      } else if (settings.background.type === 'image') {
        document.body.style.backgroundImage = `url(${settings.background.value})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
      }
      // Color background is handled by root.style.setProperty('--background')
    }
    // If systemThemeMode is light but !appliedSettings, defaults from CSS will apply after clearCustomStyles.

    // If no custom settings are applied, or if they are the default ones, clear custom styles
    // to let next-themes handle base styling (light/dark).
    else {
        console.log('No custom theme or default theme applied, clearing custom styles for next-themes defaults.');
        clearCustomStyles();
    }

  }, [appliedSettings]); // Dependencies: appliedSettings and systemThemeMode // Dependency changed to just appliedSettings

  // Function to manually apply settings (e.g., after creating/editing)
  const applyThemeSettings = (settings: ThemeSettings) => {
    console.log('Manually applying theme settings and caching');
    setAppliedSettings(settings);
    if (connectionId) {
      const cacheKey = `${LOCAL_STORAGE_KEY_PREFIX}${connectionId}`;
      localStorage.setItem(cacheKey, JSON.stringify(settings));
    }
  };

  // Memoize the context value
  const value = useMemo(() => ({
    themeSettings: currentThemeSettings,
    isLoading: !isInitialized,
    applyThemeSettings,
  }), [currentThemeSettings, isInitialized, applyThemeSettings]); // Correct dependencies

  return (
    <CustomThemeContext.Provider value={value}>
      {children}
    </CustomThemeContext.Provider>
  );
} 