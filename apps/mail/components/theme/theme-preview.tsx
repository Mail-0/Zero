'use client';

import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { useFullscreen } from '@/hooks/use-fullscreen';
import { CardsStats } from './card-stats';
import { cn } from '@/lib/utils';

export const ThemePreview = () => {
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        isFullscreen && 'bg-background fixed inset-0 z-50',
      )}
    >
      <ScrollArea className="m-4 mt-2 flex flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex h-full flex-1 flex-col">
          <CardsStats />
          <ScrollBar orientation="horizontal" />
        </div>
      </ScrollArea>
    </div>
  );
};
