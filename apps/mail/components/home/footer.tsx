'use client';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Discord, Twitter } from '@/components/icons/icons';
import { Github } from 'lucide-react';
import Link from 'next/link';

const socialLinks = [
  {
    name: 'GitHub',
    href: 'https://github.com/Mail-0/Zero',
    icon: Github,
    ariaLabel: 'GitHub',
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/0email',
    icon: Discord,
    ariaLabel: 'Discord',
  },
  {
    name: 'Twitter',
    href: 'https://x.com/zerodotemail',
    icon: Twitter,
    ariaLabel: 'X (Twitter)',
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 w-full border-t border-gray-200/40 bg-gray-50/80 backdrop-blur-sm dark:border-gray-800/20 dark:bg-black/20">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-3">
          <div className="flex justify-center gap-6 md:justify-start">
            {socialLinks.map((social) => (
              <Link
                key={social.name}
                href={social.href}
                target="_blank"
                aria-label={social.ariaLabel}
                className="text-gray-500 transition-colors duration-200 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <social.icon className="h-5 w-5 transition-transform hover:scale-110" />
                <span className="sr-only">{social.ariaLabel}</span>
              </Link>
            ))}
          </div>

          <div className="flex justify-center gap-8 text-sm">
            <Link
              href="/"
              className="text-gray-600 transition-colors duration-200 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              About
            </Link>
            <Link
              href="/privacy"
              className="text-gray-600 transition-colors duration-200 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-gray-600 transition-colors duration-200 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Terms
            </Link>
            <Link
              href="/contributors"
              className="text-gray-600 transition-colors duration-200 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Contributors
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 md:justify-end">
            <ThemeToggle className="ml-3" />
            <div className="text-sm text-gray-500 dark:text-gray-400">Zero Email Inc. © 2025</div>|
            <a href="mailto:founders@0.email" className="text-sm text-gray-500 dark:text-gray-400">
              founders@0.email
            </a>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          131 Continental Dr, Newark, Delaware, 19713-4305, United States
        </div>
      </div>
    </footer>
  );
}
