import { fixNonReadableColors, template } from "@/lib/email-utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function MailIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);
  const { resolvedTheme } = useTheme();
  const [loaded, setLoaded] = useState(false);

  const iframeDoc = useMemo(() => template(html), [html]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const url = URL.createObjectURL(new Blob([iframeDoc], { type: "text/html" }));
    iframeRef.current.src = url;
    const handler = () => {
      if (iframeRef.current?.contentWindow?.document.body) {
        const height = iframeRef.current.contentWindow.document.body.getBoundingClientRect().height;
        setHeight(height);
        fixNonReadableColors(iframeRef.current.contentWindow.document.body);
      }
      setLoaded(true);
    };
    iframeRef.current.onload = handler;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [iframeDoc]);

  useEffect(() => {
    if (iframeRef.current?.contentWindow?.document.body) {
      iframeRef.current.contentWindow.document.body.style.backgroundColor =
        resolvedTheme === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)";
      fixNonReadableColors(iframeRef.current.contentWindow.document.body);
    }
  }, [resolvedTheme]);

  return (
    <>
      {!loaded && (
        <div className="flex h-full w-full items-center justify-center gap-4 p-8">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading email content...</span>
        </div>
      )}
      <iframe
        scrolling="no"
        height={height}
        ref={iframeRef}
        className={cn(
          "w-full flex-1 overflow-hidden transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
        )}
        title="Email Content"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-scripts"
        style={{
          width: "100%",
          overflow: "hidden",
        }}
      />
    </>
  );
}
