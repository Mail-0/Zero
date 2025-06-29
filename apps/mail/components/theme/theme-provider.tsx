'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useActiveConnection } from '@/hooks/use-connections';
import { useConnectionTheme } from '@/hooks/use-themes';
import { Theme, defaultTheme } from '@/types/theme';

interface ThemeContextType {
  currentTheme: Theme;
  isLoading: boolean;
  applyTheme: (theme: Theme) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
  const { data: activeConnection } = useActiveConnection();
  const { data: connectionTheme, isLoading } = useConnectionTheme(activeConnection?.id);

  // Apply connection theme when it changes
  useEffect(() => {
        // Reset to default first to avoid flash of previous theme
+    resetThemeToDefault();
+
    if (connectionTheme?.connectionTheme?.theme) {
      const theme = connectionTheme.connectionTheme.theme;
      setCurrentTheme(theme);
      applyThemeToDocument(theme);
    } else {
      setCurrentTheme(defaultTheme);
    }
  }, [connectionTheme]);

  const applyThemeToDocument = (theme: Theme) => {
    const root = document.documentElement;

    // Apply CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // Apply font family
    if (theme.typography.fontFamily !== defaultTheme.typography.fontFamily) {
      loadGoogleFont(theme.typography.fontFamily);
      root.style.setProperty('--font-family', theme.typography.fontFamily);
    }

    // Apply spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    // Apply shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply border radius
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      const cssKey = key === 'base' ? '--radius' : `--radius-${key}`;
      root.style.setProperty(cssKey, value);
    });
  };

  const loadGoogleFont = (fontFamily: string) => {
    const fontName = fontFamily.split(',')[0].trim();
    const existingLink = document.getElementById('custom-google-font');

    if (existingLink) {
      existingLink.remove();
    }

    if (fontName !== 'Inter' && fontName !== 'system-ui' && fontName !== 'sans-serif') {
      const link = document.createElement('link');
      link.id = 'custom-google-font';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@100;300;400;500;600;700;800&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  };

  const resetThemeToDefault = () => {
    const root = document.documentElement;

    // Reset color variables
    Object.keys(defaultTheme.colors).forEach((key) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.removeProperty(cssVar);
    });

    // Reset other variables
    root.style.removeProperty('--font-family');
    Object.keys(defaultTheme.spacing).forEach((key) => {
      root.style.removeProperty(`--spacing-${key}`);
    });
    Object.keys(defaultTheme.shadows).forEach((key) => {
      root.style.removeProperty(`--shadow-${key}`);
    });
    Object.keys(defaultTheme.borderRadius).forEach((key) => {
      const cssKey = key === 'base' ? '--radius' : `--radius-${key}`;
      root.style.removeProperty(cssKey);
    });

    // Remove custom font
    const existingLink = document.getElementById('custom-google-font');
    if (existingLink) {
      existingLink.remove();
    }
  };

  const applyTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    applyThemeToDocument(theme);
  };

  const resetTheme = () => {
    setCurrentTheme(defaultTheme);
    resetThemeToDefault();
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        isLoading,
        applyTheme,
        resetTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
