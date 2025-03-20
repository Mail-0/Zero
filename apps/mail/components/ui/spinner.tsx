import { motion } from 'motion/react';

interface SpinnerProps {
  size?: number;
  color?: string;
}

export const Spinner = ({ size = 24, color = 'currentColor' }: SpinnerProps) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ pathLength: 0.2, opacity: 0.2 }}
        animate={{ pathLength: 0.8, opacity: 1 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          repeatType: 'loop',
          ease: 'linear',
        }}
      />
    </motion.svg>
  );
};
