import { Link, useLocation, useSearchParams } from 'react-router';
import { PricingDialog } from '@/components/ui/pricing-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { navigationConfig } from '@/config/navigation';
import { ArrowLeft } from '@/components/icons/icons';
import { NavUser } from '@/components/ui/nav-user';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

/** Only allow `?from=` values that point back into the app. */
function safeFrom(from: string | null) {
  if (!from) return null;
  const decoded = decodeURIComponent(from);
  return decoded.startsWith('/') && !decoded.startsWith('//') ? decoded : null;
}

function useSettingsNav() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const from = safeFrom(searchParams.get('from'));

  const items = useMemo(
    () =>
      navigationConfig.settings.sections
        .flatMap((section) => section.items)
        .filter((item) => !item.isBackButton && !item.disabled)
        .map((item) => ({
          ...item,
          href: from ? `${item.url}?from=${encodeURIComponent(from)}` : item.url,
          active: pathname === item.url || pathname.startsWith(`${item.url}/`),
        })),
    [from, pathname],
  );

  return { items, backHref: from ?? '/mail' };
}

const navItemClass =
  'text-muted-foreground hover:text-foreground flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] whitespace-nowrap transition-colors hover:bg-[#F5F5F5] dark:hover:bg-[#202020]';
const navItemActiveClass = 'text-foreground bg-[#F0F0F0] dark:bg-[#252525]';

export function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  const { items, backHref } = useSettingsNav();

  return (
    <div className="bg-sidebar dark:bg-sidebar w-full min-w-0">
      <PricingDialog />
      <div className="bg-panelLight dark:bg-panelDark flex h-dvh min-w-0 flex-col md:mr-0.5 md:rounded-2xl">
        {/* Toolbar: mirrors the mail list toolbar */}
        <div className="sticky top-0 z-15 flex items-center justify-between gap-2 p-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-7 gap-1.5 rounded-lg px-2 text-[13px] font-normal"
            >
              <Link to={backHref}>
                <ArrowLeft className="fill-muted-foreground size-3.5" />
                {m['common.actions.back']()}
              </Link>
            </Button>
            <div className="bg-border h-4 w-px" />
            <NavUser compact />
          </div>
          <span className="text-muted-foreground hidden pr-2 text-[13px] sm:inline">
            {m['navigation.sidebar.settings']()}
          </span>
        </div>

        {/* Mobile: horizontal section switcher */}
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.url}
              to={item.href}
              className={cn(navItemClass, item.active && navItemActiveClass)}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex min-h-0 flex-1">
          {/* Desktop: section list */}
          <nav className="hidden w-52 shrink-0 flex-col gap-0.5 px-2 pt-4 md:flex">
            {items.map((item) => (
              <Link
                key={item.url}
                to={item.href}
                className={cn(navItemClass, item.active && navItemActiveClass)}
              >
                <item.icon
                  className={cn(
                    'size-4 shrink-0',
                    item.active ? 'fill-foreground' : 'fill-iconLight dark:fill-iconDark',
                  )}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            ))}
          </nav>

          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto w-full max-w-[700px] px-4 pt-4 pb-16 md:px-6">{children}</div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
