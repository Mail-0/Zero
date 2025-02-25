"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEffect, useState } from "react";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps) {
  const [mounted, setMounted] = useState(false);

  // Fixes SSR hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const { theme, systemTheme, resolvedTheme, setTheme } = useTheme();

  async function handleThemeChange(newTheme: string) {
    let nextResolvedTheme = newTheme;

    if (newTheme === "system" && systemTheme) {
      nextResolvedTheme = systemTheme;
    }

    function update() {
      setTheme(newTheme);
    }

    if (document.startViewTransition && nextResolvedTheme !== resolvedTheme) {
      document.documentElement.style.viewTransitionName = "theme-transition";
      await document.startViewTransition(update).finished;
      document.documentElement.style.viewTransitionName = "";
    } else {
      update();
    }
  }

  if (!mounted) {
    return <div className="h-9" />;
  }

  return (
    <ToggleGroup
      type="single"
      className={cn("h-9 max-w-xs justify-start", className)}
      suppressHydrationWarning
      value={theme}
      onValueChange={handleThemeChange}
    >
      <ToggleGroupItem
        suppressHydrationWarning
        value="light"
        className="flex flex-1 items-center gap-2"
      >
        <Sun className="h-5 w-5" />
        <span className="sr-only">Light</span>
      </ToggleGroupItem>

      <ToggleGroupItem
        suppressHydrationWarning
        value="dark"
        className="flex flex-1 items-center gap-2"
      >
        <Moon className="h-5 w-5" />
        <span className="sr-only">Dark</span>
      </ToggleGroupItem>

      <ToggleGroupItem
        suppressHydrationWarning
        value="system"
        className="flex flex-1 items-center gap-2"
      >
        <Laptop className="h-5 w-5" />
        <span className="sr-only">System</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
