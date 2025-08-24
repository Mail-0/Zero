export const isMac =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  (/macintosh|mac os x/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
