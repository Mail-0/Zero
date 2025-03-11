"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X, SendIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import Image from "next/image";

type AIInlineContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  position: { x: number; y: number };
  setPosition: (position: { x: number; y: number }) => void;
};

export const AIInlineContext = createContext<AIInlineContextType | undefined>(undefined);

export function useAIInline() {
  const context = useContext(AIInlineContext);
  if (!context) {
    throw new Error("useAIInline must be used within an AIInlineProvider");
  }
  return context;
}

export function AIInlineProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const toggleOpen = () => setOpen((prev) => !prev);

  return (
    <AIInlineContext.Provider value={{ open, setOpen, toggleOpen, position, setPosition }}>
      {children}
      <AIInline />
    </AIInlineContext.Provider>
  );
}

interface AIInlineProps {
  className?: string;
}

type FormValues = {
  aiPrompt: string;
};

export function AIInline({ className }: AIInlineProps) {
  const { open, setOpen, position } = useAIInline();
  const cardRef = useRef<HTMLDivElement>(null);
  const { register, handleSubmit, formState, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      aiPrompt: "",
    },
  });

  const formRef = useRef<HTMLFormElement>(null);

  // Adjust position to prevent card from going off-screen
  useEffect(() => {
    if (!cardRef.current || !open) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust if off right edge
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 20;
    }

    // Adjust if off bottom edge
    if (y + rect.height > viewportHeight) {
      y = y - rect.height - 10; // Place above cursor
    }

    card.style.transform = `translate(${x}px, ${y}px)`;
  }, [position, open]);

  const onSubmit = (data: FormValues) => {
      
    // After handling, reset the form (do not close the inline editor)
    setValue("aiPrompt", "");
  };

  // Handle Cmd+Enter submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  if (!open) return null;

  return (
    <div
      ref={cardRef}
      className={cn(
        "fixed left-0 top-0 z-50",
        "transition-all duration-150 ease-in-out",
        className,
      )}
      style={{
        width: "350px",
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <Card className="bg-background w-[500px] border shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between p-3 pb-0 pt-2">
          <div className="flex items-center gap-2">
            <div className="relative h-4 w-4">
              <Image src="/black-icon.svg" alt="Zero Logo" fill className="dark:hidden" />
              <Image src="/white-icon.svg" alt="Zero Logo" fill className="hidden dark:block" />
            </div>
            <span className="text-sm font-medium">Inline AI Editor</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
            <X size={16} />
          </Button>
        </CardHeader>
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-3 pt-2">
            <Textarea
              {...register("aiPrompt")}
              placeholder="Write what to change..."
              className="min-h-[80px] resize-y border-none bg-zinc-900"
              onKeyDown={handleKeyDown}
            />
          </CardContent>
          <CardFooter className="flex items-center justify-between p-3 pt-0">
            <p className="text-muted-foreground text-xs">
              <span className="ml-2 opacity-70">(⌘ + ↵ to submit)</span>
            </p>
            <Button type="submit" size="sm" className="gap-1" disabled={formState.isSubmitting}>
              <SendIcon size={14} />
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

// Update the AI button in TextButtons to trigger this component
export function triggerAIInline(editor: any) {
  const { toggleOpen, setPosition } = useAIInline();

  // Get current selection coordinates
  const { view } = editor;
  if (!view) return;

  const { from } = view.state.selection;
  const start = view.coordsAtPos(from);

  // Position card below the cursor
  setPosition({ x: start.left, y: start.bottom + 10 });
  toggleOpen();
}

export default AIInline;
