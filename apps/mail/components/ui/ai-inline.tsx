"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { Textarea } from "@/components/ui/textarea";
import { generateInlineAIEdit } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import type { Editor } from "@tiptap/react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AIInlineContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  position: { x: number; y: number };
  setPosition: (position: { x: number; y: number }) => void;
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
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
  const [editor, setEditor] = useState<Editor | null>(null);

  const toggleOpen = () => setOpen((prev) => !prev);

  return (
    <AIInlineContext.Provider
      value={{ open, setOpen, toggleOpen, position, setPosition, editor, setEditor }}
    >
      {/* {children} */}
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
  const { open, setOpen, position, editor, setEditor } = useAIInline();
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

  const onSubmit = async (data: FormValues) => {
    try {
      // Get current text selection or editing context
      const selected_text = editor
        ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ")
        : "";

      // Create the payload
      const aiRequestPayload = {
        prompt: data.aiPrompt,
        selection: selected_text,
      };

      // Use SWR's mutate to call the server action directly
      const result = await generateInlineAIEdit(aiRequestPayload);

      if ("error" in result) {
        console.error("AI edit error:", result.error);
        return toast.error("Failed to process AI edit request");
      } else if ("data" in result) {
        try {
          const editedText = JSON.parse(result.data).edit;

          // Apply the edited text to the editor
          if (editor) {
            editor.chain().focus().deleteSelection().insertContent(editedText).run();

            toast.success("Applied AI edit");
          }
        } catch (parseError) {
          console.error("Error parsing AI response:", parseError);
          toast.error("Failed to apply AI edit");
        }
      }
    } catch (error) {
      console.error("Error sending AI edit request:", error);
      toast.error("Failed to process AI edit request");
      throw error;
    }
  };

  // Handle Cmd+Enter submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-inline-editor-title"
    >
      <Card className="bg-background w-[500px] border-none shadow-lg">
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-3">
            <Textarea
              {...register("aiPrompt")}
              placeholder="Write what to change..."
              className="max-h-96 min-h-[80px] resize-y overflow-hidden rounded-md border-none bg-zinc-950/80 px-3 py-2 text-sm placeholder:text-zinc-500 focus:ring-1 focus:ring-zinc-800"
              onKeyDown={handleKeyDown}
              aria-label="AI prompt input"
            />
          </CardContent>
          <CardFooter className="flex items-center justify-between p-3 pt-0">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={formState.isSubmitting}
              className="border-border/30 hover:bg-secondary/80 h-6 border px-2 text-xs shadow-sm"
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center text-sm opacity-70">
                <X className="mr-2" /> Esc
              </span>
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={formState.isSubmitting}
              className="border-border/30 hover:bg-secondary/80 h-6 border px-2 text-xs shadow-sm"
            >
              <span className="text-sm opacity-70">⌘ + ↵</span>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default AIInline;
