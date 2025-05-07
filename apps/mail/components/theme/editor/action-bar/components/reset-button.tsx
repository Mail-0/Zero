import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResetButtonProps {
  onReset: () => void;
  isDisabled: boolean;
}

export function ResetButton({ onReset, isDisabled }: ResetButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={onReset}
          disabled={isDisabled}
        >
          <RefreshCw className="size-3.5" />
          <span className="text-sm hidden md:block">Reset</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Reset to preset defaults</TooltipContent>
    </Tooltip>
  );
}
