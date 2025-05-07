import { useState } from "react";
import { toast } from "sonner";


export function useCopyToClipboard() {
  const [isCopying, setIsCopying] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const copyToClipboard = async (
    text: string,
    successMessage?: { title?: string; description?: string }
  ) => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(text);
      setHasCopied(true);

      if (successMessage) {
        toast(successMessage.title || "Copied to clipboard", {
          description:
            successMessage.description ||
            "Text has been copied to your clipboard",
        });
      }

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Copy failed", {
        description: "Could not copy to clipboard",
      });
    } finally {
      setIsCopying(false);
    }
  };

  return {
    isCopying,
    hasCopied,
    copyToClipboard,
  };
}
