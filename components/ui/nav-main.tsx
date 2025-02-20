"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import * as React from "react";
import Link from "next/link";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarGroupLabel,
  SidebarMenuButton,
} from "./sidebar";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BASE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  ref?: React.Ref<SVGSVGElement>;
  startAnimation?: () => void;
  stopAnimation?: () => void;
}

interface NavItemProps {
  title: string;
  url: string;
  icon?: React.ComponentType<IconProps>;
  badge?: number;
  isActive?: boolean;
  isExpanded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  suffix?: React.ComponentType<IconProps>;
  isBackButton?: boolean;
  isSettingsButton?: boolean;
  isSettingsPage?: boolean;
}

interface NavMainProps {
  items: {
    title: string;
    items: NavItemProps[];
    isActive?: boolean;
  }[];
}

type IconRefType = SVGSVGElement & {
  startAnimation?: () => void;
  stopAnimation?: () => void;
};

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getHref = useCallback(
    (item: NavItemProps) => {
      // Get the current 'from' parameter
      const currentFrom = searchParams.get("from");
      const category = searchParams.get("category");

      // Handle settings navigation
      if (item.isSettingsButton) {
        // Include current path with category query parameter if present
        const currentPath = category
          ? `${pathname}?category=${encodeURIComponent(category)}`
          : pathname;
        return `${item.url}?from=${encodeURIComponent(currentPath)}`;
      }

      // Handle settings pages navigation
      if (item.isSettingsPage && currentFrom) {
        return `${item.url}?from=${encodeURIComponent(currentFrom)}`;
      }

      // Handle back button
      if (item.isBackButton) {
        return currentFrom ? decodeURIComponent(currentFrom) : "/mail";
      }

      // Handle category links
      if (category && item.url.includes("category=")) {
        return item.url;
      }

      return item.url;
    },
    [pathname, searchParams],
  );

  const isUrlActive = useCallback(
    (url: string) => {
      const urlObj = new URL(
        url,
        typeof window === "undefined" ? BASE_URL : window.location.origin,
      );
      const cleanPath = pathname.replace(/\/$/, "");
      const cleanUrl = urlObj.pathname.replace(/\/$/, "");

      if (cleanPath !== cleanUrl) return false;

      const urlParams = new URLSearchParams(urlObj.search);
      const currentParams = new URLSearchParams(searchParams);

      for (const [key, value] of urlParams) {
        if (currentParams.get(key) !== value) return false;
      }
      return true;
    },
    [pathname, searchParams],
  );

  return (
    <SidebarGroup className="space-y-2.5 py-0">
      <SidebarMenu className="space-y-3">
        {items.map((section) => (
          <Collapsible
            key={section.title}
            defaultOpen={section.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                {section.title && (
                  <SidebarGroupLabel className="mb-2">{section.title}</SidebarGroupLabel>
                )}
              </CollapsibleTrigger>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavItem
                    key={item.url}
                    {...item}
                    isActive={isUrlActive(item.url)}
                    href={getHref(item)}
                  />
                ))}
              </div>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavItem(item: NavItemProps & { href: string }) {
  const iconRef = useRef<IconRefType>(null);
  return (
    <Collapsible defaultOpen={item.isActive}>
      <CollapsibleTrigger asChild>
        <Link
          href={item.href}
          onClick={item.onClick}
          onMouseEnter={() => iconRef.current?.startAnimation?.()}
          onMouseLeave={() => iconRef.current?.stopAnimation?.()}
        >
          <SidebarMenuButton
            tooltip={item.title}
            className={cn("flex items-center", item.isActive && "bg-accent text-accent-foreground")}
          >
            {item.icon && <item.icon ref={iconRef} className="relative mr-3 h-3 w-3.5" />}
            <p className="mt-0.5 text-[13px]">{item.title}</p>
          </SidebarMenuButton>
        </Link>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
