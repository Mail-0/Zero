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
      'bg-popover text-popover-foreground dark:bg-cmdkDark bg-lightBackground flex h-full w-full flex-col overflow-hidden rounded-lg',
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
        positioning="custom"
        className={cn(
          'left-[50%] top-[20%]',
          'data-[state=closed]:slide-out-to-top-[4%]',
          'data-[state=open]:slide-in-from-top-[4%]',
          'w-full overflow-hidden rounded-xl border border-zinc-200 p-0 sm:max-w-xl dark:border-zinc-800 [&>button:last-child]:hidden',
        )}
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
  const [selectedItemHeight, setSelectedItemHeight] = React.useState<number>(80);
  const [showGradient, setShowGradient] = React.useState(false);
  const listScrollableRef = React.useRef<HTMLDivElement>(null);

  const mousePositionRef = React.useRef({ x: 0, y: 0 });

  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const selectedItemsCache = React.useRef<Element[]>([]);
  const lastUpdateTime = React.useRef<number>(0);

  const updateSelectedItemPosition = React.useCallback(() => {
    const now = Date.now();

    if (now - lastUpdateTime.current < 16) {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(updateSelectedItemPosition, 16);
      return;
    }

    lastUpdateTime.current = now;

    if (!listScrollableRef.current) {
      setShowGradient(false);
      setSelectedItemTop(null);
      return;
    }

    const selectedItems = Array.from(
      listScrollableRef.current.querySelectorAll('[data-selected="true"]'),
    );

    if (selectedItems.length === 0) {
      setShowGradient(false);
      setSelectedItemTop(null);
      selectedItemsCache.current = [];
      return;
    }

    const itemsChanged =
      selectedItems.length !== selectedItemsCache.current.length ||
      selectedItems.some((item, index) => item !== selectedItemsCache.current[index]);

    if (itemsChanged) {
      selectedItemsCache.current = selectedItems;
    }

    let actualSelectedItem = selectedItems[0];

    const focusedItem = selectedItems.find(
      (item) =>
        item === document.activeElement ||
        item.getAttribute('aria-current') === 'true' ||
        item.closest('[role="option"][aria-selected="true"]') === item,
    );

    if (focusedItem) {
      actualSelectedItem = focusedItem;
    } else if (selectedItems.length > 1) {
      const { y: mouseY } = mousePositionRef.current;
      let closestItem = selectedItems[0];
      let closestDistance = Infinity;

      selectedItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;
        const distance = Math.abs(mouseY - itemCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestItem = item;
        }
      });

      actualSelectedItem = closestItem;
    }

    const listRect = listScrollableRef.current.getBoundingClientRect();
    const itemRect = actualSelectedItem.getBoundingClientRect();
    const relativeTop = itemRect.top - listRect.top;

    const isWithinVerticalBounds = itemRect.bottom > listRect.top && itemRect.top < listRect.bottom;
    const isWithinHorizontalBounds =
      itemRect.right > listRect.left && itemRect.left < listRect.right;
    const isWithinContainerBounds = isWithinVerticalBounds && isWithinHorizontalBounds;
    const isItemVisibleInScrollView = relativeTop >= 0;

    if (!isWithinContainerBounds || !isItemVisibleInScrollView) {
      setShowGradient(false);
      setSelectedItemTop(null);
      return;
    }

    const itemCenterY = itemRect.top + itemRect.height / 2;
    const itemCenterX = itemRect.left + itemRect.width / 2;

    const isActuallyVisible =
      itemCenterY >= listRect.top &&
      itemCenterY <= listRect.bottom &&
      itemCenterX >= listRect.left &&
      itemCenterX <= listRect.right;

    if (isActuallyVisible && relativeTop + itemRect.height > 0 && relativeTop < listRect.height) {
      React.startTransition(() => {
        setSelectedItemTop(relativeTop);
        setSelectedItemHeight(itemRect.height);
        setShowGradient(true);
      });
    } else {
      React.startTransition(() => {
        setShowGradient(false);
        setSelectedItemTop(null);
      });
    }
  }, []);

  const debouncedUpdate = React.useCallback(() => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(updateSelectedItemPosition, 10);
  }, [updateSelectedItemPosition]);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
      debouncedUpdate();
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    updateSelectedItemPosition();

    const observer = new MutationObserver((mutations) => {
      const hasRelevantChanges = mutations.some(
        (mutation) =>
          (mutation.type === 'attributes' &&
            (mutation.attributeName === 'data-selected' ||
              mutation.attributeName === 'aria-selected' ||
              mutation.attributeName === 'aria-current')) ||
          mutation.type === 'childList',
      );

      if (hasRelevantChanges) {
        debouncedUpdate();
      }
    });

    if (listScrollableRef.current) {
      observer.observe(listScrollableRef.current, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-selected', 'aria-selected', 'aria-current'],
        childList: true,
      });
    }

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateSelectedItemPosition, 8);
    };

    if (listScrollableRef.current) {
      listScrollableRef.current.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      observer.disconnect();
      document.removeEventListener('mousemove', handleMouseMove);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      if (listScrollableRef.current) {
        listScrollableRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [updateSelectedItemPosition, debouncedUpdate]);

  const gradientElement = React.useMemo(() => {
    if (!showGradient || selectedItemTop === null) return null;

    return (
      <motion.span
        className="pointer-events-none absolute left-0 z-10 w-px bg-gradient-to-b from-transparent via-neutral-500 to-transparent"
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
    );
  }, [showGradient, selectedItemTop, selectedItemHeight]);

  return (
    <div className="group relative">
      {gradientElement}
      <CommandPrimitive.List
        ref={(node) => {
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          listScrollableRef.current = node;
        }}
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
      'data-[selected=true]:text-accent-foreground data-[selected=true]:bg-subtleWhite dark:data-[selected=true]:bg-cmdkDarkSelected relative flex cursor-default select-none items-center gap-4 rounded-md px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
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
