interface NavigatorUAData {
  userAgentData?: {
    platform?: string;
  };
}

const agent = globalThis.navigator?.userAgent ?? '';
const platform =
  (globalThis.navigator as Navigator & NavigatorUAData)?.userAgentData?.platform ??
  globalThis.navigator?.platform ??
  globalThis.process?.platform ??
  '';

export const IS_MAC =
  typeof window !== 'undefined' &&
  (/macintosh|mac os x/i.test(agent) ||
    (platform === 'MacIntel' && globalThis.navigator?.maxTouchPoints > 1));
