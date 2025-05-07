"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useEditorStore } from "@/store/editor-store";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import {
  Sheet,
  SheetContent,
  SheetTitle
} from "@/components/ui/sheet";

// Dynamically import the editor to avoid SSR issues
const Editor = dynamic(() => import("@/components/theme/editor/editor"), { 
  ssr: false,
  loading: () => <div className="p-8 text-center">Loading theme editor...</div>
});

// Dynamically import required components
const ThemeControlPanel = dynamic(() => import("@/components/theme/editor/theme-control-panel"), { ssr: false });

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { resolvedTheme } = useTheme();
  const themeState = useEditorStore((state) => state.themeState);
  const setThemeState = useEditorStore((state) => state.setThemeState);

  // Initialize theme state on first render
  useEffect(() => {
    if (resolvedTheme) {
      // Avoid setting state if it's already the same to prevent infinite loops
      if (themeState.currentMode !== resolvedTheme) {
        setThemeState({
          ...themeState,
          currentMode: resolvedTheme as "light" | "dark",
        });
      }
    }
  }, [resolvedTheme]);

  // Listen for the custom event to open the customizer
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    document.addEventListener("open-theme-customizer", handleOpen);
    return () => {
      document.removeEventListener("open-theme-customizer", handleOpen);
    };
  }, []);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="bg-darkBackground px-0 py-1"
        overlayClassName="bg-transparent"
      >
        <SheetTitle className="sr-only">Customize Theme</SheetTitle>
        <div className="flex items-center justify-between p-2 border-b">
          <h2 className="text-lg font-medium">Customize Theme</h2>
          <div className="flex items-center gap-2">
    
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-full overflow-hidden">
          {open && (
            <Editor 
              config={{
                type: "theme",
                name: "Theme Editor",
                description: "Customize your theme",
                defaultState: {
                  styles: themeState.styles
                },
                controls: ThemeControlPanel as React.ComponentType<unknown>
              }}
              themePromise={Promise.resolve(null)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
} 