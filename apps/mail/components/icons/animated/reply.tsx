"use client";

import type React from "react";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import type { Transition, Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ReplyIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ReplyIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const transition: Transition = {
  duration: 0.4,
  opacity: { delay: 0.1 },
};

const pathVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      ...transition,
    },
  },
};

const arrowVariants: Variants = {
  normal: {
    opacity: 1,
    x: 0,
  },
  animate: {
    opacity: [0, 1],
    x: [-5, 0],
    transition: {
      ...transition,
      delay: 0.2,
    },
  },
};

const ReplyIcon = forwardRef<ReplyIconHandle, ReplyIconProps>(
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
          <motion.path d="M9 17l-5-5 5-5" variants={arrowVariants} animate={controls} />
          <motion.path d="M20 18v-2a4 4 0 0 0-4-4H4" variants={pathVariants} animate={controls} />
        </svg>
      </div>
    );
  },
);

ReplyIcon.displayName = "ReplyIcon";

export { ReplyIcon };
