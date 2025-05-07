'use client';

import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { useFullscreen } from '@/hooks/use-fullscreen';
import { useFormContext } from 'react-hook-form';
import { ThemeStylesSchema } from '@/lib/theme';
import type { CSSProperties } from 'react';
import { CardsStats } from './card-stats';
import { cn } from '@/lib/utils';
import { z } from 'zod';
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
        <ThemePreviewContainer>
          <CardsStats />
          <ScrollBar orientation="horizontal" />
        </ThemePreviewContainer>
      </ScrollArea>
    </div>
  );
};

interface ThemePreviewContainerProps {
  children: React.ReactNode;
  className?: string;
}

function ThemePreviewContainer({ children, className }: ThemePreviewContainerProps) {
  const form = useFormContext<z.infer<typeof ThemeStylesSchema>>();

  const values = form.watch();

  return (
    <div
      style={{
        ...Object.entries(values.light).reduce((acc, [key, value]) => {
          // @ts-ignore
          acc[`--${key}`] = value;
          return acc;
        }, {} as CSSProperties),
      }}
      className={cn('flex h-full flex-1 flex-col', className)}
    >
      {children}
    </div>
  );
}
