import { motion } from 'motion/react';
import React from 'react';

export const useSelectionTracking = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const [selectedItemTop, setSelectedItemTop] = React.useState<number | null>(null);
  const [selectedItemHeight, setSelectedItemHeight] = React.useState<number>(80);
  const [showGradient, setShowGradient] = React.useState(false);

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

    if (!containerRef.current) {
      setShowGradient(false);
      setSelectedItemTop(null);
      return;
    }

    const selectedItems = Array.from(
      containerRef.current.querySelectorAll('[data-selected="true"]'),
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

    const listRect = containerRef.current.getBoundingClientRect();
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
  }, [containerRef]);

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

    if (containerRef.current) {
      observer.observe(containerRef.current, {
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

    if (containerRef.current) {
      containerRef.current.addEventListener('scroll', handleScroll, { passive: true });
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

      if (containerRef.current) {
        containerRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [updateSelectedItemPosition, debouncedUpdate, containerRef]);

  return {
    selectedItemTop,
    selectedItemHeight,
    showGradient,
  };
};

interface SelectionGradientProps {
  showGradient: boolean;
  selectedItemTop: number | null;
  selectedItemHeight: number;
}

export const SelectionGradient: React.FC<SelectionGradientProps> = ({
  showGradient,
  selectedItemTop,
  selectedItemHeight,
}) => {
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
};
