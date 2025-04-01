import { useCallback, useEffect, useState, useRef } from 'react';
import { useMail } from '@/components/mail/use-mail';
import { useHotKey } from './use-hot-key';
import type { InitialThread } from '@/types';

export interface UseMailNavigationProps {
  items: InitialThread[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onNavigate: (threadId: string) => void;
}

export function useMailNavigation({ items, containerRef, onNavigate }: UseMailNavigationProps) {
  const [, setMail] = useMail();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isQuickActionMode, setIsQuickActionMode] = useState(false);
  const [quickActionIndex, setQuickActionIndex] = useState(0);
  const hoveredMailRef = useRef<string | null>(null);
  const keyboardActiveRef = useRef(false);
  
  useEffect(() => {
    if (!keyboardActiveRef.current) {
      setFocusedIndex(null);
    }
  }, [items]);

  const resetNavigation = useCallback(() => {
    setFocusedIndex(null);
    setIsQuickActionMode(false);
    setQuickActionIndex(0);
    keyboardActiveRef.current = false;
  }, []);

  const getThreadElement = useCallback((index: number | null) => {
    if (index === null || !containerRef.current) return null;
    return containerRef.current.querySelector(`[data-thread-id="${items[index]?.id}"]`) as HTMLElement | null;
  }, [containerRef, items]);
  
  const scrollIntoView = useCallback((index: number) => {
    const threadElement = getThreadElement(index);
    if (!threadElement || !containerRef.current) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const threadRect = threadElement.getBoundingClientRect();
    
    if (threadRect.top < containerRect.top || threadRect.bottom > containerRect.bottom) {
      threadElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [containerRef, getThreadElement]);

  const navigateToThread = useCallback((index: number) => {
    if (index === null || !items[index]) return;
    
    const message = items[index];
    const threadId = message.threadId ?? message.id;
    
    onNavigate(threadId);
    
    setMail((prev) => ({
      ...prev,
      bulkSelected: [],
    }));
  }, [items, onNavigate, setMail]);

  const getHoveredIndex = useCallback(() => {
    if (!hoveredMailRef.current) return -1;
    return items.findIndex(item => item.id === hoveredMailRef.current);
  }, [items]);

  const handleArrowUp = useCallback((event?: KeyboardEvent) => {
    event?.preventDefault();
    keyboardActiveRef.current = true;
    
    if (isQuickActionMode) return;
    
    setFocusedIndex(prevIndex => {
      if (prevIndex === null) {
        const hoveredIndex = getHoveredIndex();
        if (hoveredIndex !== -1) {
          scrollIntoView(hoveredIndex);
          return hoveredIndex;
        }
        return items.length - 1;
      }
      
      const newIndex = Math.max(0, prevIndex - 1);
      scrollIntoView(newIndex);
      return newIndex;
    });
  }, [isQuickActionMode, items.length, scrollIntoView, getHoveredIndex]);

  const handleArrowDown = useCallback((event?: KeyboardEvent) => {
    event?.preventDefault();
    keyboardActiveRef.current = true;
    
    if (isQuickActionMode) return;
    
    setFocusedIndex(prevIndex => {
      if (prevIndex === null) {
        const hoveredIndex = getHoveredIndex();
        if (hoveredIndex !== -1) {
          scrollIntoView(hoveredIndex);
          return hoveredIndex;
        }
        return 0;
      }
      
      const newIndex = Math.min(items.length - 1, prevIndex + 1);
      scrollIntoView(newIndex);
      return newIndex;
    });
  }, [isQuickActionMode, items.length, scrollIntoView, getHoveredIndex]);

  const handleEnter = useCallback((event?: KeyboardEvent) => {
    event?.preventDefault();
    if (focusedIndex === null) return;
    
    if (isQuickActionMode) {
      const threadElement = getThreadElement(focusedIndex);
      if (threadElement) {
        const quickActionButtons = threadElement.querySelectorAll('.mail-quick-action-button');
        const selectedButton = quickActionButtons[quickActionIndex] as HTMLButtonElement;
        if (selectedButton) selectedButton.click();
      }
      return;
    }
    
    navigateToThread(focusedIndex);
  }, [focusedIndex, isQuickActionMode, getThreadElement, navigateToThread, quickActionIndex]);

  const handleTab = useCallback((event?: KeyboardEvent) => {
    event?.preventDefault();
    if (focusedIndex === null) return;
    
    setIsQuickActionMode(prev => !prev);
    setQuickActionIndex(0);
  }, [focusedIndex]);

  const handleArrowRight = useCallback((event?: KeyboardEvent) => {
    event?.preventDefault();
    if (!isQuickActionMode || focusedIndex === null) return;
    
    const threadElement = getThreadElement(focusedIndex);
    if (threadElement) {
      const quickActionButtons = threadElement.querySelectorAll('.mail-quick-action-button');
      setQuickActionIndex(prev => Math.min(prev + 1, quickActionButtons.length - 1));
    }
  }, [focusedIndex, isQuickActionMode, getThreadElement]);

  const handleArrowLeft = useCallback((event?: KeyboardEvent) => {
    event?.preventDefault();
    if (!isQuickActionMode || focusedIndex === null) return;
    
    setQuickActionIndex(prev => Math.max(prev - 1, 0));
  }, [focusedIndex, isQuickActionMode]);

  const handleEscape = useCallback((event?: KeyboardEvent) => {
    event?.preventDefault();
    
    if (isQuickActionMode) {
      setIsQuickActionMode(false);
      return;
    }
    
    setFocusedIndex(null);
    keyboardActiveRef.current = false;
  }, [isQuickActionMode]);

  useHotKey('ArrowUp', handleArrowUp);
  useHotKey('ArrowDown', handleArrowDown);
  useHotKey('Enter', handleEnter);
  useHotKey('Tab', handleTab);
  useHotKey('ArrowRight', handleArrowRight);
  useHotKey('ArrowLeft', handleArrowLeft);
  useHotKey('Escape', handleEscape);

  const handleMouseEnter = useCallback((threadId: string) => {
    hoveredMailRef.current = threadId;
    
    if (keyboardActiveRef.current) {
      setFocusedIndex(null);
      keyboardActiveRef.current = false;
    }
  }, []);

  return {
    focusedIndex,
    isQuickActionMode,
    quickActionIndex,
    handleMouseEnter,
    keyboardActive: keyboardActiveRef.current,
    resetNavigation
  };
} 