import { useCallback, useEffect, useState, useRef } from 'react';
import { useOptimisticActions } from './use-optimistic-actions';
import { useMail } from '@/components/mail/use-mail';
import { useHotkeys } from 'react-hotkeys-hook';
import { atom, useAtom } from 'jotai';

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
          }
          scrollIntoView(0, 'auto');
          return 0;
        }
        onNavigateRef.current(null);
        return null;
      }

      if (prevIndex < itemsRef.current.length - 1) {
        const newIndex = prevIndex;
        const nextItem = itemsRef.current[prevIndex + 1];
        if (nextItem) {
          onNavigateRef.current(nextItem.id);
        }
        scrollIntoView(newIndex, 'auto');
        return newIndex;
      } else {
        const newIndex = itemsRef.current.length > 1 ? prevIndex - 1 : null;

        if (newIndex !== null) {
          const nextItem = itemsRef.current[newIndex];
          if (nextItem) {
            onNavigateRef.current(nextItem.id);
          }
          scrollIntoView(newIndex, 'auto');
          return newIndex;
        } else {
          onNavigateRef.current(null);
          return null;
        }
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
    if (message) onNavigateRef.current(message.id);
  }, [focusedIndex]);

  const handleEscape = useCallback(() => {
    setFocusedIndex(null);
    onNavigateRef.current(null);
    keyboardActiveRef.current = false;
  }, [setFocusedIndex, onNavigateRef]);

  useHotkeys('ArrowUp', handleArrowUp, { preventDefault: true });
  useHotkeys('ArrowDown', handleArrowDown, { preventDefault: true });
  useHotkeys('j', handleArrowDown);
  useHotkeys('k', handleArrowUp);
  useHotkeys('Enter', handleEnter, { preventDefault: true });
  useHotkeys('Escape', handleEscape, { preventDefault: true });

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
  }, [fastScroll]);

  return {
    focusedIndex,
    handleMouseEnter,
    keyboardActive: keyboardActiveRef.current,
    resetNavigation,
  };
}
