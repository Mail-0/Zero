"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { motion, useAnimation } from "motion/react";
import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";

export interface InboxIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const polylineVariants: Variants = {
  normal: { points: "22 12 16 12 14 15 10 15 8 12 2 12" },
  animate: { points: "22 14 16 14 14 18 10 18 8 14 2 14" },
};

const pathVariants: Variants = {
  normal: {
    d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  },
  animate: {
    d: "M5.45 7.11 2 14v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4l-3.45-6.89A2 2 0 0 0 16.76 6H7.24a2 2 0 0 0-1.79 1.11z",
  },
};

const InboxIcon = forwardRef<InboxIconHandle, HTMLAttributes<HTMLDivElement>>(
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
        className="flex cursor-pointer select-none items-center justify-center rounded-md p-2 transition-colors duration-200 hover:bg-accent"
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
          <motion.polyline
            variants={polylineVariants}
            initial="normal"
            animate={controls}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
          <motion.path
            variants={pathVariants}
            initial="normal"
            animate={controls}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
        </svg>
      </div>
    );
  },
);

InboxIcon.displayName = "InboxIcon";

export { InboxIcon };
