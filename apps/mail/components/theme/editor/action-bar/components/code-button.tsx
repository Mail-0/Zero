import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CodeButtonProps {
  onCodeClick: () => void;
}

export function CodeButton({ onCodeClick }: CodeButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={onCodeClick}
        >
          <Braces className="size-3.5" />
          <span className="text-sm">Code</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>View theme code</TooltipContent>
    </Tooltip>
  );
}
