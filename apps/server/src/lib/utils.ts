import type { AppContext, EProviders, Sender } from '../types';
import { env } from 'cloudflare:workers';

export const parseHeaders = (token: string) => {
  const headers = new Headers();
  headers.set('Cookie', token);
  return headers;
};

/**
 * Mock context for testing
 */
export const c = {
  env,
  json: (data: any, status: number) => ({
    data,
    status,
  }),
  text: (data: any, status: number) => ({
    data,
    status,
  }),
} as unknown as AppContext;

export const getNotificationsUrl = (provider: EProviders) => {
  return env.VITE_PUBLIC_BACKEND_URL + '/a8n/notify/' + provider;
};

export async function setSubscribedState(
  connectionId: string,
  providerId: EProviders,
): Promise<void> {
  return await env.subscribed_accounts.put(
    `${connectionId}__${providerId}`,
    new Date().toISOString(),
  );
}

export async function cleanupOnFailure(connectionId: string): Promise<void> {
  return await env.subscribed_accounts.delete(connectionId);
}

export const FOLDERS = {
  SPAM: 'spam',
  INBOX: 'inbox',
  ARCHIVE: 'archive',
  BIN: 'bin',
  DRAFT: 'draft',
  SENT: 'sent',
  SNOOZED: 'snoozed',
} as const;

export const LABELS = {
  SPAM: 'SPAM',
  INBOX: 'INBOX',
  UNREAD: 'UNREAD',
  IMPORTANT: 'IMPORTANT',
  SENT: 'SENT',
  TRASH: 'TRASH',
  SNOOZED: 'SNOOZED',
} as const;

export const FOLDER_NAMES = [
  'inbox',
  'spam',
  'bin',
  'unread',
  'starred',
  'important',
  'sent',
  'draft',
  'snoozed',
];

export const FOLDER_TAGS: Record<string, string[]> = {
  [FOLDERS.SPAM]: [LABELS.SPAM],
  [FOLDERS.INBOX]: [LABELS.INBOX],
  [FOLDERS.ARCHIVE]: [],
  [FOLDERS.SENT]: [LABELS.SENT],
  [FOLDERS.BIN]: [LABELS.TRASH],
  [FOLDERS.SNOOZED]: [LABELS.SNOOZED],
};

export const getFolderTags = (folder: string): string[] => {
  return FOLDER_TAGS[folder] || [];
};

export const cleanEmailAddress = (email: string = '') => {
  return email.replace(/[<>]/g, '').trim();
};

export const truncateFileName = (name: string, maxLength = 15) => {
  if (name.length <= maxLength) return name;
  const extIndex = name.lastIndexOf('.');
  if (extIndex !== -1 && name.length - extIndex <= 5) {
    return `${name.slice(0, maxLength - 5)}...${name.slice(extIndex)}`;
  }
  return `${name.slice(0, maxLength)}...`;
};

export type FilterSuggestion = {
  filter: string;
  description: string;
  prefix: string;
};

export const extractFilterValue = (filter: string): string => {
  if (!filter || !filter.includes(':')) return '';

  const colonIndex = filter.indexOf(':');
  const value = filter.substring(colonIndex + 1);

  return value || '';
};

export const defaultPageSize = 20;

export function createSectionId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileIcon = (mimeType: string): string => {
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return '📊';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return '📝';
  if (mimeType.includes('image')) return ''; // Empty for images as they're handled separately
  return '📎'; // Default icon
};

export const generateConversationId = (): string => {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const contentToHTML = (content: string) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin: 0; padding: 0;">
${content}
</body></html>`;

export const constructReplyBody = (
  formattedMessage: string,
  originalDate: string,
  originalSender: Sender | undefined,
  otherRecipients: Sender[],
  quotedMessage?: string,
) => {
  const senderName = originalSender?.name || originalSender?.email || 'Unknown Sender';
  const recipientEmails = otherRecipients.map((r) => r.email).join(', ');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="">
        ${formattedMessage}
      </div>
      <div style="padding-left: 16px; border-left: 3px solid #e2e8f0; color: #64748b;">
        <div style="font-size: 12px;">
          On ${originalDate}, ${senderName} ${recipientEmails ? `&lt;${recipientEmails}&gt;` : ''} wrote:
        </div>
        <div style="">
          ${quotedMessage || ''}
        </div>
      </div>
    </div>
  `;
};

