import { LinkedIn, Twitter, Discord } from '../icons/icons';
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { Link } from 'react-router';
import { useRef } from 'react';

const socialLinks = [
  {
    name: 'Twitter',
    href: 'https://x.com/mail0dotcom',
    icon: Twitter,
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/company/mail0/',
    icon: LinkedIn,
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/mail0',
    icon: Discord,
  },
];

export default function Footer() {
  const ref = useRef(null);

  return (
    <div className="bg-card mx-1 mb-3 flex flex-col items-center justify-center rounded-xl border border-border md:mx-4 md:mb-3">
      <div>
        <div>
          <img
            src="/gradient.svg"
            alt="logo"
            width={1000}
            height={100}
            className="w-screen rounded-t-2xl opacity-60"
          />
        </div>
        <div className="relative bottom-20 inline-flex w-full justify-center lg:bottom-60">
          <div
            ref={ref}
            className="relative inline-flex w-full flex-col items-center justify-center gap-20 rounded-full"
          >
            <div className="flex flex-col items-center justify-center px-2">
              <div className="flex flex-col items-center py-5">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-block text-center text-2xl font-bold text-foreground sm:text-4xl md:text-5xl lg:text-8xl"
                >
                  <span>Experience the Future of </span> <br />
                  Email Today
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="hidden flex-col items-center justify-start md:flex"
              >
                <div className="text-muted-foreground justify-start text-center text-lg font-normal leading-7 lg:text-2xl">
                  Get started and see how Doorman helps you process your inbox in a fraction of the
                  time.
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex w-fit flex-col items-center justify-center md:pt-4"
              >
                <a href="/login">
                  <Button className="h-8 cursor-pointer">Get Started</Button>
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-50 mx-auto mb-12 mt-10 flex max-w-[2900px] flex-col items-start justify-start gap-10 self-stretch px-4 md:mt-52">
        <div className="flex w-full flex-col items-start justify-between md:flex-row lg:w-[900px]">
          <div className="mb-10 inline-flex flex-col items-start justify-between gap-4 self-stretch md:mb-0">
            <div className="inline-flex w-8 items-center justify-start gap-3">
              <a href="/">
                <img src="/black-icon.svg" alt="Doorman logo" width={100} height={100} />
              </a>
            </div>
            <div className="inline-flex items-center justify-start gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-accent flex items-center justify-center gap-2.5 rounded-[999px] p-2 transition-colors hover:bg-accent/80"
                >
                  <div className="relative h-3.5 w-3.5 overflow-hidden">
                    <social.icon className="fill-foreground absolute h-3.5 w-3.5" />
                  </div>
                </a>
              ))}
            </div>
            <div className="flex items-center justify-start gap-3">
              <div className="text-muted-foreground justify-start text-base font-normal leading-none">
                Backed by
              </div>
              <a href="https://www.ycombinator.com" target="_blank" rel="noopener noreferrer">
                <div className="relative w-36 overflow-hidden">
                  <img
                    src="/yc.svg"
                    className="bg-transparent"
                    alt="logo"
                    width={100}
                    height={100}
                  />
                </div>
              </a>
            </div>
          </div>
          <div className="flex flex-1 items-start justify-end gap-5 md:gap-10">
            <div className="inline-flex flex-col items-start justify-start gap-5">
              <div className="text-muted-foreground justify-start self-stretch text-sm font-normal">
                Resources
              </div>
              <div className="flex flex-col items-start justify-start gap-4 self-stretch">
                <a
                  target="_blank"
                  rel="noreferrer"
                  href="https://trust.inc/zero"
                  className="w-full"
                >
                  <div className="text-foreground/80 justify-start self-stretch text-sm leading-none transition-opacity hover:opacity-100 md:text-base">
                    SOC2
                  </div>
                </a>
                <a href="/privacy" className="w-full" target="_blank">
                  <div className="text-foreground/80 justify-start self-stretch text-sm leading-none transition-opacity hover:opacity-100 md:text-base">
                    Privacy Policy
                  </div>
                </a>
              </div>
            </div>
            <div className="inline-flex flex-col items-start justify-start gap-5">
              <div className="text-muted-foreground justify-start self-stretch text-sm font-normal">
                Product
              </div>
              <div className="flex flex-col items-start justify-start gap-4 self-stretch">
                <a
                  href="https://x.com/nizzyabi/status/1918064165530550286"
                  className="w-full"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="text-foreground/80 justify-start self-stretch text-sm leading-none transition-opacity hover:opacity-100 md:text-base">
                    Chat with Doorman
                  </div>
                </a>
                <a
                  href="https://x.com/nizzyabi/status/1918051282881069229"
                  className="w-full"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="text-foreground/80 justify-start self-stretch text-sm leading-none transition-opacity hover:opacity-100 md:text-base">
                    Doorman AI
                  </div>
                </a>
                <a
                  href="https://x.com/nizzyabi/status/1919292505260249486"
                  className="w-full"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="text-foreground/80 justify-start self-stretch text-sm leading-none transition-opacity hover:opacity-100 md:text-base">
                    Shortcuts
                  </div>
                </a>
              </div>
            </div>
            <div className="inline-flex flex-col items-start justify-start gap-5">
              <div className="text-muted-foreground justify-start self-stretch text-sm font-normal">
                Company
              </div>
              <div className="flex flex-col items-start justify-start gap-4 self-stretch">
                <a target="_blank" href="/contributors" className="w-full">
                  <div className="text-foreground/80 justify-start self-stretch text-sm font-normal leading-none transition-opacity hover:opacity-100 md:text-base">
                    Contributors
                  </div>
                </a>
                <a target="_blank" href="/about" className="w-full">
                  <div className="text-foreground/80 justify-start self-stretch text-sm font-normal leading-none transition-opacity hover:opacity-100 md:text-base">
                    About
                  </div>
                </a>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href="https://github.com/Mail-0/Zero"
                  className="w-full"
                >
                  <div className="text-foreground/80 justify-start self-stretch text-sm font-normal leading-none transition-opacity hover:opacity-100 md:text-base">
                    Github
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-border h-0.5 self-stretch" />
        <div className="flex flex-col items-start justify-start gap-6 self-stretch">
          <div className="inline-flex flex-col-reverse items-center justify-between gap-3 self-stretch md:flex-row">
            <div className="text-muted-foreground justify-start text-xs font-medium leading-tight sm:text-sm">
              © 2025 Doorman Inc, All Rights Reserved
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/about"
                className="text-foreground/70 justify-start text-nowrap text-sm font-normal leading-tight transition-opacity hover:opacity-100"
              >
                About
              </Link>
              <div className="outline-border h-5 w-0 outline outline-1 outline-offset-[-0.50px]" />

              <Link
                to="/terms"
                className="text-foreground/70 justify-start text-nowrap text-sm font-normal leading-tight transition-opacity hover:opacity-100"
              >
                Terms & Conditions
              </Link>
              <div className="outline-border h-5 w-0 outline outline-1 outline-offset-[-0.50px]" />
              <Link
                to="/privacy"
                className="text-foreground/70 justify-start text-nowrap text-sm font-normal leading-tight transition-opacity hover:opacity-100"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
