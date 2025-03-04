"use client";

import { AIChat } from "@/components/create/ai-chat";
import { Button } from "@/components/ui/button";
import { X, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface AISidebarProps {
  className?: string;
}

// Create a context to manage the AI sidebar state globally
import { createContext, useContext } from "react";
import { useHotKey } from "@/hooks/use-hot-key";

type AISidebarContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
};

export const AISidebarContext = createContext<AISidebarContextType | undefined>(undefined);

export function useAISidebar() {
  const context = useContext(AISidebarContext);
  if (!context) {
    throw new Error("useAISidebar must be used within an AISidebarProvider");
  }
  return context;
}

export function AISidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggleOpen = () => setOpen((prev) => !prev);

  return (
    <AISidebarContext.Provider value={{ open, setOpen, toggleOpen }}>
      {children}
      {/* <AISidebar /> */}
    </AISidebarContext.Provider>
  );
}

export function AISidebar({ className }: AISidebarProps) {
  const { open, setOpen } = useAISidebar();

  useHotKey("Meta+0", () => {
    setOpen(!open);
  });

  useHotKey("Control+0", () => {
    setOpen(!open);
  });

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-4 right-4 z-40 my-2 mr-2",
          "bg-background w-[400px]",
          "rounded-xl border shadow-lg",
          "transition-all duration-300 ease-in-out",
          "flex flex-col",
          "bg-offsetLight dark:bg-offsetDark overflow-y-auto",
          open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
          className,
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-full flex-col p-2 px-3">
            <div className="mb-4 flex items-center justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="md:h-fit md:p-2"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </Button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <div className="relative h-20 w-20">
                <Image src="/black-icon.svg" alt="Zero Logo" fill className="dark:hidden" />
                <Image src="/white-icon.svg" alt="Zero Logo" fill className="hidden dark:block" />
              </div>
              <p className="animate-shine mt-2 hidden bg-gradient-to-r from-neutral-500 via-neutral-300 to-neutral-500 bg-[length:200%_100%] bg-clip-text text-lg text-transparent opacity-50 md:block">
                Ask Zero a question...
              </p>
            </div>
            <div className="mt-auto">
              <AIChat />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default AISidebar;
