'use client';

import { PopoverContent, PopoverTrigger } from '@radix-ui/react-popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useSearchValue } from '@/hooks/use-search-value';
import { Label } from '@/hooks/use-labels';
import { Popover } from '../ui/popover';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const RenderLabels = ({ labels }: { labels: Label[] }) => {
  const [searchValue, setSearchValue] = useSearchValue();
  const label = React.useMemo(() => labels[0], [labels]);

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

  if (!label) return null;

  return (
    <span
      key={label.id}
      className="dark:bg-subtleBlack bg-subtleWhite text-primary inline-block truncate rounded border px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: label.color?.backgroundColor, color: label.color?.textColor }}
    >
      {label.name}
      {labels.length > 1 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground text-[10px]"> (+{labels.length - 1})</span>
          </TooltipTrigger>
          <TooltipContent className="flex gap-1">
            {labels.map((label) => (
              <button
                onClick={handleFilterByLabel(label)}
                className={cn(
                  'dark:bg-subtleBlack bg-subtleWhite inline-block truncate rounded border px-1.5 py-0.5 text-xs font-medium',
                  searchValue.value.includes(`label:${label.name}`) &&
                    'border-purple-800 bg-purple-800/30',
                )}
                key={label.id}
              >
                {label.name}
              </button>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
};
