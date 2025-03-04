import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AITextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "placeholder:animate-shine placeholder:bg-gradient-to-r placeholder:from-neutral-500 placeholder:via-neutral-300 placeholder:to-neutral-500 placeholder:bg-[length:200%_100%] placeholder:bg-clip-text placeholder:text-transparent",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
AITextarea.displayName = "Textarea"

export { AITextarea }
