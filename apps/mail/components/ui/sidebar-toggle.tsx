import type { ComponentProps } from 'react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen } from '../icons/icons';
import { cn } from '@/lib/utils';

export function SidebarToggle({ className }: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button onClick={toggleSidebar} variant="ghost" className={cn('md:h-fit md:px-2', className)}>
      <PanelLeftOpen className="dark:fill-iconDark fill-iconLight" />
    </Button>
  );
}
