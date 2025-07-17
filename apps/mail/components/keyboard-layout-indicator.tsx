/**
 * Keyboard Layout Indicator Component
 * Shows the current detected keyboard layout and confidence
 */

import { keyboardLayoutMapper, type LayoutDetectionResult } from '@/utils/keyboard-layout-map';
import { KeyboardIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function KeyboardLayoutIndicator() {
  const layoutInfo = useKeyboardLayout();

  if (!layoutInfo || layoutInfo.layout === 'unknown') {
    return null;
  }

  const getLayoutDisplayName = (layout: string) => {
    const names = {
      qwerty: 'QWERTY',
      dvorak: 'Dvorak',
      colemak: 'Colemak',
      azerty: 'AZERTY',
      qwertz: 'QWERTZ',
    };
    return names[layout as keyof typeof names] || layout.toUpperCase();
  };

  return (
    <div className="text-muted-foreground flex items-center space-x-2 text-xs">
      <KeyboardIcon />
      <span>{getLayoutDisplayName(layoutInfo.layout)}</span>
    </div>
  );
}

export function useKeyboardLayout() {
  const [layoutInfo, setLayoutInfo] = useState<LayoutDetectionResult | null>(null);

  useEffect(() => {
    const updateLayoutInfo = () => {
      const info = keyboardLayoutMapper.getDetectedLayout();
      setLayoutInfo(info);
      console.log('Detected keyboard layout:', info);
    };

    updateLayoutInfo();

    const handleFocus = () => {
      setTimeout(() => {
        updateLayoutInfo();
        console.log('Window focused, updated keyboard layout');
      }, 100);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  return layoutInfo;
}
