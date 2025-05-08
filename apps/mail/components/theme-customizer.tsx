'use client';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useEditorStore } from '@/store/editor-store';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Editor from './theme/editor/editor';
import { useTheme } from 'next-themes';
import { X } from 'lucide-react';

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false);
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
          currentMode: resolvedTheme as 'light' | 'dark',
        });
      }
    }
  }, [resolvedTheme]);

  // Listen for the custom event to open the customizer
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    document.addEventListener('open-theme-customizer', handleOpen);
    return () => {
      document.removeEventListener('open-theme-customizer', handleOpen);
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="dark:bg-darkBackground bg-lightBackground px-0 py-1 text-black dark:text-white"
        overlayClassName="bg-transparent"
      >
        <SheetTitle className="sr-only">Customize Theme</SheetTitle>
        <div className="flex items-center justify-between border-b p-2">
          <h2 className="text-lg font-medium">Customize Theme</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-full overflow-hidden">
          {open && (
            <Editor
              config={{
                type: 'theme',
                name: 'Theme Editor',
                description: 'Customize your theme',
                defaultState: {
                  styles: themeState.styles,
                },
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
