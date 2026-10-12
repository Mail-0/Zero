import {
  emailContentQueryOptions,
  resolveEmailContentTheme,
  shouldLoadEmailImages,
} from '@/lib/email-content-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { markThreadBodyPainted, markThreadContentCache } from '@/lib/perf';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { defaultUserSettings } from '@zero/server/schemas';
import { fixNonReadableColors } from '@/lib/email-utils';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { useSettings } from '@/hooks/use-settings';
import { m } from '@/paraglide/messages';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MailContentProps {
  id: string;
  html: string;
  senderEmail: string;
  /** Used only for thread-open perf instrumentation. */
  threadId?: string;
}

export function MailContent({ id, html, senderEmail, threadId }: MailContentProps) {
  const { data, refetch } = useSettings();
  const queryClient = useQueryClient();
  const isTrustedSender = useMemo(
    () => shouldLoadEmailImages(data?.settings, senderEmail),
    [data?.settings, senderEmail],
  );
  const [cspViolation, setCspViolation] = useState(false);
  const [temporaryImagesEnabled, setTemporaryImagesEnabled] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const { resolvedTheme } = useTheme();
  const trpc = useTRPC();

  const { mutateAsync: saveUserSettings } = useMutation({
    ...trpc.settings.save.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const { mutateAsync: trustSender } = useMutation({
    mutationFn: async () => {
      const existingSettings = data?.settings ?? {
        ...defaultUserSettings,
        timezone: getBrowserTimezone(),
      };

      const { success } = await saveUserSettings({
        ...existingSettings,
        trustedSenders: data?.settings?.trustedSenders
          ? data.settings.trustedSenders.concat(senderEmail)
          : [senderEmail],
      });

      if (!success) {
        throw new Error('Failed to trust sender');
      }
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      toast.error('Failed to trust sender');
    },
  });

  const { mutateAsync: processEmailContent } = useMutation(
    trpc.mail.processEmailContent.mutationOptions(),
  );

  const contentQueryOptions = emailContentQueryOptions({
    messageId: id,
    html,
    shouldLoadImages: isTrustedSender || temporaryImagesEnabled,
    theme: resolveEmailContentTheme(resolvedTheme),
    process: processEmailContent,
  });

  // Record (once, at mount) whether the list-row prefetch already warmed this body.
  const [initialContentCacheHit] = useState(
    () => queryClient.getQueryData(contentQueryOptions.queryKey) !== undefined,
  );
  useEffect(() => {
    markThreadContentCache(threadId, initialContentCacheHit);
  }, [threadId, initialContentCacheHit]);

  const { data: processedData } = useQuery(contentQueryOptions);

  useEffect(() => {
    if (processedData) {
      if (processedData.hasBlockedImages) {
        setCspViolation(true);
      }
    }
  }, [processedData]);

  useEffect(() => {
    if (!hostRef.current || shadowRootRef.current) return;

    shadowRootRef.current = hostRef.current.attachShadow({ mode: 'open' });
  }, []);

  useEffect(() => {
    if (!shadowRootRef.current || !processedData) return;

    shadowRootRef.current.innerHTML = processedData.html;
    markThreadBodyPainted(threadId);
  }, [processedData, threadId]);

  useEffect(() => {
    if (!shadowRootRef.current) return;

    const root = shadowRootRef.current;

    const applyFix: () => void = () => {
      const topLevelEls = Array.from(root.children) as HTMLElement[];
      topLevelEls.forEach((el) => {
        try {
          fixNonReadableColors(el, {
            defaultBackground: resolvedTheme === 'dark' ? 'rgb(10,10,10)' : '#ffffff',
          });
        } catch (err) {
          console.error('Failed to fix colors in email content:', err);
        }
      });
    };

    requestAnimationFrame(applyFix);
  }, [processedData, resolvedTheme]);

  useEffect(() => {
    if (isTrustedSender || temporaryImagesEnabled) {
      setCspViolation(false);
    }
  }, [isTrustedSender, temporaryImagesEnabled]);

  const handleImageError = useCallback(
    (e: Event) => {
      const target = e.target as HTMLImageElement;
      if (target.tagName === 'IMG') {
        if (!(isTrustedSender || temporaryImagesEnabled)) {
          setCspViolation(true);
        }
        target.style.display = 'none';
      }
    },
    [isTrustedSender, temporaryImagesEnabled],
  );

  useEffect(() => {
    if (!shadowRootRef.current) return;

    shadowRootRef.current.addEventListener('error', handleImageError, true);

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A') {
        e.preventDefault();
        const href = target.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          window.open(href, '_blank', 'noopener,noreferrer');
        } else if (href && href.startsWith('mailto:')) {
          window.location.href = href;
        }
      }
    };

    shadowRootRef.current.addEventListener('click', handleClick);

    return () => {
      shadowRootRef.current?.removeEventListener('error', handleImageError, true);
      shadowRootRef.current?.removeEventListener('click', handleClick);
    };
  }, [handleImageError, processedData]);

  return (
    <>
      {cspViolation && !isTrustedSender && !data?.settings?.externalImages && (
        <div className="flex items-center justify-start bg-amber-600/20 px-2 py-1 text-sm text-amber-600">
          <p>{m['common.actions.hiddenImagesWarning']()}</p>
          <button
            onClick={() => setTemporaryImagesEnabled(!temporaryImagesEnabled)}
            className="ml-2 cursor-pointer underline"
          >
            {temporaryImagesEnabled
              ? m['common.actions.disableImages']()
              : m['common.actions.showImages']()}
          </button>
          <button
            onClick={async () => {
              try {
                await trustSender();
              } catch (error) {
                console.error('Error trusting sender:', error);
              }
            }}
            className="ml-2 cursor-pointer underline"
          >
            {m['common.actions.trustSender']()}
          </button>
        </div>
      )}
      <div
        ref={hostRef}
        className={cn('mail-content no-scrollbar w-full flex-1 overflow-scroll px-4')}
      />
    </>
  );
}
