import { FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ImportButtonProps {
  onImportClick: () => void;
}

export function ImportButton({ onImportClick }: ImportButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={onImportClick}
        >
          <FileCode className="size-3.5" />
          <span className="text-sm hidden md:block">Import</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Import CSS variables</TooltipContent>
    </Tooltip>
  );
}
