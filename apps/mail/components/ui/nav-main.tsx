'use client';

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarMenuSub,
} from './sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label as LabelType, useLabels } from '@/hooks/use-labels';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSearchValue } from '@/hooks/use-search-value';
import { clearBulkSelectionAtom } from '../mail/use-mail';
import { Label as UILabel } from '@/components/ui/label';
import { type MessageKey } from '@/config/navigation';
import { type NavItem } from '@/config/navigation';
import { createLabel } from '@/hooks/use-labels';
import { Button } from '@/components/ui/button';
import { HexColorPicker } from 'react-colorful';
import { useSession } from '@/lib/auth-client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GoldenTicketModal } from '../golden';
import { useStats } from '@/hooks/use-stats';
import { Command, SettingsIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useCallback } from 'react';
import { BASE_URL } from '@/lib/constants';
import { useForm } from 'react-hook-form';
import { useQueryState } from 'nuqs';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAtom } from 'jotai';
import { toast } from 'sonner';
import * as React from 'react';
import Link from 'next/link';
import { CurvedArrow } from '../icons/icons';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  ref?: React.Ref<SVGSVGElement>;
  startAnimation?: () => void;
  stopAnimation?: () => void;
}

interface NavItemProps extends NavItem {
  isActive?: boolean;
  isExpanded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  suffix?: React.ComponentType<IconProps>;
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
  const [category] = useQueryState('category');
  const [searchValue, setSearchValue] = useSearchValue();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const form = useForm<LabelType>({
    defaultValues: {
      name: '',
      color: { backgroundColor: '#E2E2E2', textColor: '#ffffff' },
    },
  });

  const formColor = form.watch('color');

  const { labels } = useLabels();
  const { state } = useSidebar();

  // Check if these are bottom navigation items by looking at the first section's title
  const isBottomNav = items[0]?.title === '';

  /**
   * Validates URLs to prevent open redirect vulnerabilities.
   * Only allows two types of URLs:
   * 1. Absolute paths that start with '/' (e.g., '/mail', '/settings')
   * 2. Full URLs that match our application's base URL
   *
   * @param url - The URL to validate
   * @returns boolean - True if the URL is internal and safe to use
   */
  const isValidInternalUrl = useCallback((url: string) => {
    if (!url) return false;
    // Accept absolute paths as they are always internal
    if (url.startsWith('/')) return true;
    try {
      const urlObj = new URL(url, BASE_URL);
      // Prevent redirects to external domains by checking against our base URL
      return urlObj.origin === BASE_URL;
    } catch {
      return false;
    }
  }, []);

  const getHref = useCallback(
    (item: NavItemProps) => {
      // Get the current 'from' parameter
      const currentFrom = searchParams.get('from');

      // Handle settings navigation
      // if (item.isSettingsButton) {
      // Include current path with category query parameter if present
      //   const currentPath = category
      //     ? `${pathname}?category=${encodeURIComponent(category)}`
      //     : pathname;
      //   return `${item.url}?from=${encodeURIComponent(currentPath)}`;
      // }

      // Handle back button with redirect protection
      if (item.isBackButton) {
        if (currentFrom) {
          const decodedFrom = decodeURIComponent(currentFrom);
          if (isValidInternalUrl(decodedFrom)) {
            return decodedFrom;
          }
        }
        // Fall back to safe default if URL is missing or invalid
        return '/mail';
      }

      // Handle settings pages navigation
      if (item.isSettingsPage && currentFrom) {
        // Validate and sanitize the 'from' parameter to prevent open redirects
        const decodedFrom = decodeURIComponent(currentFrom);
        if (isValidInternalUrl(decodedFrom)) {
          return `${item.url}?from=${encodeURIComponent(currentFrom)}`;
        }
        // Fall back to safe default if URL validation fails
        return `${item.url}?from=/mail`;
      }

      // Handle category links
      if (category) {
        return `${item.url}?category=${encodeURIComponent(category)}`;
      }

      return item.url;
    },
    [pathname, category, searchParams, isValidInternalUrl],
  );

