'use client';

import { AIChat } from '@/components/create/ai-chat';
import { Button } from '@/components/ui/button';
import { X, MessageSquare, PanelLeftOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useEditor } from '@/components/providers/editor-provider';

interface AISidebarProps {
  className?: string;
}

// Create a context to manage the AI sidebar state globally
import { createContext, useContext } from 'react';
import { useHotKey } from '@/hooks/use-hot-key';

type AISidebarContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
};

export const AISidebarContext = createContext<AISidebarContextType | undefined>(undefined);

export function useAISidebar() {
  const context = useContext(AISidebarContext);
  if (!context) {
    throw new Error('useAISidebar must be used within an AISidebarProvider');
  }
  return context;
}

export function AISidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggleOpen = () => setOpen((prev) => !prev);

  return (
    <AISidebarContext.Provider value={{ open, setOpen, toggleOpen }}>
      <AISidebar>
        {children}
      </AISidebar>
    </AISidebarContext.Provider>
  );
}

export function AISidebar({ children, className }: AISidebarProps & { children: React.ReactNode }) {
  const { open, setOpen } = useAISidebar();
  const { editor } = useEditor();

  useHotKey('Meta+0', () => {
    setOpen(!open);
  });

  useHotKey('Control+0', () => {
    setOpen(!open);
  });

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup direction="horizontal" className={cn(
        'bg-white dark:bg-black p-0',
      )}>
        <ResizablePanel>
          {children}
        </ResizablePanel>
        
        {open && (
          <>
            <ResizableHandle className='opacity-0 w-0.5' />
            <ResizablePanel defaultSize={25} minSize={25} maxSize={40}>
              <div className={cn(
                'h-[calc(100vh-1.5rem)]',
                'flex flex-col',
                'my-3 mr-3',
                className
              )}>
                <div className="flex h-full flex-col overflow-hidden">
                  <div className="flex h-full flex-col pb-1 overflow-y-auto">
                    <div className="mb-4 flex items-center justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="md:h-fit md:p-2 w-8" onClick={() => setOpen(false)}>
                            <PanelLeftOpen size={18} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Close</TooltipContent>
                      </Tooltip>
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
                      <AIChat editor={editor} />
                    </div>
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}

export default AISidebar;
