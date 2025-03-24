'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { COOKIE_CATEGORIES, type CookieCategory } from '@/lib/cookies';
import CookieUtils from '@/lib/cookie-utils';

interface CookiePreferences {
  [key: string]: boolean;
}

interface CookieContextType {
  preferences: CookiePreferences;
  isLoaded: boolean;
  updatePreference: (category: CookieCategory, value: boolean) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  hasConsent: boolean;
}

const CookieContext = createContext<CookieContextType | null>(null);

const PREFERENCES_COOKIE = 'cookie_preferences';

export function CookieProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<CookiePreferences>(() =>
    Object.keys(COOKIE_CATEGORIES).reduce(
      (acc, key) => ({
        ...acc,
        [key]: COOKIE_CATEGORIES[key as CookieCategory].required || false,
      }),
      {},
    ),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadPreferences = () => {
      const storedPrefs = CookieUtils.getCookie(PREFERENCES_COOKIE);
      if (storedPrefs) {
        try {
          const parsedPrefs = JSON.parse(storedPrefs);
          Object.entries(COOKIE_CATEGORIES).forEach(([key, info]) => {
            if (info.required) {
              parsedPrefs[key] = true;
            }
          });
          setPreferences(parsedPrefs);
        } catch (error) {
          console.error('Error parsing cookie preferences:', error);
        }
      }
      setIsLoaded(true);
    };

    loadPreferences();
  }, []);

  const savePreferences = (newPreferences: CookiePreferences) => {
    // Store preferences with a 1-year expiry for GDPR compliance
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    CookieUtils.setCookie(PREFERENCES_COOKIE, JSON.stringify(newPreferences), {
      category: 'necessary',
      expires: new Date(Date.now() + oneYear),
      sameSite: 'Lax',
      secure: true,
    });

    const acceptedCategories = Object.entries(newPreferences)
      .filter(([_, accepted]) => accepted)
      .map(([category]) => category as CookieCategory);

    CookieUtils.cleanupRejectedCookies(acceptedCategories);
    logConsent(newPreferences);
  };

  const logConsent = (preferences: CookiePreferences) => {
    const consentData = {
      timestamp: new Date().toISOString(),
      preferences,
      userAgent: navigator.userAgent,
      // TODO: Add any other relevant data for compliance
    };

    console.log('Cookie consent logged:', consentData);
  };

  const updatePreference = (category: CookieCategory, value: boolean) => {
    const categoryInfo = COOKIE_CATEGORIES[category];
    if (categoryInfo.required) return;

    const newPreferences = { ...preferences, [category]: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);

    if (category === 'marketing' && !value) {
      CookieUtils.cleanupMarketingCookies();
    }
  };

  const acceptAll = () => {
    const newPreferences = Object.keys(COOKIE_CATEGORIES).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {},
    );
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const rejectAll = () => {
    const newPreferences = Object.keys(COOKIE_CATEGORIES).reduce(
      (acc, key) => ({
        ...acc,
        [key]: COOKIE_CATEGORIES[key as CookieCategory].required || false,
      }),
      {},
    );
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const hasConsent = useMemo(
    () => Object.values(preferences).some((value) => value),
    [preferences],
  );

  const value = {
    preferences,
    isLoaded,
    updatePreference,
    acceptAll,
    rejectAll,
    hasConsent,
  };

  return <CookieContext.Provider value={value}>{children}</CookieContext.Provider>;
}

export function useCookies() {
  const context = useContext(CookieContext);
  if (!context) {
    throw new Error('useCookies must be used within a CookieProvider');
  }
  return context;
}
