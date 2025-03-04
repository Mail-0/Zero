"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { AnimatePresence, motion, useAnimation } from "motion/react";
import { useEffect, useState } from "react";
import type { HTMLAttributes } from "react";

export interface KeyboardIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const KEYBOARD_PATHS = [
  { id: "key1", d: "M10 8h.01" },
  { id: "key2", d: "M12 12h.01" },
  { id: "key3", d: "M14 8h.01" },
  { id: "key4", d: "M16 12h.01" },
  { id: "key5", d: "M18 8h.01" },
  { id: "key6", d: "M6 8h.01" },
  { id: "key7", d: "M7 16h10" },
  { id: "key8", d: "M8 12h.01" },
];

const KeyboardIcon = forwardRef<KeyboardIconHandle, HTMLAttributes<HTMLDivElement>>(
  ({ onMouseEnter, onMouseLeave, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const controls = useAnimation();

    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => setIsHovered(true),
        stopAnimation: () => setIsHovered(false),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          setIsHovered(true);
        } else {
          onMouseEnter?.(e);
        }
      },
      [onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          setIsHovered(false);
        } else {
          onMouseLeave?.(e);
        }
      },
      [onMouseLeave],
    );

    useEffect(() => {
      const animateKeys = async () => {
        if (isHovered) {
          await controls.start((i) => ({
            opacity: [1, 0.2, 1],
            transition: {
              duration: 1.5,
              times: [0, 0.5, 1],
              delay: i * 0.2 * Math.random(),
              repeat: 1,
              repeatType: "reverse",
            },
          }));
        } else {
          controls.stop();
          controls.set({ opacity: 1 });
        }
      };

      animateKeys();
    }, [isHovered, controls]);

    return (
      <div
        className="flex cursor-pointer select-none items-center justify-center rounded-md transition-colors duration-200 hover:bg-accent"
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
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <AnimatePresence>
            {KEYBOARD_PATHS.map((path, index) => (
              <motion.path
                key={path.id}
                d={path.d}
                initial={{ opacity: 1 }}
                animate={controls}
                custom={index}
              />
            ))}
          </AnimatePresence>
        </svg>
      </div>
    );
  },
);

KeyboardIcon.displayName = "KeyboardIcon";

export { KeyboardIcon };
