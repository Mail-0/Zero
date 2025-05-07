import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";

interface EditButtonProps {
  themeId: string;
}

export function EditButton({ themeId }: EditButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/editor/theme/${themeId}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            <PenLine className="size-3.5" />
            <span className="text-sm hidden md:block">Edit</span>
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>Edit theme</TooltipContent>
    </Tooltip>
  );
}
