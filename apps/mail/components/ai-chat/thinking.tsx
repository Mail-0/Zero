import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getToolLabel, type AIStatus, type ToolCall } from './chat-parts';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Zero's mark, drawn with currentColor so it can spin as the loader. */
export const ZeroMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 191 191" fill="none" aria-hidden className={className}>
    <path
      d="M38.125 190.625V152.5H0V38.125H38.125V0H152.5V38.125H190.625V152.5H152.5V190.625H38.125ZM38.125 114.375H76.25V150.975H152.5V76.25H114.375V114.375H76.25V76.25H114.375V39.65H38.125V114.375Z"
      fill="currentColor"
    />
  </svg>
);

export function statusDotClass(status: AIStatus): string {
  switch (status) {
    case 'thinking':
      return 'bg-ai animate-pulse-size';
    case 'complete':
      return 'bg-neutral-inverse/30';
    case 'error':
      return 'bg-danger';
  }
}

const Chevron = ({ open }: { open: boolean }) => (
  <ChevronRight
    className={cn(
      'text-neutral-subtle size-3.5 transition-transform duration-200 ease-out',
      open && 'rotate-90',
    )}
  />
);

const Collapse = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <div
    className={cn(
      'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out',
      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
    )}
  >
    <div className="min-h-0">{children}</div>
  </div>
);

export function ToolStatusLine({ call }: { call: ToolCall }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className={cn(statusDotClass(call.status), 'size-1.5 shrink-0 rounded-full')} />
      <span className="text-copy text-neutral-subtle">{getToolLabel(call)}</span>
    </div>
  );
}

function useElapsedSeconds(isComplete: boolean) {
  const startRef = useRef(Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setSeconds((Date.now() - startRef.current) / 1000);
    if (isComplete) return tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isComplete]);
  return seconds;
}

function formatDuration(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `${s} second${s !== 1 ? 's' : ''}`;
  const mins = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${mins} minute${mins !== 1 ? 's' : ''}` : `${mins}m ${rest}s`;
}

/** Model reasoning, collapsed behind "Thinking..." / "Thought for N seconds". */
export function ThinkingBlock({ content, isComplete }: { content: string; isComplete: boolean }) {
  const [open, setOpen] = useState(false);
  const seconds = useElapsedSeconds(isComplete);
  const title = isComplete ? `Thought for ${formatDuration(seconds)}` : 'Thinking...';

  return (
    <div>
      <button
        type="button"
        className="flex w-fit cursor-pointer items-center gap-2 px-2 py-1"
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className={cn(
            statusDotClass(isComplete ? 'complete' : 'thinking'),
            'size-1.5 rounded-full',
          )}
        />
        <span className="text-copy text-neutral-subtle">{title}</span>
        <Chevron open={open} />
      </button>
      <Collapse open={open}>
        <div className="relative">
          <div className="bg-neutral-inverse/20 absolute top-0 bottom-0 left-[10.5px] w-px" />
          <div className="text-neutral-subtle bg-surface-subtle mt-1 ml-[22px] max-h-60 overflow-auto rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </Collapse>
    </div>
  );
}

const THINKING_VARIANTS = [
  'Thinking...',
  'Reasoning...',
  'Analyzing...',
  'Considering...',
  'Processing...',
  'Reflecting...',
  'Evaluating...',
];

const WRITING_VARIANTS = [
  'Writing response...',
  'Composing...',
  'Drafting a reply...',
  'Putting it together...',
  'Crafting response...',
  'Wrapping up...',
];

export const THINKING_LABEL = 'Thinking...';
export const WRITING_LABEL = 'Writing response...';

/**
 * The loader. While the turn runs it shows a spinning Zero mark and an animated
 * label for the current step; afterwards it collapses to "Thought", expandable
 * to the list of steps (tool calls, reasoning) joined by a connector line.
 */
export function ThinkingGroup({
  children,
  isComplete,
  activeLabel,
}: {
  children: ReactNode;
  isComplete: boolean;
  activeLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [displayLabel, setDisplayLabel] = useState(THINKING_LABEL);
  const phaseRef = useRef(0);
  const items = Children.toArray(children);
  const hasChildren = items.length > 0;

  useEffect(() => {
    if (!activeLabel || isComplete) return;
    const n = phaseRef.current++;
    if (activeLabel === THINKING_LABEL)
      setDisplayLabel(THINKING_VARIANTS[n % THINKING_VARIANTS.length]!);
    else if (activeLabel === WRITING_LABEL)
      setDisplayLabel(WRITING_VARIANTS[n % WRITING_VARIANTS.length]!);
    else setDisplayLabel(activeLabel);
  }, [activeLabel, isComplete]);

  const title = isComplete ? 'Thought' : displayLabel;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        className={cn(
          'flex w-fit items-center gap-2 py-1',
          hasChildren ? 'cursor-pointer' : 'cursor-default',
        )}
        onClick={() => hasChildren && setOpen((v) => !v)}
      >
        {!isComplete && <ZeroMark className="text-neutral-subtle size-3 animate-spin" />}
        <span className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={title}
              className="text-copy text-neutral-subtle block"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {title}
            </motion.span>
          </AnimatePresence>
        </span>
        {hasChildren && <Chevron open={open} />}
      </button>
      <Collapse open={open}>
        <div className="mt-2 ml-1 flex flex-col opacity-75">
          {items.map((child, i) => (
            <Fragment key={isValidElement(child) && child.key != null ? child.key : `item-${i}`}>
              {i > 0 && (
                <div className="ml-[10.5px]">
                  <div className="bg-neutral-inverse/20 h-3 w-px" />
                </div>
              )}
              {child}
            </Fragment>
          ))}
        </div>
      </Collapse>
    </div>
  );
}
