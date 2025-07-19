import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  type DialogProps,
} from '@/components/ui/dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from '../icons/icons';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import * as React from 'react';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'bg-popover text-popover-foreground bg-cmdkDark flex h-full w-full flex-col overflow-hidden rounded-lg',
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogTitle className="sr-only">Command</DialogTitle>
      <DialogDescription className="sr-only">Command</DialogDescription>
      <DialogContent
        showOverlay={true}
        className="w-full overflow-hidden rounded-xl border border-zinc-800 p-0 sm:max-w-xl [&>button:last-child]:hidden"
      >
        <div className="relative">
          <span className="absolute inset-x-0 top-0 mx-auto h-px w-[50%] bg-gradient-to-r from-transparent via-neutral-500 to-transparent"></span>
          <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2">
            {children}
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="border-input flex w-full items-center border-none px-5" cmdk-input-wrapper="">
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
>(({ className, ...props }, ref) => {
  const [selectedItemTop, setSelectedItemTop] = React.useState<number | null>(null);
  const [selectedItemHeight, setSelectedItemHeight] = React.useState<number>(80); // default height
  const [showGradient, setShowGradient] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateSelectedItemPosition = () => {
      if (!listRef.current) return;

      const selectedItem = listRef.current.querySelector('[data-selected="true"]');
      if (selectedItem) {
        const listRect = listRef.current.getBoundingClientRect();
        const itemRect = selectedItem.getBoundingClientRect();

        const relativeTop = itemRect.top - listRect.top + listRef.current.scrollTop;

        setSelectedItemTop(relativeTop);
        setSelectedItemHeight(itemRect.height);
        setShowGradient(true);
      } else {
        setShowGradient(false);
        setSelectedItemTop(null);
      }
    };

    updateSelectedItemPosition();

    const observer = new MutationObserver(updateSelectedItemPosition);
    if (listRef.current) {
      observer.observe(listRef.current, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-selected'],
        childList: true,
      });
    }

    const handleScroll = () => updateSelectedItemPosition();
    if (listRef.current) {
      listRef.current.addEventListener('scroll', handleScroll);
    }

    return () => {
      observer.disconnect();
      if (listRef.current) {
        listRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <div className="group relative" ref={listRef}>
      {showGradient && selectedItemTop !== null && (
        <motion.span
          className="absolute left-0 w-px bg-gradient-to-b from-transparent via-neutral-500 to-transparent"
          animate={{
            top: selectedItemTop,
            height: selectedItemHeight,
            opacity: 1,
          }}
          initial={{ opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 0.5,
          }}
        />
      )}
      <CommandPrimitive.List
        ref={ref}
        className={cn('max-h-80 overflow-y-auto overflow-x-hidden', className)}
        {...props}
      />
    </div>
  );
});

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
      'data-[selected=true]:text-accent-foreground relative flex cursor-default select-none items-center gap-4 rounded-md px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-[#222222] data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
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

const CommandFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-muted-foreground flex gap-4 border-t px-4 py-2 text-xs', className)}
      {...props}
    />
  ),
);
CommandFooter.displayName = 'CommandFooter';

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
  CommandFooter,
};
