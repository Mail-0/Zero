import { useCommandPalette } from '@/components/context/command-palette-context';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useOptimisticActions } from './use-optimistic-actions';
import { useMail } from '@/components/mail/use-mail';
import { useHotkeys } from 'react-hotkeys-hook';
import { atom, useAtom } from 'jotai';
import { useQueryState } from 'nuqs';

export const focusedIndexAtom = atom<number | null>(null);
export const mailNavigationCommandAtom = atom<null | 'next' | 'previous'>(null);

export interface UseMailNavigationProps {
  items: { id: string }[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onNavigate: (threadId: string | null) => void;
}

export function useMailNavigation({ items, containerRef, onNavigate }: UseMailNavigationProps) {
  const [, setMail] = useMail();
  const [focusedIndex, setFocusedIndex] = useAtom(focusedIndexAtom);
  const [command, setCommand] = useAtom(mailNavigationCommandAtom);
  const { optimisticMarkAsRead } = useOptimisticActions();
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const [isCommandPaletteOpen] = useQueryState('isCommandPaletteOpen');
  
  // Track the previously focused thread ID to detect when it gets deleted
  const prevFocusedThreadId = useRef<string | null>(null);

  const hoveredMailRef = useRef<string | null>(null);
  const keyboardActiveRef = useRef(false);
  const lastMoveTime = useRef(0);

  useEffect(() => {
    if (!keyboardActiveRef.current) {
      //   setFocusedIndex(null);
    }
  }, [items, setFocusedIndex]);

  const resetNavigation = useCallback(() => {
    setFocusedIndex(null);
    onNavigateRef.current(null);
    keyboardActiveRef.current = false;
    prevFocusedThreadId.current = null;
  }, [setFocusedIndex, onNavigateRef]);

  const getThreadElement = useCallback(
    (index: number | null) => {
      if (index === null || !containerRef.current) return null;
      return containerRef.current.querySelector(
        `[data-thread-id="${itemsRef.current[index]?.id}"]`,
      ) as HTMLElement | null;
    },
    [containerRef],
  );

  const scrollIntoView = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const threadElement = getThreadElement(index);
      if (!threadElement || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const threadRect = threadElement.getBoundingClientRect();

      if (threadRect.top < containerRect.top || threadRect.bottom > containerRect.bottom) {
        threadElement.scrollIntoView({
          block: 'nearest',
          behavior,
        });
      }
    },
    [containerRef, getThreadElement],
  );

  const navigateToThread = useCallback(
    (index: number) => {
      if (index === null || !itemsRef.current[index]) return;

      const message = itemsRef.current[index];
      const threadId = message.id;

      // Update the tracked focused thread ID
      prevFocusedThreadId.current = threadId;

      const currentThreadId = window.location.search.includes('threadId=');
      if (currentThreadId) {
        onNavigateRef.current(threadId);
        optimisticMarkAsRead([threadId], true);
      }

      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    },
    [setMail],
  );

  const navigateNext = useCallback(() => {
    setFocusedIndex((prevIndex) => {
      if (prevIndex === null) {
        if (itemsRef.current.length > 0) {
          const firstItem = itemsRef.current[0];
          if (firstItem) {
            onNavigateRef.current(firstItem.id);
            prevFocusedThreadId.current = firstItem.id;
          }
          scrollIntoView(0, 'auto');
          return 0;
        }
        onNavigateRef.current(null);
        prevFocusedThreadId.current = null;
        return null;
      }

      // Current focused index is beyond the available items (thread was deleted)
      if (prevIndex >= itemsRef.current.length) {
        const newIndex = Math.max(0, itemsRef.current.length - 1);
        const nextItem = itemsRef.current[newIndex];
        if (nextItem) {
          onNavigateRef.current(nextItem.id);
          prevFocusedThreadId.current = nextItem.id;
          scrollIntoView(newIndex, 'auto');
          return newIndex;
        } else {
          onNavigateRef.current(null);
          prevFocusedThreadId.current = null;
          return null;
        }
      }

      // Check if the focused thread was deleted by comparing thread IDs
      const currentItem = itemsRef.current[prevIndex];
      const currentThreadId = currentItem?.id;
      const wasFocusedThreadDeleted = prevFocusedThreadId.current && 
        (!currentThreadId || currentThreadId !== prevFocusedThreadId.current);
      
      if (wasFocusedThreadDeleted) {
        // The focused thread was deleted, navigate to the same position
        // which now contains the next email in the list
        if (prevIndex < itemsRef.current.length) {
          const nextItem = itemsRef.current[prevIndex];
          if (nextItem) {
            onNavigateRef.current(nextItem.id);
            prevFocusedThreadId.current = nextItem.id;
            scrollIntoView(prevIndex, 'auto');
            return prevIndex;
          }
        }
        
        // If no item at current position, try the previous position
        if (prevIndex > 0) {
          const newIndex = prevIndex - 1;
          const nextItem = itemsRef.current[newIndex];
          if (nextItem) {
            onNavigateRef.current(nextItem.id);
            prevFocusedThreadId.current = nextItem.id;
            scrollIntoView(newIndex, 'auto');
            return newIndex;
          }
        }
        
        onNavigateRef.current(null);
        prevFocusedThreadId.current = null;
        return null;
      } else if (currentItem) {
        // Current item existts and wasnt deleted, then navigate to the next one
        if (prevIndex < itemsRef.current.length - 1) {
          const newIndex = prevIndex + 1;
          const nextItem = itemsRef.current[newIndex];
          if (nextItem) {
            onNavigateRef.current(nextItem.id);
            prevFocusedThreadId.current = nextItem.id;
          }
          scrollIntoView(newIndex, 'auto');
          return newIndex;
        } else {
          // we're at the end so stay at the current thread
          onNavigateRef.current(currentItem.id);
          prevFocusedThreadId.current = currentItem.id;
          scrollIntoView(prevIndex, 'auto');
          return prevIndex;
        }
      } else {
        // no current item so try to find any available thread
        if (itemsRef.current.length > 0) {
          const newIndex = Math.min(prevIndex, itemsRef.current.length - 1);
          const nextItem = itemsRef.current[newIndex];
          if (nextItem) {
            onNavigateRef.current(nextItem.id);
            prevFocusedThreadId.current = nextItem.id;
            scrollIntoView(newIndex, 'auto');
            return newIndex;
          }
        }
        
        // 0 threads available
        onNavigateRef.current(null);
        prevFocusedThreadId.current = null;
        return null;
      }
    });
  }, [onNavigateRef, scrollIntoView, setFocusedIndex]);

