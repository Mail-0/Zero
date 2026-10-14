import { cn } from '@/lib/utils';
import React from 'react';

type PageHeaderProps = React.HTMLAttributes<HTMLDivElement>;

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-2 border-b px-4 pt-2 pb-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
PageHeader.displayName = 'PageHeader';

type PageHeaderTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

const PageHeaderTitle = React.forwardRef<HTMLHeadingElement, PageHeaderTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h1 ref={ref} className={cn('text-2xl font-semibold tracking-tight', className)} {...props}>
        {children}
      </h1>
    );
  },
);
PageHeaderTitle.displayName = 'PageHeaderTitle';

type PageHeaderDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

const PageHeaderDescription = React.forwardRef<HTMLParagraphElement, PageHeaderDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p ref={ref} className={cn('text-muted-foreground text-sm', className)} {...props}>
        {children}
      </p>
    );
  },
);
PageHeaderDescription.displayName = 'PageHeaderDescription';

// Attach subcomponents to PageHeader
// @ts-expect-error, fix types
PageHeader.Title = PageHeaderTitle;
// @ts-expect-error, fix types
PageHeader.Description = PageHeaderDescription;

export { PageHeader };
