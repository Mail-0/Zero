import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThreadActionButton({
    icon: Icon,
    label,
    onClick,
    disabled = false,
    className,
  }: {
    icon: React.ComponentType<React.ComponentPropsWithRef<any>> & {
      startAnimation?: () => void;
      stopAnimation?: () => void;
    };
    label: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
    className?: string;
  }) {
    const iconRef = useRef<any>(null);
  
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              disabled={disabled}
              onClick={onClick}
              variant="ghost"
              className={cn('md:h-fit md:px-2', className)}
              onMouseEnter={() => iconRef.current?.startAnimation?.()}
              onMouseLeave={() => iconRef.current?.stopAnimation?.()}
            >
              <Icon ref={iconRef} className="h-4 w-4" />
              <span className="sr-only">{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }