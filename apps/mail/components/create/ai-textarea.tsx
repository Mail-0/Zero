'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AITextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'placeholder:text-muted-foreground w-full bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
          'placeholder:animate-shine placeholder:bg-gradient-to-r placeholder:from-neutral-500 placeholder:via-neutral-300 placeholder:to-neutral-500 placeholder:bg-[length:200%_100%] placeholder:bg-clip-text placeholder:text-transparent',
          'focus:outline-none focus:ring-0 border-0',
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
