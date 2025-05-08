'use client';

import { useUserThemes, useThemeActions, useConnectionTheme } from '@/hooks/use-themes';
import { useSession } from '@/lib/auth-client';
import { PaintBucket, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';

export function SidebarThemeSelector() {
  const { data: session } = useSession();
  const { themes, isLoading: isLoadingThemes } = useUserThemes();
  const { applyToConnection, update } = useThemeActions();
  const [isRendered, setIsRendered] = useState(false);
  const t = useTranslations();
  
  // Only retrieve connection theme if we have a session
  const { theme: activeTheme, mutate } = useConnectionTheme(
    session?.connectionId || ''
  );

  // Prevent hydration errors
  useEffect(() => setIsRendered(true), []);

  const handleThemeSelect = async (themeId: string) => {
    try {
      const result = await applyToConnection(themeId);
      if (result.success) {
        mutate();
        toast.success('Theme applied successfully');
      } else {
        toast.error(result.error || 'Failed to apply theme');
      }
    } catch (error) {
      toast.error('An error occurred while applying the theme');
    }
  };

  const handleResetToDefault = async () => {
    try {
      // Find the default theme if it exists
      const defaultTheme = themes.find(theme => 
        theme.name.toLowerCase().includes('default') || 
        theme.name === 'Light Theme' || 
        theme.name === 'System'
      );
      
      if (defaultTheme) {
        // If a default theme exists, apply it
        await handleThemeSelect(defaultTheme.id);
      } else {
        // If there's a current theme applied, we need to remove it
        // This will effectively reset to the system default
        if (activeTheme) {
          // Clear the current connection's theme assignment by updating the theme
          // to remove the connectionId
          const result = await update({
            id: activeTheme.id,
            connectionId: null
          });
          
          if (result.success) {
            mutate();
            toast.success('Reset to default theme');
          } else {
            toast.error(result.error || 'Failed to reset theme');
          }
        } else {
          toast.info('Already using default theme');
        }
      }
    } catch (error) {
      toast.error('An error occurred while resetting theme');
    }
  };

  if (!isRendered || !session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="flex items-center">
          <PaintBucket className="mr-2 shrink-0" />
          <p className="mt-0.5 min-w-0 flex-1 truncate text-[13px]">{t('navigation.sidebar.theme')}</p>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Select Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Reset to Default option */}
        <DropdownMenuItem 
          onClick={handleResetToDefault}
          className="flex items-center text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          <span>Reset to Default</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {isLoadingThemes ? (
          <DropdownMenuItem disabled>Loading themes...</DropdownMenuItem>
        ) : themes.length === 0 ? (
          <DropdownMenuItem disabled>No themes available</DropdownMenuItem>
        ) : (
          themes.map((theme) => (
            <DropdownMenuItem
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              className="flex items-center justify-between"
            >
              <span>{theme.name}</span>
              {activeTheme?.id === theme.id && (
                <span className="text-primary">✓</span>
              )}
            </DropdownMenuItem>
          ))
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/themes" className="cursor-pointer">
            Manage Themes...
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 