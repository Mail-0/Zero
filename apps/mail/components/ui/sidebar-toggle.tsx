'use client';

import type { ComponentProps } from 'react';
import { PanelLeft } from 'lucide-react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SidebarToggle({ className }: ComponentProps<typeof SidebarTrigger>) {
	const { toggleSidebar } = useSidebar();

	return (
		<Button onClick={toggleSidebar} variant="ghost" className={cn('md:h-fit md:px-2', className)}>
			<PanelLeft size={20} />
		</Button>
	);
}
