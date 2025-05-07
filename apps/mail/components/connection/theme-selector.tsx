import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export interface ThemeOption {
  id: string;
  name: string;
}

interface ThemeSelectorProps {
  value: string | null;
  onChange: (id: string) => void;
  onCreateTheme?: () => void;
  options: ThemeOption[];
}

import { useThemeMarketplaceIntegration } from './theme-marketplace-integration';

export function ThemeSelector({ value, onChange, onCreateTheme, options }: ThemeSelectorProps) {
  const { marketplaceModal, marketplaceButton } = useThemeMarketplaceIntegration({
    onThemeCopied: (newTheme) => {
      // Add the new theme to the options list (parent should handle this via props, but fallback here)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('theme-copied', { detail: newTheme }));
      }
    },
  });

  // Listen for theme-copied event to trigger parent update if needed
  useEffect(() => {
    const handler = (e: any) => {
      if (onCreateTheme) onCreateTheme(); // fallback, parent should refetch
    };
    window.addEventListener('theme-copied', handler);
    return () => window.removeEventListener('theme-copied', handler);
  }, [onCreateTheme]);

  return (
    <div className="flex items-center gap-2">
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          {options.map((theme) => (
            <SelectItem key={theme.id} value={theme.id}>
              {theme.name}
            </SelectItem>
          ))}
          <div className="p-2 border-t mt-2 space-y-2">
            <Button type="button" variant="ghost" className="w-full" onClick={onCreateTheme}>
              + Create New Theme
            </Button>
            {marketplaceButton}
          </div>
        </SelectContent>
      </Select>
      {marketplaceModal}
    </div>
  );
}
