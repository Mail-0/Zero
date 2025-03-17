import { fixNonReadableColors, template } from '@/lib/email-utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function MailIframe({ html }: { html: string }) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [height, setHeight] = useState(300);
	const { resolvedTheme } = useTheme();
	const [loaded, setLoaded] = useState(false);

	const iframeDoc = useMemo(() => template(html), [html]);

	const t = useTranslations();

  const calculateAndSetHeight = () => {
    if (!iframeRef.current?.contentWindow?.document.body) return;

    const body = iframeRef.current.contentWindow.document.body;
    const boundingRectHeight = body.getBoundingClientRect().height;
    const scrollHeight = body.scrollHeight;

    // Use the larger of the two values to ensure all content is visible
    setHeight(Math.max(boundingRectHeight, scrollHeight));
  };

  useEffect(() => {
    if (!iframeRef.current) return;
    const url = URL.createObjectURL(new Blob([iframeDoc], { type: "text/html" }));
    iframeRef.current.src = url;
    const handler = () => {
      if (iframeRef.current?.contentWindow?.document.body) {
        calculateAndSetHeight();
        fixNonReadableColors(iframeRef.current.contentWindow.document.body);
      }
      setLoaded(true);
      // Recalculate after a slight delay to catch any late-loading content
      setTimeout(calculateAndSetHeight, 500);
    };
    iframeRef.current.onload = handler;

		return () => {
			URL.revokeObjectURL(url);
		};
	}, [iframeDoc]);

	useEffect(() => {
		if (iframeRef.current?.contentWindow?.document.body) {
			iframeRef.current.contentWindow.document.body.style.backgroundColor =
				resolvedTheme === 'dark' ? 'rgb(10, 10, 10)' : 'rgb(245, 245, 245)';
			fixNonReadableColors(iframeRef.current.contentWindow.document.body);
		}
	}, [resolvedTheme]);

	return (
		<>
			{!loaded && (
				<div className="flex h-full w-full items-center justify-center gap-4 p-8">
					<Loader2 className="size-4 animate-spin" />
					<span>{t('common.mailDisplay.loadingMailContent')}</span>
				</div>
			)}
			<iframe
				scrolling="no"
				height={height}
				ref={iframeRef}
				className={cn(
					'w-full flex-1 overflow-hidden transition-opacity duration-200',
					loaded ? 'opacity-100' : 'opacity-0',
				)}
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
