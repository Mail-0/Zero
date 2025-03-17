"use client";

import type React from "react";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import type { Transition, Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface MoreVerticalIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface MoreVerticalIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const transition: Transition = {
  duration: 0.3,
  opacity: { delay: 0.05 },
};

const variants: Variants = {
  normal: {
    scale: 1,
    opacity: 1,
  },
  animate: (custom: number) => ({
    scale: [0, 1.2, 1],
    opacity: [0, 1],
    transition: {
      ...transition,
      delay: 0.1 * custom,
    },
  }),
};

const MoreVerticalIcon = forwardRef<MoreVerticalIconHandle, MoreVerticalIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start("animate");
        } else {
          onMouseEnter?.(e);
        }
      },
      [controls, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start("normal");
        } else {
          onMouseLeave?.(e);
        }
      },
      [controls, onMouseLeave],
    );

    return (
      <div
        className={cn(
          `hover:bg-accent flex cursor-pointer select-none items-center justify-center rounded-md p-2 transition-colors duration-200`,
          className,
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
          <motion.circle cx="12" cy="12" r="1" variants={variants} animate={controls} custom={1} />
          <motion.circle cx="12" cy="5" r="1" variants={variants} animate={controls} custom={0} />
          <motion.circle cx="12" cy="19" r="1" variants={variants} animate={controls} custom={2} />
        </svg>
      </div>
    );
  },
);

MoreVerticalIcon.displayName = "MoreVerticalIcon";

export { MoreVerticalIcon };
