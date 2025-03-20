import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CookieTriggerProps {
  variant?: 'link' | 'button' | 'prominent' | 'icon';
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export function CookieTrigger({
  variant = 'button',
  className,
  children,
  onClick,
}: CookieTriggerProps) {
  const variants = {
    link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
    button: 'bg-primary text-primary-foreground hover:bg-primary/90',
    prominent: 'b text-white  font-medium px-6',
    icon: 'h-9 w-9 rounded-full border-zinc-800 dark:text-black text-white shadow-lg bg-black dark:bg-white relative top-2 left-2',
  };

  return (
    <Button
      size="icon"
      variant={variant === 'link' ? 'link' : 'default'}
      className={cn(variants[variant], className)}
      onClick={onClick}
    >
      {children || (
        <>
          {variant === 'icon' ? (
            <Cookie className="h-3 w-3" />
          ) : (
            <>
              <Cookie className="mr-2 h-4 w-4" />
              Cookie Settings
            </>
          )}
        </>
      )}
    </Button>
  );
}
