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

  useEffect(() => {
    const current = onFilterChange ? activeFilter : internalActiveFilter;
    const idx = options.findIndex((option) => option.id === current);
    if (idx !== -1 && idx !== focusedIndex) {
      setFocusedIndex(idx);
    }
  }, [activeFilter, internalActiveFilter, options, onFilterChange]);

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

  const currentActiveFilter = onFilterChange ? activeFilter : internalActiveFilter;

  return (
    <div className={cn('text-muted-foreground flex gap-2 px-3 py-2 text-xs', className)}>
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
  );
};

export default FilterTabs;
