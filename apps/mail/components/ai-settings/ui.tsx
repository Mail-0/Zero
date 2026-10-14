import { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared look for the AI settings surfaces. Mirrors the mail UI: panel
 * backgrounds, #E7E7E7 / #252525 hairlines, compact 13px copy, h-8 controls.
 */

export type AiSettingsLayout = 'dialog' | 'page';

export const AiSettingsLayoutContext = createContext<AiSettingsLayout>('page');
export const useAiSettingsLayout = () => useContext(AiSettingsLayoutContext);

/** Hairline border used across the mail UI. */
export const hairline = 'border-[#E7E7E7] dark:border-[#252525]';

/** Recessed surface for grouped rows (sits on the white / #1A1A1A panel). */
export const surface = cn('rounded-xl border bg-[#FAFAFA] dark:bg-[#141414]', hairline);

/** Compact input / textarea styling that matches the mail search field. */
export const field =
  'rounded-lg border-[#E7E7E7] bg-white text-sm shadow-none placeholder:text-[#A0A0A0] focus-visible:ring-1 focus-visible:ring-[#006FFE]/60 focus-visible:ring-offset-0 dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:placeholder:text-[#6D6D6D]';

/** Secondary button matching the thread toolbar buttons. */
export const subtleButton =
  'h-8 rounded-lg border border-[#E7E7E7] bg-white px-2.5 text-[13px] font-normal shadow-none hover:bg-[#F5F5F5] dark:border-none dark:bg-[#313131] dark:hover:bg-[#3A3A3A]';

/** Primary action button, compact. */
export const primaryButton = 'h-8 rounded-lg px-3 text-[13px]';

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-0.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-[13px] leading-snug">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small square tile holding a row icon. */
export function IconTile({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-iconLight dark:text-iconDark flex size-8 shrink-0 items-center justify-center rounded-lg border bg-white dark:bg-[#202020] [&_svg]:size-4',
        hairline,
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Footer for a pane's primary action. In the dialog it sticks to the bottom of
 * the scrolling pane; on the settings page it sits inline under the content.
 */
export function PaneFooter({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const layout = useAiSettingsLayout();
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        layout === 'dialog'
          ? cn(
              'bg-panelLight dark:bg-panelDark sticky bottom-0 -mx-5 -mb-5 border-t px-5 py-3',
              hairline,
            )
          : 'pt-2',
      )}
    >
      <p className="text-muted-foreground text-[13px]">{hint}</p>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
