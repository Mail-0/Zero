import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ShareButtonProps {
  onShareClick: () => void;
  isSharing?: boolean;
}

export function ShareButton({ onShareClick, isSharing }: ShareButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={onShareClick}
          disabled={isSharing}
        >
          {isSharing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Share2 className="size-3.5" />
          )}
          <span className="text-sm hidden md:block">Share</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Share theme</TooltipContent>
    </Tooltip>
  );
}
