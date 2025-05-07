'use client';

import type { CookieCategory } from './cookies';

interface CookieOptions {
  category: CookieCategory;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: Date;
}

const DEFAULT_OPTIONS = {
  path: '/',
  maxAge: 365 * 24 * 60 * 60,
};

class CookieUtils {
  private static cookieRegistry: Map<string, CookieCategory> = new Map();

  static registerCookie(name: string, category: CookieCategory) {
    this.cookieRegistry.set(name, category);
  }

  static getCookieCategory(name: string): CookieCategory | undefined {
    return this.cookieRegistry.get(name);
  }

  static setCookie(name: string, value: string, options: CookieOptions): void {
    const cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    const cookieOptions: string[] = [];

    if (options.path) cookieOptions.push(`path=${options.path}`);
    if (options.domain) cookieOptions.push(`domain=${options.domain}`);
    if (options.secure) cookieOptions.push('secure');
    if (options.sameSite) cookieOptions.push(`samesite=${options.sameSite}`);
    if (options.expires) cookieOptions.push(`expires=${options.expires.toUTCString()}`);

    document.cookie = `${cookieString}${cookieOptions.length ? '; ' + cookieOptions.join('; ') : ''}`;
  }

  static getCookie(name: string): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const parts = cookie.split('=').map((c) => c.trim());
      const cookieName = parts[0];
      const cookieValue = parts[1];
      if (cookieName === name && cookieValue !== undefined) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  }

  static deleteCookie(name: string, options?: Pick<CookieOptions, 'path' | 'domain'>): void {
    const opts: CookieOptions = {
      ...options,
      category: 'necessary',
      expires: new Date(0),
    };
    this.setCookie(name, '', opts);
  }

  static getAllCookies(): { [key: string]: string } {
    return document.cookie.split(';').reduce(
      (acc, cookie) => {
        const [name, value] = cookie.split('=').map((c) => c.trim());
        if (name && value) {
          acc[name] = decodeURIComponent(value);
        }
        return acc;
      },
      {} as { [key: string]: string },
    );
  }

  static removeAllCookiesByCategory(category: CookieCategory) {
    const allCookies = this.getAllCookies();

    Object.keys(allCookies).forEach((cookieName) => {
      const cookieCategory = this.getCookieCategory(cookieName);
      if (cookieCategory === category) {
        this.deleteCookie(cookieName, { path: '/' });
      }
    });
  }

  static cleanupRejectedCookies(acceptedCategories: CookieCategory[]): void {
    const cookieMapping: Record<string, CookieCategory> = {
      _ga: 'analytics',
      _gid: 'analytics',
      _fbp: 'marketing',
      // TODO: Add more cookie mappings as needed
    };

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const parts = cookie.split('=').map((c) => c.trim());
      const cookieName = parts[0];
      if (
        cookieName &&
        cookieMapping[cookieName] &&
        !acceptedCategories.includes(cookieMapping[cookieName])
      ) {
        this.deleteCookie(cookieName, { path: '/' });
      }
    }
  }

  static cleanupMarketingCookies(): void {
    const marketingCookies = [
      '_fbp',
      '_gcl_au',
      '_uetsid',
      '_uetvid',
      // TODO: Add more marketing cookie names as needed
    ];

    marketingCookies.forEach((cookieName) => {
      this.deleteCookie(cookieName, { path: '/' });
    });
  }

  static getCookiesByCategory(category: CookieCategory): string[] {
    const cookieMapping: Record<string, CookieCategory> = {
      _ga: 'analytics',
      _gid: 'analytics',
      _fbp: 'marketing',
      // TODO:Add more cookie mappings as needed
    };

    return Object.entries(cookieMapping)
      .filter(([_, cookieCategory]) => cookieCategory === category)
      .map(([cookieName]) => cookieName);
  }
}

export default CookieUtils;
