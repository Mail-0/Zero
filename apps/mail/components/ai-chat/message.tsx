import type { ChatMessage } from './chat-parts';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type MessageProps = HTMLAttributes<HTMLDivElement> & { from: ChatMessage['role'] };

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full gap-2 py-2',
      from === 'user' ? 'is-user justify-end' : 'is-assistant',
      className,
    )}
    {...props}
  />
);

export const MessageContent = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'text-copy text-neutral flex min-w-0 flex-col gap-2 overflow-hidden break-words',
      'group-[.is-user]:bg-surface-subtle group-[.is-user]:max-w-[85%] group-[.is-user]:rounded-[14px] group-[.is-user]:px-3 group-[.is-user]:py-2',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
