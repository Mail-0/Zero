import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { defaultUserSettings } from '@zero/db/user_settings_default';
import { fixNonReadableColors } from '@/lib/email-utils';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { template } from '@/lib/email-utils.client';
import { useMutation } from '@tanstack/react-query';
import { useSettings } from '@/hooks/use-settings';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MailIframe({ html, senderEmail }: { html: string; senderEmail: string }) {
  const { data, refetch } = useSettings();
  const isTrustedSender = useMemo(
    () => data?.settings?.externalImages || data?.settings?.trustedSenders?.includes(senderEmail),
    [data?.settings, senderEmail],
  );
  const [cspViolation, setCspViolation] = useState(false);
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const { resolvedTheme } = useTheme();
  const trpc = useTRPC();
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());

  const onTrustSender = useCallback(
    async (senderEmail: string) => {
      setImagesEnabled(true);

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
        toast.error('Failed to trust sender');
      } else {
        refetch();
      }
    },
    [data?.settings, refetch],
  );

  useEffect(() => {
    if (isTrustedSender) {
      setImagesEnabled(true);
    }
  }, [isTrustedSender]);

  const t = useTranslations();

  const calculateAndSetHeight = useCallback(() => {
    if (!iframeRef.current?.contentWindow?.document.body) return;

    const body = iframeRef.current.contentWindow.document.body;
    const boundingRectHeight = body.getBoundingClientRect().height;
    const scrollHeight = body.scrollHeight;

    // Use the larger of the two values to ensure all content is visible
    setHeight(Math.max(boundingRectHeight, scrollHeight));
    if (body.innerText.trim() === '') {
      setHeight(0);
    }
  }, [iframeRef, setHeight]);

  const { theme } = useTheme();

  useEffect(() => {
    if (!iframeRef.current) return;

    requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement);
      const backgroundColor = styles.getPropertyValue('--panel').trim();

      template(html, imagesEnabled, backgroundColor).then((htmlDoc) => {
        if (!iframeRef.current) return;
        const url = URL.createObjectURL(new Blob([htmlDoc], { type: 'text/html' }));
        iframeRef.current.src = url;

        const handler = () => {
          if (iframeRef.current?.contentWindow?.document.body) {
            calculateAndSetHeight();
            fixNonReadableColors(iframeRef.current.contentWindow.document.body);
          }
          // setLoaded(true);
          // Recalculate after a slight delay to catch any late-loading content
          setTimeout(calculateAndSetHeight, 500);
        };
        iframeRef.current.onload = handler;
      });
    });

    return () => {
      //   URL.revokeObjectURL(url);
    };
  }, [calculateAndSetHeight, html, imagesEnabled, theme]);

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
      {cspViolation && !imagesEnabled && !data?.settings?.externalImages && (
        <div className="flex items-center justify-start bg-amber-600/20 px-2 py-1 text-sm text-amber-600">
          <p>{t('common.actions.hiddenImagesWarning')}</p>
          <button
            onClick={() => setImagesEnabled(!imagesEnabled)}
            className="ml-2 cursor-pointer underline"
          >
            {imagesEnabled ? t('common.actions.disableImages') : t('common.actions.showImages')}
          </button>
          <button
            onClick={() => void onTrustSender(senderEmail)}
            className="ml-2 cursor-pointer underline"
          >
            {t('common.actions.trustSender')}
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
        // allow-scripts is safe, because the CSP will prevent scripts from running that don't have our unique nonce.
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-scripts"
        style={{
          width: '100%',
          overflow: 'hidden',
        }}
      />
    </>
  );
}
