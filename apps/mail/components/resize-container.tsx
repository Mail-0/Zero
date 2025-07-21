import {
  type ComponentPropsWithoutRef,
  type PropsWithChildren,
  forwardRef,
  useRef,
  useMemo,
} from 'react';
import { useResizeObserver } from '@/hooks/ui/use-resize-observer';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

type AnimatedSizeContainerProps = PropsWithChildren<{
  width?: boolean;
  height?: boolean;
}> &
  Omit<ComponentPropsWithoutRef<typeof motion.div>, 'animate' | 'children'>;

const AnimatedSizeContainer = forwardRef<HTMLDivElement, AnimatedSizeContainerProps>(
  (
    {
      width = false,
      height = false,
      className,
      transition,
      children,
      ...rest
    }: AnimatedSizeContainerProps,
    forwardedRef,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const resizeObserverEntry = useResizeObserver(containerRef);

    const animateProps = useMemo(
      () => ({
        width: width ? (resizeObserverEntry?.contentRect?.width ?? 'auto') : 'auto',
        height: height ? (resizeObserverEntry?.contentRect?.height ?? 'auto') : 'auto',
      }),
      [
        width,
        height,
        resizeObserverEntry?.contentRect?.width,
        resizeObserverEntry?.contentRect?.height,
      ],
    );

    const transitionProps = useMemo(
      () => transition ?? { type: 'spring', duration: 0.3 },
      [transition],
    );

    return (
      <motion.div
        ref={forwardedRef}
        className={cn('overflow-hidden', className)}
        animate={animateProps}
        transition={transition ?? { type: 'spring', duration: 0.3 }}
        {...rest}
      >
        <div ref={containerRef} className={cn(height && 'h-max', width && 'w-max')}>
          {children}
        </div>
      </motion.div>
    );
  },
);

AnimatedSizeContainer.displayName = 'AnimatedSizeContainer';

export { AnimatedSizeContainer };
