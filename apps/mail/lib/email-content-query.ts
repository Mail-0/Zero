import { queryOptions } from '@tanstack/react-query';

export type EmailContentTheme = 'light' | 'dark';

export interface ProcessedEmailContent {
  html: string;
  hasBlockedImages: boolean;
}

type ProcessEmailContent = (input: {
  html: string;
  shouldLoadImages: boolean;
  theme: EmailContentTheme;
}) => Promise<{ processedHtml: string; hasBlockedImages: boolean }>;

/**
 * Single source of truth for the processed email body cache.
 *
 * The list-row prefetch (useThread) and the renderer (MailContent) MUST produce
 * identical keys, otherwise the prefetch is wasted and opening a thread waits on
 * a fresh processEmailContent round trip.
 */
export const resolveEmailContentTheme = (resolvedTheme: string | undefined): EmailContentTheme =>
  resolvedTheme === 'dark' ? 'dark' : 'light';

export const shouldLoadEmailImages = (
  settings: { externalImages?: boolean; trustedSenders?: string[] } | undefined,
  senderEmail: string | undefined,
): boolean =>
  !!settings?.externalImages ||
  (!!senderEmail && !!settings?.trustedSenders?.includes(senderEmail));

export const emailContentQueryKey = (
  messageId: string | undefined,
  shouldLoadImages: boolean,
  theme: EmailContentTheme,
) => ['email-content', messageId, shouldLoadImages, theme] as const;

export const emailContentQueryOptions = ({
  messageId,
  html,
  shouldLoadImages,
  theme,
  process,
  enabled = true,
}: {
  messageId: string | undefined;
  html: string | undefined;
  shouldLoadImages: boolean;
  theme: EmailContentTheme;
  process: ProcessEmailContent;
  enabled?: boolean;
}) =>
  queryOptions({
    queryKey: emailContentQueryKey(messageId, shouldLoadImages, theme),
    queryFn: async (): Promise<ProcessedEmailContent> => {
      const result = await process({ html: html ?? '', shouldLoadImages, theme });
      return { html: result.processedHtml, hasBlockedImages: result.hasBlockedImages };
    },
    enabled: enabled && !!messageId && html !== undefined,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
