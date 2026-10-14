import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AiSettingsPanel } from './ai-settings-panel';
import { Settings2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hairline } from './ui';

export function AiSettingsDialog() {
  return (
    <TooltipProvider delayDuration={0}>
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" className="md:h-fit md:px-2" aria-label="AI settings">
                <Settings2 className="dark:text-iconDark text-iconLight h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>AI settings</TooltipContent>
        </Tooltip>
        <DialogContent
          showOverlay
          className={cn(
            'flex h-[min(640px,calc(100dvh-2rem))] w-[calc(100vw-1.5rem)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-xl',
            hairline,
          )}
        >
          <div className={cn('flex shrink-0 items-start gap-3 border-b px-5 py-4', hairline)}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6]">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <DialogTitle className="text-[15px] leading-tight font-semibold">
                AI settings
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-snug">
                Choose what Zero does with new mail, which labels it applies, and how it writes.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                className="text-iconLight dark:text-iconDark -mt-1 -mr-2 size-7 rounded-md"
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
          <AiSettingsPanel layout="dialog" />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
