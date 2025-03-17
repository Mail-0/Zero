'use client';

import { useAISidebar } from '@/components/ui/ai-sidebar';
import { navigationConfig } from '@/config/navigation';
import { useHotKey } from '@/hooks/use-hot-key';
import { useRouter } from 'next/navigation';

export const KeyboardShortcuts = () => {
	const router = useRouter();
	const { toggleOpen } = useAISidebar();
	if (navigationConfig?.mail?.sections) {
		const items = navigationConfig.mail.sections[0]?.items || [];
		items.map((item, index) => {
			if (item?.url && !item.disabled) {
				useHotKey(`g+${index + 1}`, () => {
					router.push(item.url);
				});
			}
		});
	}

	return null;
};
