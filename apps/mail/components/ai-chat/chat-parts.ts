import { Tools } from '../../types/tools';
import type { Message } from 'ai';

/**
 * Adapter between AI SDK v4 message parts (what `useAgentChat` gives us) and the
 * Orchid chat kit, which was written against v6 `tool-<name>` parts.
 */

export type ChatMessage = Pick<Message, 'id' | 'role' | 'experimental_attachments'> & {
  parts?: Message['parts'];
};
export type ChatAttachment = NonNullable<Message['experimental_attachments']>[number];
export type ChatPart = NonNullable<Message['parts']>[number];

export type AIStatus = 'thinking' | 'complete' | 'error';

export type ToolCall = {
  toolName: string;
  toolCallId: string;
  status: AIStatus;
  args: unknown;
  result: unknown;
};

export const isTextPart = (
  part: ChatPart | undefined,
): part is Extract<ChatPart, { type: 'text' }> => part?.type === 'text';

export const isReasoningPart = (
  part: ChatPart | undefined,
): part is Extract<ChatPart, { type: 'reasoning' }> => part?.type === 'reasoning';

export const isToolPart = (
  part: ChatPart | undefined,
): part is Extract<ChatPart, { type: 'tool-invocation' }> => part?.type === 'tool-invocation';

/**
 * v4 has no error state: a tool that threw stays in `call`, so a call that never
 * got a result once the turn is over is reported as an error.
 */
export function toToolCall(
  part: Extract<ChatPart, { type: 'tool-invocation' }>,
  isLoading: boolean,
): ToolCall {
  const { toolInvocation } = part;
  const hasResult = toolInvocation.state === 'result';
  return {
    toolName: toolInvocation.toolName,
    toolCallId: toolInvocation.toolCallId,
    status: hasResult ? 'complete' : isLoading ? 'thinking' : 'error',
    args: toolInvocation.args,
    result: hasResult ? toolInvocation.result : undefined,
  };
}

/** Tools that render real UI (a card) once they have a result. */
export const DISPLAY_TOOL_NAMES = new Set<string>([
  Tools.GetThread,
  Tools.GetUserLabels,
  Tools.ComposeEmail,
]);

type ToolLabels = { loading: string; done: (call: ToolCall) => string };

const count = (value: unknown) => (Array.isArray(value) ? value.length : undefined);
const threadIdCount = (args: unknown) =>
  count((args as { threadIds?: unknown } | undefined)?.threadIds);
const plural = (n: number | undefined, one: string, many: string) =>
  n === undefined ? many : `${n} ${n === 1 ? one : many}`;

const TOOL_LABELS: Record<string, ToolLabels> = {
  [Tools.InboxRag]: {
    loading: 'Searching your inbox...',
    done: (c) => {
      const n = count(c.result);
      return n === 0 ? 'No matching emails' : `Found ${plural(n, 'email', 'emails')}`;
    },
  },
  [Tools.GetThreadSummary]: { loading: 'Reading email...', done: () => 'Read email' },
  [Tools.GetThread]: { loading: 'Opening email...', done: () => 'Opened email' },
  [Tools.ComposeEmail]: { loading: 'Drafting email...', done: () => 'Drafted email' },
  [Tools.SendEmail]: { loading: 'Sending email...', done: () => 'Sent email' },
  [Tools.MarkThreadsRead]: {
    loading: 'Marking as read...',
    done: (c) => `Marked ${plural(threadIdCount(c.args), 'email', 'emails')} as read`,
  },
  [Tools.MarkThreadsUnread]: {
    loading: 'Marking as unread...',
    done: (c) => `Marked ${plural(threadIdCount(c.args), 'email', 'emails')} as unread`,
  },
  [Tools.ModifyLabels]: { loading: 'Updating labels...', done: () => 'Updated labels' },
  [Tools.GetUserLabels]: { loading: 'Checking your labels...', done: () => 'Checked labels' },
  [Tools.CreateLabel]: { loading: 'Creating label...', done: () => 'Created label' },
  [Tools.DeleteLabel]: { loading: 'Deleting label...', done: () => 'Deleted label' },
  [Tools.BulkDelete]: {
    loading: 'Deleting emails...',
    done: (c) => `Deleted ${plural(threadIdCount(c.args), 'email', 'emails')}`,
  },
  [Tools.BulkArchive]: {
    loading: 'Archiving emails...',
    done: (c) => `Archived ${plural(threadIdCount(c.args), 'email', 'emails')}`,
  },
  [Tools.WebSearch]: {
    loading: 'Searching the web...',
    done: (c) => {
      const n = count((c.result as { results?: unknown } | undefined)?.results);
      return n === 0 ? 'No web results' : `Found ${plural(n, 'web result', 'web results')}`;
    },
  },
  [Tools.BuildGmailSearchQuery]: {
    loading: 'Building a search...',
    done: () => 'Built a search',
  },
  [Tools.GetCurrentDate]: { loading: 'Checking the date...', done: () => 'Checked the date' },
};

const humanize = (toolName: string) =>
  toolName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export function getToolStatusLabel(toolName: string): string {
  return TOOL_LABELS[toolName]?.loading ?? `${humanize(toolName)}...`;
}

export function getToolLabel(call: ToolCall): string {
  if (call.status === 'thinking') return getToolStatusLabel(call.toolName);
  if (call.status === 'error') return `Couldn't ${humanize(call.toolName).toLowerCase()}`;
  return TOOL_LABELS[call.toolName]?.done(call) ?? humanize(call.toolName);
}

export type WebSource = { url: string; title?: string };
export type MessageSources = { links: WebSource[]; threadIds: string[] };

const MAX_FOUND_THREAD_SOURCES = 8;

const stringId = (args: unknown) => {
  const id = (args as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' ? id : undefined;
};

/**
 * What an answer was based on: web pages from web search (and any provider
 * `source` parts) plus the emails the assistant opened. If it only searched the
 * inbox without opening anything, the emails it found stand in.
 */
export function getMessageSources(parts: ChatPart[]): MessageSources {
  const links = new Map<string, WebSource>();
  const read = new Set<string>();
  const found = new Set<string>();

  for (const part of parts) {
    if (part.type === 'source' && part.source.sourceType === 'url') {
      links.set(part.source.url, { url: part.source.url, title: part.source.title });
      continue;
    }
    if (!isToolPart(part) || part.toolInvocation.state !== 'result') continue;
    const { toolName, args, result } = part.toolInvocation;

    if (toolName === Tools.WebSearch) {
      const results = (result as { results?: unknown } | undefined)?.results;
      for (const r of Array.isArray(results) ? results : []) {
        if (r && typeof r.url === 'string' && !links.has(r.url)) {
          links.set(r.url, {
            url: r.url,
            title: typeof r.title === 'string' ? r.title : undefined,
          });
        }
      }
    } else if (toolName === Tools.GetThreadSummary || toolName === Tools.GetThread) {
      const id = stringId(args);
      if (id) read.add(id);
    } else if (toolName === Tools.InboxRag && Array.isArray(result)) {
      for (const id of result) if (typeof id === 'string') found.add(id);
    }
  }

  const threadIds = read.size > 0 ? [...read] : [...found].slice(0, MAX_FOUND_THREAD_SOURCES);
  return { links: [...links.values()], threadIds };
}
