import { useCallback } from 'react';

declare global {
  interface Window {
    Featurebase?: any;
  }
}

export function useFeaturebase() {
  const openFeaturebase = useCallback(() => {
    if (window.Featurebase) {
      // This will open the Featurebase widget
      const button = document.querySelector('[data-featurebase-feedback]') as HTMLElement;
      if (button) {
        button.click();
      }
    }
  }, []);

  return { openFeaturebase };
} 