"use client";

import Link from "next/link";
import { Github } from "lucide-react"
import { Discord, Twitter } from "@/components/icons/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const socialLinks = [
  {
    name: "GitHub",
    href: "https://github.com/Mail-0/Zero",
    icon: Github,
    ariaLabel: "GitHub"
  },
  {
    name: "Discord",
    href: "https://discord.gg/0email",
    icon: Discord,
    ariaLabel: "Discord"
  },
  {
    name: "Twitter",
    href: "https://x.com/zerodotemail",
    icon: Twitter,
    ariaLabel: "X (Twitter)"
  }
];

export default function Footer() {
  return (
    <footer className="w-full mt-16 bg-gray-50/80 dark:bg-black/20 backdrop-blur-sm border-t border-gray-200/40 dark:border-gray-800/20">
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="flex justify-center md:justify-start gap-6">
            {socialLinks.map((social) => (
              <Link 
                key={social.name}
                href={social.href} 
                target="_blank"
                aria-label={social.ariaLabel}
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
              >
                <social.icon className="h-5 w-5 hover:scale-110 transition-transform" />
                <span className="sr-only">{social.ariaLabel}</span>
              </Link>
            ))}
          </div>

          <div className="flex justify-center gap-8 text-sm">
            <Link 
              href="/" 
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            >
              About
            </Link>
            <Link 
              href="/privacy" 
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            >
              Privacy
            </Link>
            <Link 
              href="/terms" 
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            >
              Terms
            </Link>
            <Link 
              href="/contributors" 
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            >
              Contributors
            </Link>
          </div>

          <div className="flex items-center justify-center md:justify-end gap-3">
            <ThemeToggle className="ml-3" />
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Zero Email Inc. © 2025
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
          131 Continental Dr, Newark, Delaware, 19713-4305, United States
        </div>
      </div>
    </footer>
  );
} 