  const isUrlActive = useCallback(
    (url: string) => {
      const urlObj = new URL(
        url,
        typeof window === 'undefined' ? BASE_URL : window.location.origin,
      );
      const cleanPath = pathname.replace(/\/$/, '');
      const cleanUrl = urlObj.pathname.replace(/\/$/, '');

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

  const handleFilterByLabel = (label: LabelType) => () => {
    const existingValue = searchValue.value;
    if (existingValue.includes(`label:${label.name}`)) {
      setSearchValue({
        value: existingValue.replace(`label:${label.name}`, ''),
        highlight: '',
        folder: '',
      });
      return;
    }
    const newValue = existingValue ? `${existingValue} label:${label.name}` : `label:${label.name}`;
    setSearchValue({
      value: newValue,
      highlight: '',
      folder: '',
    });
  };

  const onSubmit = async (data: LabelType) => {
    try {
      toast.promise(createLabel(data), {
        loading: 'Creating label...',
        success: 'Label created successfully',
        error: 'Failed to create label',
      });
    } catch (error) {
      console.error('Error creating label:', error);
    } finally {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    form.reset({
      name: '',
      color: { backgroundColor: '#E2E2E2', textColor: '#ffffff' },
    });
  };

  // Function to reset search when clicking on Inbox
  const handleResetSearch = useCallback(() => {
    // Only reset if there's an active search
    if (searchValue.value || searchValue.highlight || searchValue.folder) {
      setSearchValue({
        value: '',
        highlight: '',
        folder: '',
        isLoading: false,
        isAISearching: false,
      });
    }
  }, [setSearchValue, searchValue]);

  return (
    <SidebarGroup className={`${state !== 'collapsed' ? '' : 'mt-1'} space-y-2.5 py-0`}>
      <SidebarMenu>
        {items.map((section) => (
          <Collapsible
            key={section.title}
            defaultOpen={section.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              {state !== 'collapsed' ? (
                <p className="mx-2 mb-2 text-[13px] text-[#6D6D6D] dark:text-[#898989]">
                  {section.title}
                </p>
              ) : (
                <div className="mx-2 mb-4 mt-2 h-[0.5px] bg-[#6D6D6D]/50 dark:bg-[#262626]" />
              )}
              <div className="z-20 space-y-1 pb-2">
                {section.items.map((item) => (
                  <NavItem
                    key={item.url}
                    {...item}
                    isActive={isUrlActive(item.url)}
                    href={getHref(item)}
                    target={item.target}
                    title={item.title}
                    onClick={item.id === 'inbox' ? handleResetSearch : item.onClick}
                  />
                ))}
              </div>
            </SidebarMenuItem>
          </Collapsible>
        ))}
        {!pathname.includes('/settings') && !isBottomNav && state !== 'collapsed' && (
          <Collapsible defaultOpen={true} className="group/collapsible">
            <SidebarMenuItem className="mb-4" style={{ height: 'auto' }}>
              <div className="mx-2 mb-4 flex w-full items-center justify-between">
                <span className="text-[13px] text-[#6D6D6D] dark:text-[#898989]">Labels</span>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mr-2 h-4 w-4 p-0 hover:bg-transparent"
                    >
                      <Plus className="h-3 w-3 text-[#6D6D6D] dark:text-[#898989]" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    showOverlay={true}
                    className="bg-panelLight dark:bg-panelDark w-full max-w-[500px] rounded-xl p-4"
                  >
                    <DialogHeader>
                      <DialogTitle>Create New Label</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          form.handleSubmit(onSubmit)();
                        }
                      }}>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Label Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter label name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="space-y-4">
                            <UILabel>Color</UILabel>
                            <div className="w-full">
                              <div className="grid grid-cols-7 gap-4">
                                {[
                                  // Row 1 - Grayscale
                                  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff',
                                  // Row 2 - Warm colors
                                  '#fb4c2f', '#ffad47', '#fad165', '#ff7537', '#cc3a21', '#8a1c0a',
                                  // Row 3 - Cool colors
                                  '#16a766', '#43d692', '#4a86e8', '#285bac', '#3c78d8', '#0d3472',
                                  // Row 4 - Purple tones
                                  '#a479e2', '#b99aff', '#653e9b', '#3d188e', '#f691b3', '#994a64',
                                  // Row 5 - Pastels
                                  '#f6c5be', '#ffe6c7', '#c6f3de', '#c9daf8',
                                ].map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    className={`h-10 w-10 rounded-[4px] border-[0.5px] border-white/10 ${
                                      formColor?.backgroundColor === color ? 'ring-2 ring-blue-500' : ''
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => form.setValue('color', {
                                      backgroundColor: color,
                                      textColor: '#ffffff'
                                    })}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            className="h-8"
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                          >
                            Cancel
                          </Button>
                          <Button className="h-8" type="submit">
                            Create Label
                            <div className="flex h-5 items-center justify-center gap- rounded-sm bg-white/10 px-1 dark:bg-black/10">
                              <Command className="h-2 w-2 text-white dark:text-[#929292]" />
                              <CurvedArrow className="mt-1.5 h-3 w-3 fill-white dark:fill-[#929292]" />
                            </div>
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mr-0 pr-0">
                <div
                  className={cn(
                    'hide-scrollbar mx-2 flex h-full max-h-[20vh] flex-row flex-wrap gap-2 overflow-auto',
                  )}
                >
                  {labels.map((label) => (
                    <div
                      onClick={handleFilterByLabel(label)}
                      key={label.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className={cn(
                          'max-w-[20ch] truncate rounded border px-1.5 py-0.5 text-xs',
                          searchValue.value.includes(`label:${label.name}`)
                            ? 'border-accent-foreground'
                            : 'dark:bg-subtleBlack',
                        )}
                      >
                        {label.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SidebarMenuItem>
          </Collapsible>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavItem(item: NavItemProps & { href: string }) {
  const iconRef = useRef<IconRefType>(null);
  const { data: stats } = useStats();
  const t = useTranslations();
  const { state } = useSidebar();

  if (item.disabled) {
    return (
      <SidebarMenuButton
        tooltip={state === 'collapsed' ? t(item.title as MessageKey) : undefined}
        className="flex cursor-not-allowed items-center opacity-50"
      >
        {item.icon && <item.icon ref={iconRef} className="relative mr-2.5 h-3 w-3.5" />}
        <p className="mt-0.5 truncate text-[13px]">{t(item.title as MessageKey)}</p>
      </SidebarMenuButton>
    );
  }

  // Apply animation handlers to all buttons including back buttons
  const linkProps = {
    href: item.href,
    onMouseEnter: () => iconRef.current?.startAnimation?.(),
    onMouseLeave: () => iconRef.current?.stopAnimation?.(),
  };

  const { setOpenMobile } = useSidebar();

  const buttonContent = (
    <SidebarMenuButton
      tooltip={state === 'collapsed' ? t(item.title as MessageKey) : undefined}
      className={cn(
        'hover:bg-subtleWhite flex items-center dark:hover:bg-[#202020]',
        item.isActive && 'bg-subtleWhite text-accent-foreground dark:bg-[#202020]',
      )}
      onClick={() => setOpenMobile(false)}
    >
      {item.icon && <item.icon ref={iconRef} className="mr-2 shrink-0" />}
      <p className="mt-0.5 min-w-0 flex-1 truncate text-[13px]">{t(item.title as MessageKey)}</p>
      {stats
        ? stats.some((stat) => stat.label?.toLowerCase() === item.id?.toLowerCase()) && (
            <Badge className="text-muted-foreground ml-auto shrink-0 rounded-full border-none bg-transparent">
              {stats
                .find((stat) => stat.label?.toLowerCase() === item.id?.toLowerCase())
                ?.count?.toLocaleString() || '0'}
            </Badge>
          )
        : null}
    </SidebarMenuButton>
  );

  if (item.isBackButton) {
    return <Link {...linkProps}>{buttonContent}</Link>;
  }

  return (
    <Collapsible defaultOpen={item.isActive}>
      <CollapsibleTrigger asChild>
        <Link
          {...linkProps}
          prefetch
          onClick={item.onClick ? item.onClick : undefined}
          target={item.target}
        >
          {buttonContent}
        </Link>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
