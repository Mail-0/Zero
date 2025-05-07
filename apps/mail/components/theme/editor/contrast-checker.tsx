import React, { useState } from "react";
import { useContrastChecker } from "@/components/theme/hooks/use-contrast-checker";
import type { ThemeStyleProps } from "@/types/theme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Contrast, Check, AlertTriangle, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/providers/theme-providers";


type ContrastCheckerProps = {
  currentStyles: ThemeStyleProps;
};

const MIN_CONTRAST_RATIO = 4.5;

type ColorCategory = "content" | "interactive" | "functional";

type ColorPair = {
  id: string;
  foregroundId: keyof ThemeStyleProps;
  backgroundId: keyof ThemeStyleProps;
  foreground: string | undefined;
  background: string | undefined;
  label: string;
  category: ColorCategory;
};

const ContrastChecker = ({ currentStyles }: ContrastCheckerProps) => {
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const { theme, toggleTheme } = useTheme();

  const colorPairsToCheck: ColorPair[] = [
    // Content - Base, background, cards, containers
    {
      id: "base",
      foregroundId: "foreground",
      backgroundId: "background",
      foreground: currentStyles?.["foreground"],
      background: currentStyles?.["background"],
      label: "Base",
      category: "content",
    },
    {
      id: "card",
      foregroundId: "card-foreground",
      backgroundId: "card",
      foreground: currentStyles?.["card-foreground"],
      background: currentStyles?.["card"],
      label: "Card",
      category: "content",
    },
    {
      id: "popover",
      foregroundId: "popover-foreground",
      backgroundId: "popover",
      foreground: currentStyles?.["popover-foreground"],
      background: currentStyles?.["popover"],
      label: "Popover",
      category: "content",
    },
    {
      id: "muted",
      foregroundId: "muted-foreground",
      backgroundId: "muted",
      foreground: currentStyles?.["muted-foreground"],
      background: currentStyles?.["muted"],
      label: "Muted",
      category: "content",
    },

    // Interactive - Buttons, links, actions
    {
      id: "primary",
      foregroundId: "primary-foreground",
      backgroundId: "primary",
      foreground: currentStyles?.["primary-foreground"],
      background: currentStyles?.["primary"],
      label: "Primary",
      category: "interactive",
    },
    {
      id: "secondary",
      foregroundId: "secondary-foreground",
      backgroundId: "secondary",
      foreground: currentStyles?.["secondary-foreground"],
      background: currentStyles?.["secondary"],
      label: "Secondary",
      category: "interactive",
    },
    {
      id: "accent",
      foregroundId: "accent-foreground",
      backgroundId: "accent",
      foreground: currentStyles?.["accent-foreground"],
      background: currentStyles?.["accent"],
      label: "Accent",
      category: "interactive",
    },

    // Functional - Sidebar, destructive, special purposes
    {
      id: "destructive",
      foregroundId: "destructive-foreground",
      backgroundId: "destructive",
      foreground: currentStyles?.["destructive-foreground"],
      background: currentStyles?.["destructive"],
      label: "Destructive",
      category: "functional",
    },
    {
      id: "sidebar",
      foregroundId: "sidebar-foreground",
      backgroundId: "sidebar",
      foreground: currentStyles?.["sidebar-foreground"],
      background: currentStyles?.["sidebar"],
      label: "Sidebar Base",
      category: "functional",
    },
    {
      id: "sidebar-primary",
      foregroundId: "sidebar-primary-foreground",
      backgroundId: "sidebar-primary",
      foreground: currentStyles?.["sidebar-primary-foreground"],
      background: currentStyles?.["sidebar-primary"],
      label: "Sidebar Primary",
      category: "functional",
    },
    {
      id: "sidebar-accent",
      foregroundId: "sidebar-accent-foreground",
      backgroundId: "sidebar-accent",
      foreground: currentStyles?.["sidebar-accent-foreground"],
      background: currentStyles?.["sidebar-accent"],
      label: "Sidebar Accent",
      category: "functional",
    },
  ];

  const validColorPairsToCheck = colorPairsToCheck.filter(
    (pair): pair is ColorPair & { foreground: string; background: string } =>
      !!pair.foreground && !!pair.background
  );
  const contrastResults = useContrastChecker(validColorPairsToCheck);

  const getContrastResult = (pairId: string) => {
    return contrastResults?.find((res) => res.id === pairId);
  };

  const totalIssues = contrastResults?.filter(
    (result) => result.contrastRatio < MIN_CONTRAST_RATIO
  ).length;

  const filteredPairs =
    filter === "all"
      ? colorPairsToCheck
      : colorPairsToCheck.filter((pair) => {
          const result = getContrastResult(pair.id);
          return result && result.contrastRatio < MIN_CONTRAST_RATIO;
        });

  // Group color pairs by category
  const categoryLabels: Record<ColorCategory, string> = {
    content: "Content & Containers",
    interactive: "Interactive Elements",
    functional: "Navigation & Functional",
  };

  const categories: ColorCategory[] = ["content", "interactive", "functional"];
  const groupedPairs = categories
    .map((category) => ({
      category,
      label: categoryLabels[category],
      pairs: filteredPairs.filter((pair) => pair.category === category),
    }))
    .filter((group) => group.pairs.length > 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2 w-full justify-start">
          <Contrast className="h-4 w-4" />
          <span className="text-sm hidden md:block">Contrast</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0 py-6 overflow-hidden rounded-lg border shadow-lg gap-6 flex flex-col">
        <div className="flex justify-between items-end px-6 sm:flex-row flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Contrast Checker</DialogTitle>
            <DialogDescription>
              WCAG 2.0 AA requires a contrast ratio of at least {MIN_CONTRAST_RATIO}:1{" • "}
              <a
                href="https://www.w3.org/TR/WCAG21/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:text-primary/80 transition-colors"
              >
                Learn more
              </a>
            </DialogDescription>
          </DialogHeader>

          <div className="items-center gap-2 hidden md:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
                >
                  {theme === "light" ? (
                    <Sun className="h-3.5 w-3.5" />
                  ) : (
                    <Moon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Toggle theme</p>
              </TooltipContent>
            </Tooltip>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "issues" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("issues")}
            >
              <AlertTriangle className={cn("h-3 w-3 mr-1")} />
              Issues ({totalIssues})
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 relative flex flex-col">
          <div className="space-y-6 px-6">
            {groupedPairs.map((group) => (
              <div key={group.category} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-md font-semibold">{group.label}</h2>
                  <Separator className="flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.pairs.map((pair) => {
                    const result = getContrastResult(pair.id);
                    const isValid =
                      result?.contrastRatio !== undefined &&
                      result?.contrastRatio >= MIN_CONTRAST_RATIO;
                    const contrastRatio =
                      result?.contrastRatio?.toFixed(2) ?? "N/A";

                    return (
                      <Card
                        key={pair.id}
                        className={cn(
                          "transition-all duration-200",
                          !isValid && " border-dashed"
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3
                              className={cn(
                                "font-medium flex items-center",
                                !isValid && "text-destructive"
                              )}
                            >
                              {pair.label}
                              {!isValid && (
                                <AlertTriangle className="size-3.5 ml-1" />
                              )}
                            </h3>
                            <Badge
                              variant={isValid ? "default" : "destructive"}
                              className={cn(
                                "flex items-center gap-1 text-xs",
                                isValid
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-destructive text-destructive-foreground"
                              )}
                            >
                              {isValid ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  {contrastRatio}
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3 w-3" />
                                  {contrastRatio}
                                </>
                              )}
                            </Badge>
                          </div>

                          <div className="flex gap-2 items-center">
                            <div className="flex flex-col items-center gap-3 flex-1">
                              <div className="flex w-full items-center gap-3">
                                <div
                                  style={{
                                    backgroundColor:
                                      pair.background ?? "#000000",
                                  }}
                                  className="h-12 w-12 rounded-md border shadow-sm flex-shrink-0"
                                ></div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">
                                    Background
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {pair.background}
                                  </span>
                                </div>
                              </div>

                              <div className="flex w-full items-center gap-3">
                                <div
                                  style={{
                                    backgroundColor:
                                      pair.foreground ?? "#ffffff",
                                  }}
                                  className="h-12 w-12 rounded-md border shadow-sm flex-shrink-0"
                                ></div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">
                                    Foreground
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {pair.foreground}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                backgroundColor:
                                  pair.background ?? "transparent",
                              }}
                              className="flex-1 h-full min-h-[120px] rounded-lg border shadow-sm flex items-center justify-center overflow-hidden"
                            >
                              {pair.foreground && pair.background ? (
                                <div className="text-center p-4">
                                  <p
                                    style={{ color: pair.foreground }}
                                    className="text-4xl font-bold tracking-wider mb-2"
                                  >
                                    Aa
                                  </p>
                                  <p
                                    style={{ color: pair.foreground }}
                                    className="text-sm font-medium"
                                  >
                                    Sample Text
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Preview
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ContrastChecker;
