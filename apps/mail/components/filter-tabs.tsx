import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Info, MailIcon, SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  activeColors?: {
    bg: string;
    text: string;
  };
}

interface FilterTabsProps {
  options?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  onHelpClick?: () => void;
  className?: string;
}

const DEFAULT_FILTERS: FilterOption[] = [
  {
    id: 'all',
    label: 'All',
    activeColors: {
      bg: '#10243E',
      text: '#52A9FF',
    },
  },
  {
    id: 'mail',
    label: 'Mail',
    icon: MailIcon,
    activeColors: {
      bg: '#0F2C17',
      text: '#63C174',
    },
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    activeColors: {
      bg: '#432155',
      text: '#BF7AF0',
    },
  },
  {
    id: 'help',
    label: 'Help',
    icon: Info,
    activeColors: {
      bg: '#FFFFFF16',
      text: '#FFFFFF9C',
    },
  },
];

const FilterTabs: React.FC<FilterTabsProps> = ({
  options = DEFAULT_FILTERS,
  activeFilter = 'all',
  onFilterChange,
  onHelpClick,
  className,
}) => {
  const [internalActiveFilter, setInternalActiveFilter] = useState(activeFilter);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleFilterClick = useCallback(
    (filterId: string) => {
      if (filterId === 'help' && onHelpClick) {
        onHelpClick();
        return;
      }
      if (onFilterChange) {
        onFilterChange(filterId);
      } else {
        setInternalActiveFilter(filterId);
      }
    },
    [onFilterChange, onHelpClick],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        const nextIndex = (focusedIndex + direction + options.length) % options.length;
        setFocusedIndex(nextIndex);
        buttonRefs.current[nextIndex]?.focus();
        handleFilterClick(options[nextIndex].id);
      }
    },
    [focusedIndex, options, handleFilterClick],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentActiveFilter = onFilterChange ? activeFilter : internalActiveFilter;

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="text-muted-foreground flex gap-2 px-3 py-2 text-xs">
        {options.map((option, index) => {
          const isActive = currentActiveFilter === option.id;
          const isFocused = focusedIndex === index;
          const IconComponent = option.icon;

          const customStyles =
            isActive && option.activeColors
              ? { backgroundColor: option.activeColors.bg, color: option.activeColors.text }
              : {};

          return (
            <button
              key={option.id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              className={cn(
                'rounded-md px-2 py-1 outline-none transition-colors duration-200 focus:outline-none',
                isFocused || isActive ? 'bg-[#333]' : 'bg-[#222] hover:bg-[#333]',
                isActive ? '' : 'text-muted-foreground',
              )}
              style={customStyles}
              onClick={() => {
                handleFilterClick(option.id);
                setFocusedIndex(index);
              }}
              onFocus={() => setFocusedIndex(index)}
            >
              {IconComponent ? (
                <span className="flex items-center gap-1">
                  <IconComponent className="size-3" />
                  <span>{option.label}</span>
                </span>
              ) : (
                option.label
              )}
            </button>
          );
        })}
      </div>
      <kbd className="flex items-center gap-1 px-3">
        <span className="bg-muted pointer-events-none hidden h-[1.375rem] select-none flex-row items-center gap-1 rounded-md border-none px-1 text-xs font-medium !leading-[0] opacity-100 sm:flex dark:bg-[#262626] dark:text-[#929292]">
          {'tab'}
        </span>
      </kbd>
    </div>
  );
};

export default FilterTabs;
