import { useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export default function ThreadActionButton({
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
    onClick?: () => void;
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
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
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
