import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PricingDialog } from '../ui/pricing-dialog';
import { cn } from '@/lib/utils';

interface SettingsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
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
}: SettingsCardProps) {
  return (
    <Card
      className={cn(
        'bg-panelLight dark:bg-panelDark w-full border-none px-0 shadow-none',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between px-0 pt-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className="space-y-6 px-0">{children}</CardContent>
      {footer && <div className="border-t py-4">{footer}</div>}
      <PricingDialog />
    </Card>
  );
}
