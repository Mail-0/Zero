import { cn } from '@/lib/utils';
import React from 'react';

interface RightSidebarProps {
  children?: React.ReactNode;
  className?: string;
}

export function RightSidebar({ children, className }: RightSidebarProps) {
  return (
    <div
      className={cn(
        'bg-sidebar dark:bg-sidebar flex h-screen w-80 flex-col border-l border-gray-200 dark:border-gray-800',
        className,
      )}
    >
      <div className="flex-1 p-4">
        {children || (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <p className="text-sm">Right sidebar content</p>
          </div>
        )}
      </div>
    </div>
  );
}
