import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
}: SettingsCardProps) {
  return (
    <Card className={cn("w-full border-none bg-offsetLight px-0 dark:bg-offsetDark shadow-none", className)}>
      <CardHeader className="px-0 pt-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6 px-0">{children}</CardContent>
      {footer && <div className="border-t py-4">{footer}</div>}
    </Card>
  );
}
