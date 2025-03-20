'use client';

import { updateCookiePreferences } from '@/actions/cookies';
import { useGeoLocation } from '@/hooks/use-geo-location';
import type { CookieCategory } from '@/lib/cookies';
import React, { startTransition } from 'react';
import { Switch } from '../ui/switch';

type Props = {
	checked: boolean;
	disabled: boolean | undefined;
	category: CookieCategory;
};

const Toggle = (props: Props) => {
	const { isEuRegion } = useGeoLocation();
	const handleCookieToggle = async (key: CookieCategory, checked: boolean) => {
		startTransition(async () => {
			await updateCookiePreferences(key, checked);
		});
	};

	// If not in EU/UK region, only allow necessary cookies
	if (!isEuRegion && props.category !== 'necessary') {
		return null;
	}

	return (
		<Switch
			checked={props.category === 'necessary' ? true : props.checked}
			disabled={props.disabled || !isEuRegion}
			onCheckedChange={async (checked) => await handleCookieToggle(props.category, checked)}
		/>
	);
};

export default Toggle;
