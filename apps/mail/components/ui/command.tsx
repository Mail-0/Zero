import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  type DialogProps,
} from '@/components/ui/dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { Search, X } from '../icons/icons';
import { cn } from '@/lib/utils';
import * as React from 'react';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-lg',
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps extends DialogProps {
  showEscButton?: boolean;
  onEscClick?: () => void;
  currentView?: string;
  shouldFilter?: boolean;
}

const CommandDialog = ({
  children,
  showEscButton = false,
  onEscClick,
  currentView,
  shouldFilter = true,
  ...props
}: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogTitle className="sr-only">Command</DialogTitle>
      <DialogDescription className="sr-only">Command</DialogDescription>
      {showEscButton ? (
        <DialogContent
          showOverlay={true}
          className="fixed left-[50%] top-[50%] z-[100] flex translate-x-[-50%] translate-y-[-50%] flex-col items-center justify-center gap-2 border-none !bg-transparent p-0 shadow-none"
        >
          {/* ESC Button */}
          <div className="flex w-full justify-start sm:max-w-2xl md:max-w-3xl">
            <button
              onClick={showEscButton && onEscClick ? onEscClick : undefined}
              className="dark:bg-panelDark flex items-center gap-1 rounded-lg bg-[#F0F0F0] px-2 py-1.5 hover:bg-[#E0E0E0] dark:hover:bg-[#202020]"
            >
              {currentView === 'main' ? (
                <X className="fill-muted-foreground mt-0.5 h-3.5 w-3.5 dark:fill-[#929292]" />
              ) : (
                <span className="text-muted-foreground text-sm font-medium dark:text-[#929292]">
                  ←
                </span>
              )}
              <span className="text-muted-foreground text-sm font-medium dark:text-[#929292]">
                esc
              </span>
            </button>
          </div>

          {/* Command Palette Content */}
          <div className="dark:bg-panelDark w-full max-w-md overflow-hidden rounded-xl border-none bg-white p-0 sm:max-w-lg lg:max-w-[750px]">
            <Command
              shouldFilter={shouldFilter}
              className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2"
            >
              {children}
            </Command>
          </div>
        </DialogContent>
      ) : (
        <DialogContent
          showOverlay={true}
          className="dark:bg-panelDark w-full max-w-md overflow-hidden rounded-xl border-none bg-white p-0 sm:max-w-lg lg:max-w-[750px] [&>button:last-child]:hidden"
        >
          <Command
            shouldFilter={shouldFilter}
            className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2"
          >
            {children}
          </Command>
        </DialogContent>
      )}
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="border-input flex w-full items-center border-none px-5">
    <Search className="fill-iconLight text-muted-foreground/80 relative top-0.5 me-3 h-4 w-4" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'placeholder:text-muted-foreground/70 flex h-10 w-full rounded-lg bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      'max-h-80 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-neutral-200 [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:border-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2',
      className,
    )}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
      className,
    )}
    {...props}
  />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('bg-border -mx-1 h-px', className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex cursor-default select-none items-center gap-4 rounded-md px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
      className,
    )}
    {...props}
  />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <kbd
      className={cn(
        'border-muted-foreground/10 bg-accent h-6 rounded-[6px] border px-1.5 font-mono text-xs leading-6',
        '-me-1 ms-auto inline-flex max-h-full items-center',
        className,
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
