import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useThread } from '@/hooks/use-threads';
import { MailLabels } from '../mail/mail-list';
import { cn, getEmailLogo } from '@/lib/utils';
import type { ToolCall } from './chat-parts';
import { Check, Copy } from 'lucide-react';
import { Tools } from '../../types/tools';
import { format } from 'date-fns-tz';
import { useQueryState } from 'nuqs';
import { useState } from 'react';

/** The card shown in place of a status line for tools in DISPLAY_TOOL_NAMES. */
export function ToolResult({ call }: { call: ToolCall }) {
  switch (call.toolName) {
    case Tools.GetThread:
      return <GetThreadResult call={call} />;
    case Tools.GetUserLabels:
      return <LabelsResult result={call.result} />;
    case Tools.ComposeEmail:
      return <ComposedEmailResult call={call} />;
    default:
      return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

type Label = {
  id: string;
  name: string;
  type?: string;
  color?: { backgroundColor?: string; textColor?: string };
};
const isLabel = (value: unknown): value is Label =>
  isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string';

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn('bg-surface-subtle w-full rounded-xl p-0.5', className)}>
    <div className="bg-surface flex flex-col rounded-[10px] shadow-xs">{children}</div>
  </div>
);

function GetThreadResult({ call }: { call: ToolCall }) {
  let threadId: string | null = null;
  if (typeof call.result === 'string') {
    threadId = call.result.match(/<thread id="([^"]+)" ?\/>/)?.[1] ?? null;
  }
  if (!threadId && isRecord(call.args) && typeof call.args.id === 'string') threadId = call.args.id;
  if (!threadId) return null;
  return (
    <Card>
      <ThreadPreview threadId={threadId} />
    </Card>
  );
}

export function ThreadPreview({ threadId }: { threadId: string }) {
  const [, setThreadId] = useQueryState('threadId');
  const [, setIsFullScreen] = useQueryState('isFullScreen');
  const { data: thread } = useThread(threadId);
  const latest = thread?.latest;
  if (!latest) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setThreadId(threadId);
        setIsFullScreen(null);
      }}
      className="hover:bg-surface-subtle flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors"
    >
      <Avatar className="size-8 shrink-0">
        <AvatarImage className="rounded-full" src={getEmailLogo(latest.sender?.email)} />
        <AvatarFallback className="bg-surface-strong text-neutral-subtle rounded-full font-bold">
          {latest.sender?.name?.[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-copy text-neutral truncate font-medium">{latest.sender?.name}</p>
          <span className="text-copy-sm text-neutral-weak shrink-0">
            {latest.receivedOn ? format(latest.receivedOn, 'MMM d') : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-copy-sm text-neutral-subtle truncate">{latest.subject}</span>
          <MailLabels labels={latest.tags || []} />
        </div>
      </div>
    </button>
  );
}

function LabelsResult({ result }: { result: unknown }) {
  const raw = Array.isArray(result) ? result : isRecord(result) ? result.labels : undefined;
  const labels = (Array.isArray(raw) ? raw : []).filter(isLabel).filter((l) => l.type !== 'system');
  if (!labels.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span
          key={label.id}
          className="bg-surface-subtle text-copy-sm text-neutral-subtle inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
        >
          <span
            className="bg-neutral-inverse/30 size-1.5 rounded-full"
            style={
              label.color?.backgroundColor
                ? { backgroundColor: label.color.backgroundColor }
                : undefined
            }
          />
          {label.name}
        </span>
      ))}
    </div>
  );
}

function ComposedEmailResult({ call }: { call: ToolCall }) {
  const [copied, setCopied] = useState(false);
  if (!isRecord(call.result) || typeof call.result.newBody !== 'string' || !call.result.newBody)
    return null;
  const body = call.result.newBody;
  const args = isRecord(call.args) ? call.args : {};
  const to = Array.isArray(args.to) ? args.to.filter((v) => typeof v === 'string').join(', ') : '';
  const subject = typeof args.emailSubject === 'string' ? args.emailSubject : '';

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      {(to || subject) && (
        <div className="border-neutral-subtle text-copy-sm flex flex-col gap-0.5 border-b px-3 py-2">
          {to && (
            <div className="flex gap-2">
              <span className="text-neutral-weak w-12 shrink-0">To</span>
              <span className="text-neutral truncate">{to}</span>
            </div>
          )}
          {subject && (
            <div className="flex gap-2">
              <span className="text-neutral-weak w-12 shrink-0">Subject</span>
              <span className="text-neutral truncate">{subject}</span>
            </div>
          )}
        </div>
      )}
      <p className="text-copy text-neutral px-3 py-2.5 whitespace-pre-wrap">{body.trim()}</p>
      <div className="flex justify-end px-1.5 pb-1.5">
        <button
          type="button"
          onClick={copy}
          className="text-copy-sm text-neutral-subtle hover:text-neutral hover:bg-surface-subtle flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 transition-colors"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </Card>
  );
}