export const getMainSearchTerm = (searchQuery: string): string => {
  // Don't highlight terms if this is a date-based search
  const datePatterns = [
    /emails?\s+from\s+(\w+)\s+(\d{4})/i, // "emails from [month] [year]"
    /emails?\s+from\s+(\w+)/i, // "emails from [month]"
    /emails?\s+from\s+(\d{4})/i, // "emails from [year]"
    /emails?\s+from\s+last\s+(\w+)/i, // "emails from last [time period]"
    /emails?\s+from\s+(\d+)\s+(\w+)\s+ago/i, // "emails from [X] [time period] ago"
  ];

  // If it's a date-based search, don't highlight anything
  for (const pattern of datePatterns) {
    if (searchQuery.match(pattern)) {
      return '';
    }
  }

  // Handle other natural language queries
  const naturalLanguageMatches = {
    'emails from': /emails?\s+from\s+(\w+)/i,
    'mail from': /mail\s+from\s+(\w+)/i,
    from: /\bfrom\s+(\w+)/i,
    to: /\bto\s+(\w+)/i,
    about: /\babout\s+(\w+)/i,
    regarding: /\bregarding\s+(\w+)/i,
  };

  // Try to match natural language patterns
  for (const [, pattern] of Object.entries(naturalLanguageMatches)) {
    const match = searchQuery.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If no natural language match, remove search operators and date-related terms
  const cleanedQuery = searchQuery
    .replace(/\b(from|to|subject|has|in|after|before):\s*/gi, '')
    .replace(/\b(is|has):\s*/gi, '')
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
      '',
    )
    .replace(/\b\d{4}\b/g, '') // Remove 4-digit years
    .replace(/["']/g, '')
    .trim();

  // Split by spaces and get the first meaningful term
  const terms = cleanedQuery.split(/\s+/);
  return terms[0] || '';
};

export function parseNaturalLanguageSearch(query: string): string {
  // Common search patterns
  const patterns = [
    // From pattern
    {
      regex: /^from\s+([^:\s]+)/i,
      transform: (match: string[]) => `from:${match[1]}`,
    },
    // To pattern
    {
      regex: /^to\s+([^:\s]+)/i,
      transform: (match: string[]) => `to:${match[1]}`,
    },
    // Subject pattern
    {
      regex: /^subject\s+([^:\s]+)/i,
      transform: (match: string[]) => `subject:${match[1]}`,
    },
    // Has attachment pattern
    {
      regex: /^has\s+(attachment|file)/i,
      transform: () => 'has:attachment',
    },
    // Is pattern (unread, read, starred)
    {
      regex: /^is\s+(unread|read|starred)/i,
      transform: (match: string[]) => `is:${match[1]}`,
    },
  ];

  // Check if query matches any pattern
  for (const pattern of patterns) {
    const match = query.match(pattern.regex);
    if (match) {
      return pattern.transform(match);
    }
  }

  return query;
}

export function parseNaturalLanguageDate(query: string): { from?: Date; to?: Date } | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Common date patterns
  const patterns = [
    // "emails from [month] [year]"
    {
      regex: /(?:emails?|mail)\s+from\s+(\w+)\s+(\d{4})/i,
      transform: (match: string[]) => {
        const monthNames = [
          'january',
          'february',
          'march',
          'april',
          'may',
          'june',
          'july',
          'august',
          'september',
          'october',
          'november',
          'december',
        ];
        const monthIndex = monthNames.findIndex((m) =>
          m.toLowerCase().startsWith(match[1]?.toLowerCase() ?? ''),
        );
        if (monthIndex === -1) return null;

        const year = parseInt(match[2] ?? currentYear.toString());
        const from = new Date(year, monthIndex, 1);
        const to = new Date(year, monthIndex + 1, 0); // Last day of the month
        return { from, to };
      },
    },
    // "emails from [month]" (assumes current year)
    {
      regex: /(?:emails?|mail)\s+from\s+(\w+)/i,
      transform: (match: string[]) => {
        const monthNames = [
          'january',
          'february',
          'march',
          'april',
          'may',
          'june',
          'july',
          'august',
          'september',
          'october',
          'november',
          'december',
        ];
        const monthIndex = monthNames.findIndex((m) =>
          m.toLowerCase().startsWith(match[1]?.toLowerCase() ?? ''),
        );
        if (monthIndex === -1) return null;

        const from = new Date(currentYear, monthIndex, 1);
        const to = new Date(currentYear, monthIndex + 1, 0); // Last day of the month
        return { from, to };
      },
    },
  ];

  // Check if query matches any pattern
  for (const pattern of patterns) {
    const match = query.match(pattern.regex);
    if (match) {
      const result = pattern.transform(match);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

// Duplicated on server & client
export const categorySearchValues = [
  'is:important NOT is:sent NOT is:draft',
  'NOT is:draft (is:inbox OR (is:sent AND to:me))',
  'is:personal NOT is:sent NOT is:draft',
  'is:updates NOT is:sent NOT is:draft',
  'is:promotions NOT is:sent NOT is:draft',
  'is:unread NOT is:sent NOT is:draft',
];

export const cleanSearchValue = (q: string): string => {
  const escapedValues = categorySearchValues.map((value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return q
    .replace(new RegExp(escapedValues.join('|'), 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
};
