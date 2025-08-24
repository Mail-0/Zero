import { TrackingCategory } from '@coinbase/cookie-manager';

export type CookieCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export interface CategoryInfo {
  name: string;
  description: string;
  required?: boolean;
  trackingCategory: TrackingCategory;
}

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export const COOKIE_CATEGORIES: Record<CookieCategory, CategoryInfo> = {
  necessary: {
    name: 'Strictly Necessary',
    description:
      'These cookies are essential for the website to function properly and cannot be switched off. They are usually only set in response to actions made by you such as setting your privacy preferences, logging in, or filling in forms.',
    required: true,
    trackingCategory: TrackingCategory.NECESSARY,
  },
  functional: {
    name: 'Functional',
    description:
      'These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third-party providers whose services we have added to our pages. If you do not allow these cookies, some or all of these services may not function properly.',
    trackingCategory: TrackingCategory.FUNCTIONAL,
  },
  analytics: {
    name: 'Analytics & Performance',
    description:
      'These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular and see how visitors move around the site. All information these cookies collect is aggregated and therefore anonymous. If you do not allow these cookies we will not know when you have visited our site.',
    trackingCategory: TrackingCategory.PERFORMANCE,
  },
  marketing: {
    name: 'Marketing & Targeting',
    description:
      'These cookies may be set through our site by our advertising partners. They may be used by those companies to build a profile of your interests and show you relevant adverts on other sites. They do not store directly personal information but are based on uniquely identifying your browser and internet device. If you do not allow these cookies, you will experience less targeted advertising.',
    trackingCategory: TrackingCategory.TARGETING,
  },
};

export const COOKIE_CONSENT_KEY = 'cookieConsent';
export const COOKIE_PREFERENCES_KEY = 'cookiePreferences';
