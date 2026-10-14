import { ChevronRight, Link as LinkIcon, Mail } from 'lucide-react';
import type { MessageSources as Sources } from './chat-parts';
import { useThread } from '@/hooks/use-threads';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/** Collapsible "N Sources" list under an answer: web pages and emails it used. */
export function MessageSources({ sources }: { sources: Sources }) {
  const [open, setOpen] = useState(false);
  const count = sources.links.length + sources.threadIds.length;
  if (count === 0) return null;

  return (
    <div className="flex flex-col gap-2 self-start">
      <button
        type="button"
        aria-expanded={open}
        aria-label={count === 1 ? 'Show 1 source' : `Show ${count} sources`}
        onClick={() => setOpen((v) => !v)}
        className="text-copy text-neutral-subtle hover:text-neutral inline-flex w-fit cursor-pointer items-center gap-1 transition-colors"
      >
        <LinkIcon className="size-3 shrink-0" />
        <span className="tabular-nums">{count}</span>
        <span>{count === 1 ? 'Source' : 'Sources'}</span>
        <ChevronRight
          className={cn(
            'size-3 shrink-0 transition-transform duration-200 ease-out',
            open && 'rotate-90',
          )}
        />
      </button>
      <div
        className={cn(
          'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0">
          <div className="mt-0.5 flex flex-col gap-1.5">
            {sources.threadIds.map((id) => (
              <ThreadSource key={id} threadId={id} />
            ))}
            {sources.links.map((link) => (
              <WebSourceLink key={link.url} url={link.url} title={link.title} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const rowClass =
  'text-copy-sm text-neutral-subtle hover:text-neutral flex min-w-0 items-center gap-2 text-left underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current';

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function WebSourceLink({ url, title }: { url: string; title?: string }) {
  const host = hostname(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url} className={rowClass}>
      <LinkIcon className="size-4 shrink-0 opacity-60" />
      <span className="truncate">{title || host}</span>
      <span className="text-neutral-weak shrink-0">{host}</span>
    </a>
  );
}

function ThreadSource({ threadId }: { threadId: string }) {
  const [, setThreadId] = useQueryState('threadId');
  const [, setIsFullScreen] = useQueryState('isFullScreen');
  const { data } = useThread(threadId);
  const latest = data?.latest;
  if (!latest) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setThreadId(threadId);
        setIsFullScreen(null);
      }}
      className={cn(rowClass, 'cursor-pointer')}
    >
      <Mail className="size-4 shrink-0 opacity-60" />
      <span className="truncate">{latest.subject || '(no subject)'}</span>
      <span className="text-neutral-weak shrink-0 truncate">{latest.sender?.name}</span>
    </button>
  );
}
