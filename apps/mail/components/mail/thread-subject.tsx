import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface ThreadSubjectProps {
  subject?: string;
}

export default function ThreadSubject({ subject }: ThreadSubjectProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const subjectContent = subject || '(no subject)';

  return (
    <div className="flex items-center gap-2">
      <span
        ref={textRef}
        className={cn(
          'line-clamp-1 cursor-pointer font-semibold md:max-w-[50ch]',
          !subject && 'opacity-50',
        )}
      >
        {subjectContent.trim()}
      </span>
    </div>
  );
}
