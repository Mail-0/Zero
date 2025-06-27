import { cn } from '@/lib/utils';
import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLInputElement> {}

const AITextarea = React.forwardRef<HTMLInputElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          'placeholder:text-muted-foreground w-full bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
          'placeholder:animate-shine placeholder:bg-gradient-to-r placeholder:from-neutral-500 placeholder:via-neutral-300 placeholder:to-neutral-500 placeholder:bg-[length:200%_100%] placeholder:bg-clip-text placeholder:text-transparent',
          'border-0 focus:outline-none focus:ring-0',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

AITextarea.displayName = 'AITextarea';

export { AITextarea };
