"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { motion, useAnimation } from "motion/react";
import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";

export interface AlignVerticalSpaceAroundIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const rectVariants: Variants = {
  normal: {
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },
  },
  animate: {
    y: [-1, 1],
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15,
      duration: 0.3,
    },
  },
};

const pathVariants: Variants = {
  normal: { pathLength: 1 },
  animate: { pathLength: [0.7, 1] },
  transition: {
    type: "spring",
  },
};

const AlignVerticalSpaceAroundIcon = forwardRef<
  AlignVerticalSpaceAroundIconHandle,
  HTMLAttributes<HTMLDivElement>
>(({ onMouseEnter, onMouseLeave, ...props }, ref) => {
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
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.rect
          width="10"
          height="6"
          x="7"
          y="9"
          rx="2"
          variants={rectVariants}
          initial="normal"
          animate={controls}
        />
        <motion.path
          d="M22 20H2"
          variants={pathVariants}
          initial="normal"
          animate={controls}
          transition={{ duration: 0.4 }}
        />
        <motion.path
          d="M22 4H2"
          variants={pathVariants}
          initial="normal"
          animate={controls}
          transition={{ duration: 0.4 }}
        />
      </svg>
    </div>
  );
});

AlignVerticalSpaceAroundIcon.displayName = "AlignVerticalSpaceAroundIcon";

export { AlignVerticalSpaceAroundIcon };
