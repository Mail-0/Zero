import { addStyleTags, doesContainStyleTags, template } from '@/lib/email-utils.client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { defaultUserSettings } from '@zero/server/schemas';
import { fixNonReadableColors } from '@/lib/email-utils';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { m } from '@/paraglide/messages';

export function MailIframe({ html, senderEmail }: { html: string; senderEmail: string }) {
  const { data, refetch } = useSettings();
  const queryClient = useQueryClient();
  const isTrustedSender = useMemo(
    () => data?.settings?.externalImages || data?.settings?.trustedSenders?.includes(senderEmail),
    [data?.settings, senderEmail],
  );
  const [cspViolation, setCspViolation] = useState(false);
  const [temporaryImagesEnabled, setTemporaryImagesEnabled] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
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
        trustedSenders: data?.settings.trustedSenders
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

  const { data: processedHtml } = useQuery({
    queryKey: ['email-template', html, isTrustedSender || temporaryImagesEnabled],
    queryFn: () => template(html, isTrustedSender || temporaryImagesEnabled),
    staleTime: 30 * 60 * 1000, // Increase cache time to 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  });



  const calculateAndSetHeight = useCallback(() => {
    if (!iframeRef.current?.contentWindow?.document.body) return;

    const body = iframeRef.current.contentWindow.document.body;
    const boundingRectHeight = body.getBoundingClientRect().height;
    const scrollHeight = body.scrollHeight;

    if (body.innerText.trim() === '') {
      setHeight(0);
      return;
    }

    // Use the larger of the two values to ensure all content is visible
    const newHeight = Math.max(boundingRectHeight, scrollHeight);
    setHeight(newHeight);
  }, [iframeRef, setHeight]);

  useEffect(() => {
    if (!iframeRef.current || !processedHtml) return;

    let finalHtml = processedHtml;
    const containsStyleTags = doesContainStyleTags(processedHtml);
    if (!containsStyleTags) {
      finalHtml = addStyleTags(processedHtml);
    }

    const url = URL.createObjectURL(new Blob([finalHtml], { type: 'text/html' }));
    iframeRef.current.src = url;

    const handler = () => {
      if (iframeRef.current?.contentWindow?.document.body) {
        calculateAndSetHeight();
        fixNonReadableColors(iframeRef.current.contentWindow.document.body);
      }
      setTimeout(calculateAndSetHeight, 500);
    };

    iframeRef.current.onload = handler;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [processedHtml, calculateAndSetHeight]);

  useEffect(() => {
    if (iframeRef.current?.contentWindow?.document.body) {
      const body = iframeRef.current.contentWindow.document.body;
      body.style.backgroundColor =
        resolvedTheme === 'dark' ? 'rgb(10, 10, 10)' : 'rgb(245, 245, 245)';
      requestAnimationFrame(() => {
        fixNonReadableColors(body);
      });
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const ctrl = new AbortController();
    window.addEventListener(
      'message',
      (event) => {
        if (event.data.type === 'csp-violation') {
          setCspViolation(true);
        }
      },
      { signal: ctrl.signal },
    );

    return () => ctrl.abort();
  }, []);

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
          <button onClick={() => void trustSender()} className="ml-2 cursor-pointer underline">
            {m['common.actions.trustSender']()}
          </button>
        </div>
      )}
      <iframe
        height={height}
        ref={iframeRef}
        className={cn(
          '!min-h-0 w-full flex-1 overflow-hidden px-4 transition-opacity duration-200',
        )}
        title="Email Content"
        style={{
          width: '100%',
          overflow: 'hidden',
        }}
      />
    </>
  );
}
