'use client';

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';

export interface DeleteIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const lidVariants: Variants = {
  normal: { y: 0 },
  animate: { y: -1.1 },
};

const springTransition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
};

const DeleteIcon = forwardRef<DeleteIconHandle, HTMLAttributes<HTMLDivElement>>(
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
          <motion.g variants={lidVariants} animate={controls} transition={springTransition}>
            <path d="M3 6h18" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </motion.g>
          <motion.path
            d="M19 8v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V8"
            variants={{
              normal: { d: 'M19 8v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V8' },
              animate: { d: 'M19 9v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V9' },
            }}
            animate={controls}
            transition={springTransition}
          />
          <motion.line
            x1="10"
            x2="10"
            y1="11"
            y2="17"
            variants={{
              normal: { y1: 11, y2: 17 },
              animate: { y1: 11.5, y2: 17.5 },
            }}
            animate={controls}
            transition={springTransition}
          />
          <motion.line
            x1="14"
            x2="14"
            y1="11"
            y2="17"
            variants={{
              normal: { y1: 11, y2: 17 },
              animate: { y1: 11.5, y2: 17.5 },
            }}
            animate={controls}
            transition={springTransition}
          />
        </svg>
      </div>
    );
  },
);

DeleteIcon.displayName = 'DeleteIcon';

export { DeleteIcon };
