import { MoonIcon } from '@/components/icons/animated/moon';
import { SunIcon } from '@/components/icons/animated/sun';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const [isRendered, setIsRendered] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => setIsRendered(true), []);

  async function handleThemeToggle() {
    const newTheme = theme === 'dark' ? 'light' : 'dark';

    function update() {
      setTheme(newTheme);
    }

    if (document.startViewTransition && newTheme !== resolvedTheme) {
      document.documentElement.style.viewTransitionName = 'theme-transition';
      await document.startViewTransition(update).finished;
      document.documentElement.style.viewTransitionName = '';
    } else {
      update();
    }
  }

  if (!isRendered) return null;

  return (
    <button
      onClick={handleThemeToggle}
      className={`flex items-center rounded-md p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white ${className}`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <MoonIcon className="opacity-60" /> : <SunIcon className="opacity-60" />}
      {showLabel && <span className="ml-2 text-sm">Toggle theme</span>}
    </button>
  );
}
