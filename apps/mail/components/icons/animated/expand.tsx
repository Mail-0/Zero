'use client';

import type { Transition } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface ExpandIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ExpandIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const defaultTransition: Transition = {
  type: 'spring',
  stiffness: 250,
  damping: 25,
};

const ExpandIcon = forwardRef<ExpandIconHandle, ExpandIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
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
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start('normal');
        } else {
          onMouseLeave?.(e);
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(
          `cursor-pointer select-none p-2 hover:bg-accent rounded-md transition-colors duration-200 flex items-center justify-center`,
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"
            transition={defaultTransition}
            variants={{
              normal: { translateX: '0%', translateY: '0%' },
              animate: { translateX: '2px', translateY: '2px' },
            }}
            animate={controls}
          />
          <motion.path
            d="M3 16.2V21m0 0h4.8M3 21l6-6"
            transition={defaultTransition}
            variants={{
              normal: { translateX: '0%', translateY: '0%' },
              animate: { translateX: '-2px', translateY: '2px' },
            }}
            animate={controls}
          />
          <motion.path
            d="M21 7.8V3m0 0h-4.8M21 3l-6 6"
            transition={defaultTransition}
            variants={{
              normal: { translateX: '0%', translateY: '0%' },
              animate: { translateX: '2px', translateY: '-2px' },
            }}
            animate={controls}
          />
          <motion.path
            d="M3 7.8V3m0 0h4.8M3 3l6 6"
            transition={defaultTransition}
            variants={{
              normal: { translateX: '0%', translateY: '0%' },
              animate: { translateX: '-2px', translateY: '-2px' },
            }}
            animate={controls}
          />
        </svg>
      </div>
    );
  }
);

ExpandIcon.displayName = 'ExpandIcon';

export { ExpandIcon };
