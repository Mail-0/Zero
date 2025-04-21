import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { defaultUserSettings } from '@zero/db/user_settings_default';
import { fixNonReadableColors, template } from '@/lib/email-utils';
import { saveUserSettings } from '@/actions/settings';
import { getBrowserTimezone } from '@/lib/timezones';
import { useSettings } from '@/hooks/use-settings';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MailIframe({ html, senderEmail }: { html: string; senderEmail: string }) {
  const { settings, mutate } = useSettings();
  const isTrustedSender = settings?.trustedSenders?.includes(senderEmail);
  const [cspViolation, setCspViolation] = useState(false);
  const [imagesEnabled, setImagesEnabled] = useState(
    isTrustedSender || settings?.externalImages || false,
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);
  const { resolvedTheme } = useTheme();

  const onTrustSender = useCallback(
    async (senderEmail: string) => {
      setImagesEnabled(true);

      console.log(settings);

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
    },
    [settings, mutate],
  );

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
      {cspViolation && !imagesEnabled && !settings?.externalImages && (
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

export interface DynamicIframeProps extends React.HTMLAttributes<HTMLIFrameElement> {
  html: string;
  className?: string;
  title?: string;
  sanitize?: boolean;
}

export function DynamicIframe({
  html,
  className,
  title = 'Email Content',
  sanitize = true,
  ...props
}: DynamicIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    const processedHtml = sanitize ? DOMPurify.sanitize(html) : html;

    // Create and inject the content
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: inherit;
            line-height: 1.5;
            margin: 0;
            padding: 0;
            overflow-wrap: break-word;
            word-wrap: break-word;
          }
          
          :root {
            color-scheme: light dark;
          }
          
          @media (prefers-color-scheme: dark) {
            body {
              color: #f5f5f5;
            }
            a {
              color: #3b82f6;
            }
            img {
              filter: brightness(.8) contrast(1.2);
            }
          }
          
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          
          img {
            max-width: 100%;
            height: auto;
          }
          
          table {
            max-width: 100%;
            overflow-x: auto;
            display: block;
          }
          
          @media (min-width: 768px) {
            table {
              display: table;
            }
          }
        </style>
      </head>
      <body>${processedHtml}</body>
      </html>
    `);
    iframeDoc.close();

    // Apply parent's text color to iframe body
    const updateStyles = () => {
      if (iframe.contentWindow) {
        const parentStyle = window.getComputedStyle(iframe.parentElement || document.body);
        const parentColor = parentStyle.color;
        const parentBg = parentStyle.backgroundColor;

        const styleElement = iframeDoc.createElement('style');
        styleElement.textContent = `
          body {
            color: ${parentColor};
            background-color: transparent;
          }
        `;
        iframeDoc.head.appendChild(styleElement);
      }
    };

    updateStyles();

    // Size adjustment
    const resizeIframe = () => {
      if (!iframe.contentWindow || !iframeDoc.body) return;

      const newHeight = iframeDoc.body.scrollHeight;
      const newWidth = iframeDoc.body.scrollWidth;

      if (newHeight !== height) {
        setHeight(newHeight);
        iframe.style.height = `${newHeight}px`;
      }

      if (newWidth !== width && newWidth > iframe.clientWidth) {
        setWidth(newWidth);
      }
    };

    // Set up resize observer to handle content changes
    const resizeObserver = new ResizeObserver(() => {
      resizeIframe();
    });

    resizeObserver.observe(iframeDoc.body);

    // Additional event listeners for images loading
    const images = iframeDoc.querySelectorAll('img');
    images.forEach((img) => {
      img.addEventListener('load', resizeIframe);
      img.addEventListener('error', (e) => {
        console.error('Image failed to load:', e);
        resizeIframe();
      });
    });

    // Handle link clicks to open in new tab
    const links = iframeDoc.querySelectorAll('a');
    links.forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });

    // Immediate resize and one after a short delay to catch any late-loading content
    resizeIframe();
    const timeoutId = setTimeout(resizeIframe, 100);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      images.forEach((img) => {
        img.removeEventListener('load', resizeIframe);
        img.removeEventListener('error', resizeIframe);
      });
      clearTimeout(timeoutId);
    };
  }, [html, height, width, sanitize]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      sandbox="allow-same-origin"
      className={cn('w-full border-0', className)}
      {...props}
    />
  );
}
