import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 aria-busy:cursor-progress',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-logout text-destructive-foreground hover:bg-logout/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        main: 'bg-muted text-primary',
        // A button that resembles a dropdownItem
        dropdownItem:
          'cursor-default select-none gap-2 rounded-sm text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent',
      },
      size: {
        dropdownItem: 'px-2 py-1.5',
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        xs: 'h-8 rounded-md px-2',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, loadingText, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Slot : 'button';
    return (
      <Comp 
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isLoading || props.disabled}
        aria-busy={isLoading}
        aria-disabled={props.disabled}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="inline-block animate-spin mr-2">↻</span>
            {loadingText || children}
          </>
        ) : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
