'use client';

import { useUserThemes, useThemeActions, useConnectionTheme } from '@/hooks/use-themes';
import { useSession } from '@/lib/auth-client';
import { PaintBucket } from 'lucide-react';
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
  const { applyToConnection } = useThemeActions();
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