import { GmailColor, OutlookColor } from '../components/icons/icons';

export const I18N_LOCALE_COOKIE_NAME = 'i18n:locale';
export const SIDEBAR_COOKIE_NAME = 'sidebar:state';
export const AI_SIDEBAR_COOKIE_NAME = 'ai-sidebar:state';
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const SIDEBAR_WIDTH = '14rem';
export const SIDEBAR_WIDTH_MOBILE = '14rem';
export const SIDEBAR_WIDTH_ICON = '3rem';
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
export const BASE_URL = import.meta.env.VITE_PUBLIC_APP_URL;
export const MAX_URL_LENGTH = 2000;
export const CACHE_BURST_KEY = 'cache-burst:v0.0.3';

export const emailProviders = [
  {
    name: 'Gmail',
    icon: GmailColor,
    providerId: 'google',
  },
  //   {
  //     name: 'Outlook',
  //     icon: OutlookColor,
  //     providerId: 'microsoft',
  //   },
] as const;

interface GmailColor {
  textColor: string;
  backgroundColor: string;
}

export const GMAIL_COLORS: GmailColor[] = [
  { textColor: '#000000', backgroundColor: '#E2E2E2' },
  { textColor: '#D50000', backgroundColor: '#F28B82' },
  { textColor: '#EF6C00', backgroundColor: '#FBBC04' },
  { textColor: '#F9A825', backgroundColor: '#FFF475' },
  { textColor: '#188038', backgroundColor: '#CCFF90' },
  { textColor: '#1967D2', backgroundColor: '#AECBFA' },
  { textColor: '#9334E6', backgroundColor: '#D7AEFB' },
  { textColor: '#D93025', backgroundColor: '#FDCFE8' },
  { textColor: '#3C1E1E', backgroundColor: '#E6C9A8' },
  { textColor: '#3C4043', backgroundColor: '#E8EAED' },
  { textColor: '#0B4B3F', backgroundColor: '#A7FFEB' },
  { textColor: '#174EA6', backgroundColor: '#C5CAE9' },
  { textColor: '#33691E', backgroundColor: '#F0F4C3' },
  { textColor: '#007B83', backgroundColor: '#B2EBF2' },
  { textColor: '#5B2C6F', backgroundColor: '#E1BEE7' },
  { textColor: '#BF360C', backgroundColor: '#FFAB91' },
];
