import { footerClass } from './settings-ui';
import { cn } from '@/lib/utils';

interface SettingsCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}

export function SettingsCard({
  title,
  description,
  children,
  footer,
  action,
  className,
  ...props
}: SettingsCardProps) {
  return (
    <section className={cn('w-full space-y-5', className)} {...props}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[15px] leading-none font-semibold">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-[13px] leading-snug">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className="space-y-5">{children}</div>
      {footer && <div className={footerClass}>{footer}</div>}
    </section>
  );
}
