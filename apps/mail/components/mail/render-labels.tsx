'use client';

import { PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useSearchValue } from '@/hooks/use-search-value';
import { Popover } from '../ui/popover';
import type { Label } from '@/types';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const RenderLabels = ({ count = 1, labels }: { count?: number; labels: Label[] }) => {
  const [searchValue, setSearchValue] = useSearchValue();
  const handleFilterByLabel = (label: Label) => (event: any) => {
    event.stopPropagation();
    const existingValue = searchValue.value;
    if (existingValue.includes(`label:${label.name}`)) {
      setSearchValue({
        value: existingValue.replace(`label:${label.name}`, ''),
        highlight: '',
        folder: '',
      });
      return;
    }
    const newValue = existingValue ? `${existingValue} label:${label.name}` : `label:${label.name}`;
    setSearchValue({
      value: newValue,
      highlight: '',
      folder: '',
    });
  };

  if (!labels.length) return null;

  const visibleLabels = labels.slice(0, count);
  const hiddenLabels = labels.slice(count);

  return (
    <div className="flex gap-1">
      {visibleLabels.map((label) => (
        <button
          key={label.id}
          onClick={handleFilterByLabel(label)}
          className={cn(
            'dark:bg-subtleBlack bg-subtleWhite text-primary inline-block truncate rounded border px-1.5 py-0.5 text-xs font-medium',
            searchValue.value.includes(`label:${label.name}`) &&
              'border-neutral-800 dark:border-white',
          )}
          style={{ backgroundColor: label.color?.backgroundColor, color: label.color?.textColor }}
        >
          {label.name}
        </button>
      ))}
      {hiddenLabels.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground dark:bg-subtleBlack bg-subtleWhite inline-block truncate rounded border px-1.5 py-0.5 text-xs font-medium">
              +{hiddenLabels.length}
            </button>
          </TooltipTrigger>
          <TooltipContent className="z-[99] flex gap-1 px-1 py-1">
            {hiddenLabels.map((label) => (
              <button
                key={label.id}
                onClick={handleFilterByLabel(label)}
                className={cn(
                  'dark:bg-subtleBlack bg-subtleWhite inline-block truncate rounded border px-1.5 py-0.5 text-xs font-medium',
                  searchValue.value.includes(`label:${label.name}`) &&
                    'border-neutral-800 dark:border-white',
                )}
                style={{
                  backgroundColor: label.color?.backgroundColor,
                  color: label.color?.textColor,
                }}
              >
                {label.name}
              </button>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
