import { hairline, surface } from '@/components/ai-settings/ui';
import { cn } from '@/lib/utils';

/**
 * Building blocks for the /settings pages. They share the mail UI's look
 * (see components/ai-settings/ui.tsx): hairline borders, recessed grouped
 * surfaces, 13px secondary copy and h-8 controls.
 */

export {
  hairline,
  surface,
  field,
  subtleButton,
  primaryButton,
  SectionHeader,
  IconTile,
} from '@/components/ai-settings/ui';

/** Divider colour for rows stacked inside a group. */
export const rowDivider = 'divide-y divide-[#E7E7E7] dark:divide-[#252525]';

/** Layout for a single setting row. Also usable on a <FormItem>. */
export const rowClass = 'flex items-center gap-3 space-y-0 px-4 py-3';

/** Row title / description typography (works on FormLabel / FormDescription). */
export const rowTitle = 'text-sm font-medium leading-snug';
export const rowDescription = 'text-muted-foreground text-[13px] leading-snug';

/** Compact select / combobox trigger matching the mail search field. */
export const selectTrigger =
  'h-8 w-full rounded-lg border-[#E7E7E7] bg-white text-[13px] shadow-none hover:bg-[#F5F5F5] focus:ring-1 focus:ring-[#006FFE]/60 focus:ring-offset-0 md:w-[220px] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:hover:bg-[#202020] [&_svg]:size-3.5';

/** Square ghost icon button used for row actions (edit, delete…). */
export const iconButton =
  'text-iconLight dark:text-iconDark h-7 w-7 rounded-lg px-0 hover:bg-[#F0F0F0] dark:hover:bg-[#252525] [&_svg]:size-3.5';

/** Destructive variant of `iconButton`, mirrors the mail list's delete action. */
export const destructiveIconButton =
  'h-7 w-7 rounded-lg px-0 text-[#F43F5E] hover:bg-[#FDE4E9] hover:text-[#F43F5E] dark:hover:bg-[#411D23] [&_svg]:size-3.5';

/** Destructive button styled like the thread toolbar's delete button. */
export const destructiveButton =
  'h-8 rounded-lg border border-[#FCCDD5] bg-[#FDE4E9] px-3 text-[13px] font-medium text-[#F43F5E] shadow-none hover:bg-[#FBD5DC] dark:border-[#6E2532] dark:bg-[#411D23] dark:hover:bg-[#4E222A]';

/** Keyboard key chip, same as the ⌘K hint in the mail toolbar. */
export const kbd =
  'bg-muted text-muted-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-xs select-none dark:bg-[#262626] dark:text-[#929292]';

/** A recessed surface holding rows separated by hairlines. */
export function SettingsGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(surface, rowDivider, 'overflow-hidden', className)}>{children}</div>;
}

/** A label/description on the left, a control on the right. */
export function SettingsRow({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(rowClass, className)}>
      {icon}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className={rowTitle}>{title}</div>
        {description && <p className={rowDescription}>{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** Centered muted message for empty / error states inside a group. */
export function SettingsEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(surface, 'text-muted-foreground px-4 py-8 text-center text-[13px]')}>
      {children}
    </div>
  );
}

/** Footer hairline wrapper re-used by SettingsCard. */
export const footerClass = cn('flex items-center justify-end gap-2 border-t pt-4', hairline);
