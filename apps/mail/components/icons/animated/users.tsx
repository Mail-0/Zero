'use client';

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';

export interface UsersIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

const pathVariants: Variants = {
	normal: {
		translateX: 0,
		transition: {
			type: 'spring',
			stiffness: 200,
			damping: 13,
		},
	},
	animate: {
		translateX: [-6, 0],
		transition: {
			delay: 0.1,
			type: 'spring',
			stiffness: 200,
			damping: 13,
		},
	},
};

const UsersIcon = forwardRef<UsersIconHandle, HTMLAttributes<HTMLDivElement>>(
	({ onMouseEnter, onMouseLeave, ...props }, ref) => {
		const controls = useAnimation();
		const isControlledRef = useRef(false);

		useImperativeHandle(ref, () => {
			isControlledRef.current = true;

			return {
				startAnimation: () => controls.start('animate'),
				stopAnimation: () => controls.start('normal'),
			};
		});

		const handleMouseEnter = useCallback(
			(e: React.MouseEvent<HTMLDivElement>) => {
				if (!isControlledRef.current) {
					controls.start('animate');
				} else {
					onMouseEnter?.(e);
				}
			},
			[controls, onMouseEnter],
		);

		const handleMouseLeave = useCallback(
			(e: React.MouseEvent<HTMLDivElement>) => {
				if (!isControlledRef.current) {
					controls.start('normal');
				} else {
					onMouseLeave?.(e);
				}
			},
			[controls, onMouseLeave],
		);

		return (
			<div
				className="hover:bg-accent flex cursor-pointer select-none items-center justify-center rounded-md p-2 transition-colors duration-200"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				{...props}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="17"
					height="17"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
					<circle cx="9" cy="7" r="4" />
					<motion.path d="M22 21v-2a4 4 0 0 0-3-3.87" variants={pathVariants} animate={controls} />
					<motion.path d="M16 3.13a4 4 0 0 1 0 7.75" variants={pathVariants} animate={controls} />
				</svg>
			</div>
		);
	},
);

UsersIcon.displayName = 'UsersIcon';

export { UsersIcon };
