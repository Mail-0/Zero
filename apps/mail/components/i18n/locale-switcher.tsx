import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslationPreloader } from '@/components/i18n/translation-preloader';
import { availableLocales, type Locale } from '@/i18n/config';
import { useLocale, useTranslations } from 'use-intl';
import { useState, useCallback, useRef } from 'react';
import { Globe, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LocaleSwitcherProps {
  showBadge?: boolean;
  size?: 'sm' | 'default' | 'lg';
  value?: string;
  onValueChange?: (value: string) => void;
}

export function LocaleSwitcher({
  showBadge = true,
  size = 'default',
  value,
  onValueChange,
}: LocaleSwitcherProps) {
  const locale = useLocale();
  const currentLocale = value || locale;
  const { preloadLocale } = useTranslationPreloader();

  const handleLocaleChange = async (newLocale: string) => {
    if (newLocale === currentLocale) return;
    await preloadLocale(newLocale);
    onValueChange?.(newLocale);
  };

  const currentLanguage = availableLocales.find((l) => l.code === currentLocale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="flex items-center space-x-2">
          <Globe className="h-4 w-4" />
          <span>{currentLanguage?.name || currentLocale}</span>
          {showBadge && (
            <Badge variant="secondary" className="text-xs">
              {currentLocale.toUpperCase()}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-84 no-scrollbar max-h-80 overflow-auto">
        {availableLocales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => handleLocaleChange(locale.code)}
            className="flex cursor-pointer items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <span>{locale.name}</span>
              <Badge variant="outline" className="text-xs">
                {locale.code.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
              {locale.code === currentLocale && <Check className="text-primary h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
