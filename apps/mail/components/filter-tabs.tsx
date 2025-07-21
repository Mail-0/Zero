import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Info, MailIcon, SettingsIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface FilterOption {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  activeColors?: {
    light: { bg: string; text: string };
    dark: { bg: string; text: string };
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
      light: { bg: '#E3F0FF', text: '#175CD3' },
      dark: { bg: '#10243E', text: '#52A9FF' },
    },
  },
  {
    id: 'mail',
    label: 'Mail',
    icon: MailIcon,
    activeColors: {
      light: { bg: '#E6F5EC', text: '#039855' },
      dark: { bg: '#0F2C17', text: '#63C174' },
    },
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    activeColors: {
      light: { bg: '#F3E8FF', text: '#7F56D9' },
      dark: { bg: '#432155', text: '#BF7AF0' },
    },
  },
  {
    id: 'help',
    label: 'Help',
    icon: Info,
    activeColors: {
      light: { bg: '#F9FAFB', text: '#667085' },
      dark: { bg: '#FFFFFF16', text: '#FFFFFF9C' },
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
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!onFilterChange) {
      setInternalActiveFilter(activeFilter);
    }
  }, [activeFilter, onFilterChange]);

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

        let customStyles = {};
        if (isActive && option.activeColors) {
          const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
          customStyles = {
            backgroundColor: option.activeColors[mode].bg,
            color: option.activeColors[mode].text,
          };
        }

        return (
          <button
            key={option.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            className={cn(
              'rounded-md px-2 py-1 outline-none transition-colors duration-200 focus:outline-none',
              isFocused || isActive
                ? 'dark:bg-[#333]'
                : 'bg-offsetLight hover:bg-subtleWhite dark:bg-[#222] dark:hover:bg-[#333]',
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
