import { useState } from 'react';
import { toast } from 'sonner';

export function useCopyToClipboard(resetDelay = 2000) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  
  const copyToClipboard = (value: string, id: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(id);
    toast.success("Link copied to clipboard!");
    
    setTimeout(() => {
      setCopiedValue(null);
    }, resetDelay);
  };
  
  return { copiedValue, copyToClipboard };
} 