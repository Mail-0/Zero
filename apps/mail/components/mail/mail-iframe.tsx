// mail-iframe.tsx
import { addStyleTags, doesContainStyleTags, template } from '@/lib/email-utils.client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { defaultUserSettings } from '@zero/server/schemas';
import { fixNonReadableColors } from '@/lib/email-utils';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { useSettings } from '@/hooks/use-settings';
import { useTranslations } from 'use-intl';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { cleanEmailHtml, stripTablePadding } from '../ui/cleanEmailHtml';

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

  const { data: processedHtml, isLoading: isProcessingHtml } = useQuery({
    queryKey: ['email-template', html, isTrustedSender || temporaryImagesEnabled],
    queryFn: () => template(html, isTrustedSender || temporaryImagesEnabled),
    staleTime: 30 * 60 * 1000, // Increase cache time to 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  });

  const t = useTranslations();

  const calculateAndSetHeight = useCallback(() => {
    if (!iframeRef.current?.contentWindow?.document.body) return;
    const body = iframeRef.current.contentWindow.document.body;
    const boundingRectHeight = body.getBoundingClientRect().height;
    const scrollHeight = body.scrollHeight;
    setHeight(Math.max(boundingRectHeight, scrollHeight));
    if (body.innerText.trim() === '') {
      setHeight(0);
    }
  }, []);

  useEffect(() => {
    if (!iframeRef.current || !processedHtml) return;

    const injectedStyle = [
      '<style>',
      // base body reset
      'html, body {',
      '  margin: 0;',
      '  padding: 0;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
      '  font-size: 14px;',
      '  font-weight: 400;',
      '  line-height: 1.6;',
      `  color: ${resolvedTheme === 'dark' ? '#f4f4f5' : '#1a1a1a'};`,
`  background-color: ${resolvedTheme === 'dark' ? '#1a1a1a' : '#ffffff'};`,
      '  -webkit-font-smoothing: antialiased;',
      '}',
      // enforce text styling on all elements likely to contain text
      'body, table, td, tr, div, span, p, a, strong {',
      '  font-family: inherit !important;',
      '  font-size: inherit !important;',
      '  font-weight: inherit !important;',
      '  line-height: inherit !important;',
      '  color: inherit !important;',
      '}',
      'p {',
      '  margin: 0 0 14px;',
      '}',
      'a {',
      '  color: #4f46e5;',
      '  text-decoration: underline;',
      '}',
      'strong {',
      '  font-weight: 600;',
      '}',
      // collapse layout spacing
      'table, tbody, tr, td {',
      '  padding: 0 !important;',
      '  margin: 0 !important;',
      '  border: none !important;',
      '  height: auto !important;',
      '}',
      'tr[height="32"], td[width="8"] {',
      '  display: none !important;',
      '}',
      '</style>',
    ].join('\n');
    
    
    
    

    // ✅ Determine if sanitization is safe
const isSanitizationSafe = !html.includes('accounts.google.com') && !html.includes('gstatic.com');

// ✅ Conditionally sanitize or pass through original HTML
const sanitizedHtml = isSanitizationSafe ? cleanEmailHtml(processedHtml) : processedHtml;
const cleanedHtml = isSanitizationSafe ? stripTablePadding(sanitizedHtml) : sanitizedHtml;

console.log('[Sanitization skipped]', !isSanitizationSafe);
console.log('[CLEANED HTML]', cleanedHtml);


    console.log('[SANITIZED HTML]', sanitizedHtml);
    console.log('[CLEANED HTML]', cleanedHtml);

    const htmlToInject = `
      <html>
        <head>${injectedStyle}</head>
        <body>${cleanedHtml}</body>
      </html>
    `;

    const blob = new Blob([htmlToInject], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;

    const handler = () => {
      if (iframeRef.current?.contentWindow?.document.body) {
        calculateAndSetHeight();
        fixNonReadableColors(iframeRef.current.contentWindow.document.body);
      }
      setTimeout(calculateAndSetHeight, 500);
    };

    iframeRef.current.onload = handler;
    return () => URL.revokeObjectURL(url);
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

  // Show loading fallback while processing HTML (similar to HydrateFallback pattern)
  if (isProcessingHtml) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-muted-foreground text-sm">Processing email content...</div>
      </div>
    );
  }

  return (
    <>
      {cspViolation && !isTrustedSender && !data?.settings?.externalImages && (
        <div className="flex items-center justify-start bg-amber-600/20 px-2 py-1 text-sm text-amber-600">
          <p>{t('common.actions.hiddenImagesWarning')}</p>
          <button
            onClick={() => setTemporaryImagesEnabled(!temporaryImagesEnabled)}
            className="ml-2 cursor-pointer underline"
          >
            {temporaryImagesEnabled
              ? t('common.actions.disableImages')
              : t('common.actions.showImages')}
          </button>
          <button onClick={() => void trustSender()} className="ml-2 cursor-pointer underline">
            {t('common.actions.trustSender')}
          </button>
        </div>
      )}
      <iframe
        height={height}
        ref={iframeRef}
        className={cn('!min-h-0 w-full flex-1 overflow-hidden px-4 transition-opacity duration-200')}
        title="Email Content"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-scripts"
        style={{ width: '100%', overflow: 'hidden' }}
      />
    </>
  );
}
