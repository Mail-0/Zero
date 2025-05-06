import * as defaultTheme from 'tailwindcss/defaultTheme';
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--theme-color-primary)',
        secondary: 'var(--theme-color-secondary)',
        background: 'var(--theme-color-background)',
        surface: 'var(--theme-color-surface)',
        text: 'var(--theme-color-text)',
      },
      fontFamily: {
        sans: ['var(--theme-font-body)', ...defaultTheme.fontFamily.sans],
        heading: ['var(--theme-font-heading)', ...defaultTheme.fontFamily.sans],
        mono: ['Geist_Mono', ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        card: 'var(--theme-radius-card)',
        button: 'var(--theme-radius-button)',
      },
      boxShadow: {
        card: 'var(--theme-shadow-card)',
      },
    },
  },
} satisfies Config;
