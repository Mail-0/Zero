import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { defaultUserSettings } from '@zero/db/user_settings_default';
import { fixNonReadableColors, template } from '@/lib/email-utils';
import { saveUserSettings } from '@/actions/settings';
import { getBrowserTimezone } from '@/lib/timezones';
import { useSettings } from '@/hooks/use-settings';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MailIframe({ html, senderEmail }: { html: string; senderEmail: string }) {
  const { settings, mutate } = useSettings();
  const isTrustedSender = settings?.trustedSenders?.includes(senderEmail);
  const [imagesEnabled, setImagesEnabled] = useState(
    isTrustedSender || settings?.externalImages || false,
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);
  const { resolvedTheme } = useTheme();

  const onTrustSender = useCallback(async (senderEmail: string) => {
    setImagesEnabled(true);

    const existingSettings = settings ?? {
      ...defaultUserSettings,
      timezone: getBrowserTimezone(),
    };

    const { success } = await saveUserSettings({
      ...existingSettings,
      trustedSenders: settings?.trustedSenders
        ? settings.trustedSenders.concat(senderEmail)
        : [senderEmail],
    });

    if (!success) {
      toast.error('Failed to trust sender');
    } else {
      mutate();
    }
  }, []);

  const iframeDoc = useMemo(() => template(html, imagesEnabled), [html, imagesEnabled]);

  const t = useTranslations();

  const calculateAndSetHeight = useCallback(() => {
    if (!iframeRef.current?.contentWindow?.document.body) return;

    const body = iframeRef.current.contentWindow.document.body;
    const boundingRectHeight = body.getBoundingClientRect().height;
    const scrollHeight = body.scrollHeight;

    // Use the larger of the two values to ensure all content is visible
    setHeight(Math.max(boundingRectHeight, scrollHeight));
  }, [iframeRef, setHeight]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const url = URL.createObjectURL(new Blob([iframeDoc], { type: 'text/html' }));
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

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [iframeDoc, calculateAndSetHeight]);

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

  return (
    <>
      {!imagesEnabled && !settings?.externalImages && (
        <div className="flex items-center justify-start bg-amber-500 p-2 text-sm text-amber-900">
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
      {/* {!loaded && (
        <div className="flex h-full w-full items-center justify-center gap-4 p-4">
          <div className="w-full space-y-4">
            <div className="flex flex-col space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[95%]" />
            </div>
            <div className="flex flex-col space-y-2">
              <Skeleton className="h-4 w-[88%]" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
          </div>
        </div>
      )} */}
      <iframe
        onClick={calculateAndSetHeight}
        height={height}
        ref={iframeRef}
        className={cn('w-full flex-1 overflow-hidden transition-opacity duration-200')}
        title="Email Content"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{
          width: '100%',
          overflow: 'hidden',
        }}
      />
    </>
  );
}
