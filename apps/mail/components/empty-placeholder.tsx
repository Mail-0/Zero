import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyPlaceholderProps {
  children?: ReactNode;
  className?: string;
}

export function EmptyPlaceholder({ children, className }: EmptyPlaceholderProps) {
  return (
    <div className={cn(
      "flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50",
      className
    )}>
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
} 