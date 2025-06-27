import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FancyBadgeProps {
  children: ReactNode;
  className?: string;
  topGradientColors?: {
    start?: string;
    middle?: string;
    end?: string;
  };
}

export function FancyBadge({
  children,
  className,
  topGradientColors = {
    start: 'rgba(0, 0, 0, 0)',
    middle: 'rgba(143, 143, 143, 0.67)',
    end: 'rgba(0, 0, 0, 0)',
  },
}: FancyBadgeProps) {
  return (
    <div
      className={cn(
        'border-slate-6 group relative flex flex-col gap-4 rounded-3xl border bg-[#F5F5F5] shadow-[inset_0px_0px_12px_rgba(0,0,0,0.05)] dark:bg-[#161616] dark:shadow-[inset_0px_0px_12px_rgba(255,255,255,0.1)]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-px w-1/3 max-w-full -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group-hover:w-1/2"
        style={{
          backgroundImage: `linear-gradient(90deg, ${topGradientColors.start} 0%, ${topGradientColors.start} 0%, ${topGradientColors.middle} 50%, ${topGradientColors.end} 100%)`,
        }}
      ></div>
      <div
        className={`absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group-hover:h-3 group-hover:w-1/2`}
        style={{
          backgroundColor: `${topGradientColors.middle}`,

          filter: 'blur(12px)',
          opacity: 0.5,
        }}
      />

      <div className="relative z-10 flex items-center gap-2 px-6 py-2.5 text-sm">{children}</div>
    </div>
  );
}
