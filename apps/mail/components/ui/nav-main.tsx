import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './sidebar';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useActiveConnection, useConnections } from '@/hooks/use-connections';
import { type MessageKey, type NavItem } from '@/config/navigation';
import { LabelDialog } from '@/components/labels/label-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router';
import Intercom, { show } from '@intercom/messenger-js-sdk';
import { MessageSquare, OldPhone } from '../icons/icons';
import { useSidebar } from '../context/sidebar-context';
import { useTRPC } from '@/providers/query-provider';
import type { Label as LabelType } from '@/types';
import { Button } from '@/components/ui/button';
import { useLabels } from '@/hooks/use-labels';
import { Badge } from '@/components/ui/badge';
import { useStats } from '@/hooks/use-stats';
import SidebarLabels from './sidebar-labels';
import { useCallback, useRef } from 'react';
import { BASE_URL } from '@/lib/constants';
import { useTranslations } from 'use-intl';
import { useQueryState } from 'nuqs';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as React from 'react';

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
  const location = useLocation();
  const pathname = location.pathname;
  const searchParams = new URLSearchParams();
  const [category] = useQueryState('category');
  const { data: connections } = useConnections();
  const { data: stats } = useStats();
  const { data: activeConnection } = useActiveConnection();
  const trpc = useTRPC();
  const { data: intercomToken } = useQuery(trpc.user.getIntercomToken.queryOptions());

  React.useEffect(() => {
    if (intercomToken) {
      Intercom({
        app_id: 'aavenrba',
        intercom_user_jwt: intercomToken,
      });
    }
  }, [intercomToken]);

  const { mutateAsync: createLabel } = useMutation(trpc.labels.create.mutationOptions());

  const { data, refetch } = useLabels();

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
      if (item.isSettingsButton) {
        // Include current path with category query parameter if present
        const currentPath = category
          ? `${pathname}?category=${encodeURIComponent(category)}`
          : pathname;
        return `${item.url}?from=${encodeURIComponent(currentPath)}`;
      }

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
      if (item.id === 'inbox' && category) {
        return `${item.url}?category=${encodeURIComponent(category)}`;
      }

      return item.url;
    },
    [pathname, category, searchParams, isValidInternalUrl],
  );

  const { data: activeAccount } = useActiveConnection();

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
  const t = useTranslations();

  const onSubmit = async (data: LabelType) => {
    toast.promise(createLabel(data), {
      loading: 'Creating label...',
      success: 'Label created successfully',
      error: 'Failed to create label',
    });
  };

  return (
    <SidebarGroup className={`${state !== 'collapsed' ? '' : 'mt-1'} space-y-2.5 py-0 md:px-0`}>
      <SidebarMenu>
        {isBottomNav ? (
          <>
            <SidebarMenuButton
              onClick={() => show()}
              tooltip={state === 'collapsed' ? t('help' as MessageKey) : undefined}
              className="hover:bg-subtleWhite flex cursor-pointer items-center dark:hover:bg-[#202020]"
            >
              <OldPhone className="relative mr-2.5 h-2 w-2 fill-[#8F8F8F]" />
              <p className="relative bottom-0.5 mt-0.5 truncate text-[13px]">Live Support</p>
            </SidebarMenuButton>
            <NavItem
              key={'feedback'}
              isActive={isUrlActive('https://feedback.0.email')}
              href={'https://feedback.0.email'}
              url={'https://feedback.0.email'}
              icon={MessageSquare}
              target={'_blank'}
              title={'navigation.sidebar.feedback'}
            />
          </>
        ) : null}
        {items.map((section) => (
          <Collapsible
            key={section.title}
            defaultOpen={section.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              {state !== 'collapsed' ? (
                section.title ? (
                  <p className="text-muted-foreground mx-2 mb-2 text-[13px] dark:text-[#898989]">
                    {section.title}
                  </p>
                ) : null
              ) : (
                <div className="bg-muted-foreground/50 mx-2 mb-4 mt-2 h-[0.5px] dark:bg-[#262626]" />
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
                  />
                ))}
              </div>
            </SidebarMenuItem>
          </Collapsible>
        ))}
        {!pathname.includes('/settings') && !isBottomNav && state !== 'collapsed' && (
          <Collapsible defaultOpen={true} className="group/collapsible flex-col">
            <SidebarMenuItem className="mb-4" style={{ height: 'auto' }}>
              <div className="mx-2 mb-4 flex items-center justify-between">
                <span className="text-muted-foreground text-[13px] dark:text-[#898989]">
                  {activeAccount?.providerId === 'google' ? 'Labels' : 'Folders'}
                </span>
                {activeAccount?.providerId === 'google' ? (
                  <LabelDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mr-1 h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <Plus className="text-muted-foreground h-3 w-3 dark:text-[#898989]" />
                      </Button>
                    }
                    onSubmit={onSubmit}
                    onSuccess={refetch}
                  />
                ) : activeAccount?.providerId === 'microsoft' ? null : null}
              </div>

              {activeAccount ? (
                <SidebarLabels data={data ?? []} activeAccount={activeAccount} stats={stats} />
              ) : null}
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
  const { state, setOpenMobile } = useSidebar();

  if (item.disabled) {
    return (
      <SidebarMenuButton
        tooltip={state === 'collapsed' ? t(item.title as MessageKey) : undefined}
        className="flex cursor-not-allowed items-center opacity-50"
      >
        {item.icon && <item.icon ref={iconRef} className="relative mr-2.5 h-3 w-3.5" />}
        <p className="relative bottom-[1px] mt-0.5 truncate text-[13px]">
          {t(item.title as MessageKey)}
        </p>
      </SidebarMenuButton>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if (item.onClick) {
      item.onClick(e as React.MouseEvent<HTMLAnchorElement>);
    }
    setOpenMobile(false);
  };

  return (
    <Collapsible defaultOpen={item.isActive}>
      <CollapsibleTrigger asChild>
        <SidebarMenuButton
          asChild
          tooltip={state === 'collapsed' ? t(item.title as MessageKey) : undefined}
          className={cn(
            'hover:bg-subtleWhite flex items-center dark:hover:bg-[#202020]',
            item.isActive && 'bg-subtleWhite text-accent-foreground dark:bg-[#202020]',
          )}
          onClick={handleClick}
        >
          <Link target={item.target} to={item.href}>
            {item.icon && <item.icon ref={iconRef} className="mr-2 shrink-0" />}
            <p className="relative bottom-[1px] mt-0.5 min-w-0 flex-1 truncate text-[13px]">
              {t(item.title as MessageKey)}
            </p>
            {stats &&
              item.id?.toLowerCase() !== 'sent' &&
              stats.some((stat) => stat.label?.toLowerCase() === item.id?.toLowerCase()) && (
                <Badge className="text-muted-foreground ml-auto shrink-0 rounded-full border-none bg-transparent">
                  {stats
                    .find((stat) => stat.label?.toLowerCase() === item.id?.toLowerCase())
                    ?.count?.toLocaleString() || '0'}
                </Badge>
              )}
          </Link>
        </SidebarMenuButton>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
