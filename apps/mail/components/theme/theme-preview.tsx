'use client';

import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { useFullscreen } from '@/hooks/use-fullscreen';
import { useFormContext } from 'react-hook-form';
import { ThemeStylesSchema } from '@/lib/theme';
import { convertToHSL } from './converter';
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
  const value = useFormContext<z.infer<typeof ThemeStylesSchema>>();
  return (
    <div
      style={{
        '--background': convertToHSL(value.watch('light.background') || ''),
        '--foreground': convertToHSL(value.watch('light.foreground') || ''),
        '--card': convertToHSL(value.watch('light.card') || ''),
        '--card-foreground': convertToHSL(value.watch('light.card-foreground') || ''),
        '--primary': convertToHSL(value.watch('light.primary') || ''),
        '--primary-foreground': convertToHSL(value.watch('light.primary-foreground') || ''),
        '--secondary': convertToHSL(value.watch('light.secondary') || ''),
        '--secondary-foreground': convertToHSL(value.watch('light.secondary-foreground') || ''),
        '--muted': convertToHSL(value.watch('light.muted') || ''),
        '--muted-foreground': convertToHSL(value.watch('light.muted-foreground') || ''),
        '--accent': convertToHSL(value.watch('light.accent') || ''),
        '--accent-foreground': convertToHSL(value.watch('light.accent-foreground') || ''),
        '--destructive': convertToHSL(value.watch('light.destructive') || ''),
        '--destructive-foreground': convertToHSL(value.watch('light.destructive-foreground') || ''),
        '--border': convertToHSL(value.watch('light.border') || ''),
        '--input': convertToHSL(value.watch('light.input') || ''),
        '--ring': convertToHSL(value.watch('light.ring') || ''),
        '--chart-1': convertToHSL(value.watch('light.chart-1') || ''),
        '--chart-2': convertToHSL(value.watch('light.chart-2') || ''),
        '--chart-3': convertToHSL(value.watch('light.chart-3') || ''),
        '--chart-4': convertToHSL(value.watch('light.chart-4') || ''),
        '--chart-5': convertToHSL(value.watch('light.chart-5') || ' '),
        '--radius': value.watch('light.radius') + 'em',
      }}
      className={cn('flex h-full flex-1 flex-col', className)}
    >
      {children}
    </div>
  );
}
