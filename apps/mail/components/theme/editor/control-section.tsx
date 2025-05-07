import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ControlSectionProps } from "@/types/theme";


const ControlSection = ({
  title,
  children,
  expanded = false,
  className,
  id,
}: ControlSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(expanded);

  return (
    <div
      id={id}
      className={cn("mb-4 border rounded-lg overflow-hidden", className)}
    >
      <div
        className="flex items-center justify-between p-3 cursor-pointer bg-background hover:bg-muted"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-medium text-sm">{title}</h3>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? "Collapse section" : "Expand section"}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-3 bg-background border-t">{children}</div>
      </div>
    </div>
  );
};

export default ControlSection;