  useEffect(() => {
    if (command === 'next') {
      navigateNext();
      setCommand(null);
    }
  }, [command, navigateNext, setCommand]);

  const getHoveredIndex = useCallback(() => {
    if (!hoveredMailRef.current) return -1;
    return itemsRef.current.findIndex((item) => item.id === hoveredMailRef.current);
  }, []);

  const moveFocus = useCallback(
    (direction: 'up' | 'down') => {
      keyboardActiveRef.current = true;

      setFocusedIndex((prevIndex) => {
        let newIndex: number;
        if (prevIndex === null) {
          const hoveredIndex = getHoveredIndex();
          if (hoveredIndex !== -1) {
            newIndex = hoveredIndex;
          } else {
            newIndex = direction === 'up' ? itemsRef.current.length - 1 : 0;
          }
        } else {
          newIndex =
            direction === 'up'
              ? Math.max(0, prevIndex - 1)
              : Math.min(itemsRef.current.length - 1, prevIndex + 1);
        }

        if (newIndex === prevIndex && prevIndex !== null) return prevIndex;

        scrollIntoView(newIndex, 'smooth');
        navigateToThread(newIndex);
        return newIndex;
      });
    },
    [setFocusedIndex, getHoveredIndex, scrollIntoView, navigateToThread],
  );

  const handleArrowUp = useCallback(() => {
    moveFocus('up');
  }, [moveFocus]);

  const handleArrowDown = useCallback(() => {
    moveFocus('down');
  }, [moveFocus]);

  const handleEnter = useCallback(() => {
    if (focusedIndex === null) return;

    const message = itemsRef.current[focusedIndex];
    if (message) {
      onNavigateRef.current(message.id);
      prevFocusedThreadId.current = message.id;
    }
  }, [focusedIndex]);

  const handleEscape = useCallback(() => {
    setFocusedIndex(null);
    onNavigateRef.current(null);
    keyboardActiveRef.current = false;
    prevFocusedThreadId.current = null;
  }, [setFocusedIndex, onNavigateRef]);

  useHotkeys('ArrowUp', handleArrowUp, { preventDefault: true, enabled: !isCommandPaletteOpen });
  useHotkeys('ArrowDown', handleArrowDown, { preventDefault: true, enabled: !isCommandPaletteOpen });
  useHotkeys('j', handleArrowDown, { enabled: !isCommandPaletteOpen });
  useHotkeys('k', handleArrowUp, { enabled: !isCommandPaletteOpen });
  useHotkeys('Enter', handleEnter, { preventDefault: true,enabled: !isCommandPaletteOpen });
  useHotkeys('Escape', handleEscape, { preventDefault: true,enabled: !isCommandPaletteOpen });

  const handleMouseEnter = useCallback(
    (threadId: string) => {
      hoveredMailRef.current = threadId;

      if (keyboardActiveRef.current) {
        // setFocusedIndex(null);
        keyboardActiveRef.current = false;
      }
    },
    [setFocusedIndex],
  );

  const fastScroll = useCallback(
    (direction: 'up' | 'down') => {
      setFocusedIndex((prev) => {
        const { length } = itemsRef.current;
        const newIndex =
          direction === 'up'
            ? prev === null
              ? length - 1
              : Math.max(0, prev - 1)
            : prev === null
              ? 0
              : Math.min(length - 1, prev + 1);

        if (newIndex !== prev || prev === null) {
          scrollIntoView(newIndex, 'auto');
        }
        return newIndex;
      });
    },
    [scrollIntoView, setFocusedIndex],
  );

  useEffect(() => {
    let isProcessingKey = false;
    const MOVE_DELAY = 100;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCommandPaletteOpen) return;
      if (!event.repeat) return;
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

      event.preventDefault();

      const now = Date.now();
      if (now - lastMoveTime.current < MOVE_DELAY) return;

      if (isProcessingKey) return;
      isProcessingKey = true;
      lastMoveTime.current = now;

      requestAnimationFrame(() => {
        if (event.key === 'ArrowUp') {
          fastScroll('up');
        } else if (event.key === 'ArrowDown') {
          fastScroll('down');
        }
        isProcessingKey = false;
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fastScroll, isCommandPaletteOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      keyboardActiveRef.current = false;
    }
  }, [isCommandPaletteOpen]);

  return {
    focusedIndex,
    handleMouseEnter,
    keyboardActive: keyboardActiveRef.current,
    resetNavigation,
  };
}
