"use client";

import type React from "react";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { motion, useAnimation } from "motion/react";
import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";

export interface FilterListIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const lineVariants: Variants = {
  normal: {
    pathLength: 1,
    transition: { duration: 0.3 },
  },
  animate: {
    pathLength: [1, 0, 1],
    transition: { duration: 0.5, times: [0, 0.5, 1] },
  },
};

const FilterListIcon = forwardRef<FilterListIconHandle, HTMLAttributes<HTMLDivElement>>(
  ({ onMouseEnter, onMouseLeave, ...props }, ref) => {
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
        className="hover:bg-accent flex cursor-pointer select-none items-center justify-center rounded-md transition-colors duration-200"
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
          <motion.path d="M3 6h18" variants={lineVariants} initial="normal" animate={controls} />
          <motion.path d="M7 12h10" variants={lineVariants} initial="normal" animate={controls} />
          <motion.path d="M10 18h4" variants={lineVariants} initial="normal" animate={controls} />
        </svg>
      </div>
    );
  },
);

FilterListIcon.displayName = "FilterListIcon";

export { FilterListIcon };
