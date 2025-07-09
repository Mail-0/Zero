import { LinkedIn, Twitter, Discord } from '../icons/icons';
import { motion, useInView } from 'motion/react';
import { Button } from '../ui/button';
import { Link } from 'react-router';
import { useRef } from 'react';
import React from 'react';

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
    <div className="bg-panelDark m-4 hidden flex-col items-center justify-center rounded-xl md:flex">
      <div>
        {/* <div className="h-[527px] w-screen bg-gradient-to-b from-violet-600 via-orange-400 to-slate-950 blur-2xl" /> */}
        <div>
          <img
            src="/gradient.svg"
            alt="logo"
            width={1000}
            height={100}
            className="w-screen rounded-t-2xl"
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
                  className="lg:to-panelDark inline-block text-center text-2xl font-bold text-white sm:text-4xl md:text-5xl lg:bg-gradient-to-b lg:from-[#84878D] lg:via-[#84878D] lg:bg-clip-text lg:text-8xl lg:text-transparent"
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
                <div className="justify-start text-center text-lg leading-7 font-normal text-white lg:text-2xl">
                  Get started and see how 0.email helps you process your inbox in a fraction of the
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
                  <Button className="h-8 bg-white text-black">Get Started</Button>
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-50 mx-auto mt-52 mb-12 flex max-w-[2900px] flex-col items-start justify-start gap-10 self-stretch px-4">
        <div className="flex w-full items-start justify-between lg:w-[900px]">
          <div className="inline-flex flex-col items-start justify-between self-stretch">
            <div className="inline-flex w-8 items-center justify-start gap-3">
              <a href="/">
                <img src="/white-icon.svg" alt="logo" width={100} height={100} />
              </a>
            </div>
            <div className="inline-flex items-center justify-start gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 rounded-[999px] bg-white/10 p-2 backdrop-blur-[20px] transition-colors hover:bg-white/20"
                >
                  <div className="relative h-3.5 w-3.5 overflow-hidden">
                    <social.icon className="absolute h-3.5 w-3.5 fill-white" />
                  </div>
                </a>
              ))}
            </div>
            <div className="flex items-center justify-start gap-3">
              <div className="justify-start text-base leading-none font-normal text-white opacity-80">
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
          <div className="flex flex-1 items-start justify-end gap-10 opacity-0 md:opacity-100">
            <div className="inline-flex flex-col items-start justify-start gap-5">
              <div className="justify-start self-stretch text-sm font-normal text-white/40">
                Resources
              </div>
              <div className="flex flex-col items-start justify-start gap-4 self-stretch">
                <a target="_blank" href="https://trust.inc/zero" className="w-full">
                  <div className="justify-start self-stretch text-base leading-none font-normal text-white opacity-80 transition-opacity hover:opacity-100">
                    SOC2
                  </div>
                </a>
                <a href="/privacy" className="w-full" target="_blank">
                  <div className="justify-start self-stretch text-base leading-none text-white opacity-80 transition-opacity hover:opacity-100">
                    Privacy Policy
                  </div>
                </a>
              </div>
            </div>
            <div className="inline-flex flex-col items-start justify-start gap-5">
              <div className="justify-start self-stretch text-sm font-normal text-white/40">
                Product
              </div>
              <div className="flex flex-col items-start justify-start gap-4 self-stretch">
                <a
                  href="https://x.com/nizzyabi/status/1918064165530550286"
                  className="w-full"
                  target="_blank"
                >
                  <div className="justify-start self-stretch text-base leading-none text-white opacity-80 transition-opacity hover:opacity-100">
                    Chat with Zero
                  </div>
                </a>
                <a
                  href="https://x.com/nizzyabi/status/1918051282881069229"
                  className="w-full"
                  target="_blank"
                >
                  <div className="justify-start self-stretch text-base leading-none text-white opacity-80 transition-opacity hover:opacity-100">
                    Zero AI
                  </div>
                </a>
                <a
                  href="https://x.com/nizzyabi/status/1919292505260249486"
                  className="w-full"
                  target="_blank"
                >
                  <div className="justify-start self-stretch text-base leading-none text-white opacity-80 transition-opacity hover:opacity-100">
                    Shortcuts
                  </div>
                </a>
              </div>
            </div>
            <div className="inline-flex flex-col items-start justify-start gap-5">
              <div className="justify-start self-stretch text-sm font-normal text-white/40">
                Company
              </div>
              <div className="flex flex-col items-start justify-start gap-4 self-stretch">
                <a target="_self" href="/contributors" className="w-full">
                  <div className="justify-start self-stretch text-base leading-none font-normal text-white opacity-80 transition-opacity hover:opacity-100">
                    Contributors
                  </div>
                </a>
                <a target="_self" href="/about" className="w-full">
                  <div className="justify-start self-stretch text-base leading-none font-normal text-white opacity-80 transition-opacity hover:opacity-100">
                    About
                  </div>
                </a>
                <a target="_blank" href="https://github.com/Mail-0/Zero" className="w-full">
                  <div className="justify-start self-stretch text-base leading-none font-normal text-white opacity-80 transition-opacity hover:opacity-100">
                    Github
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="h-0.5 self-stretch bg-white/20" />
        <div className="flex flex-col items-start justify-start gap-6 self-stretch">
          <div className="inline-flex items-center justify-between self-stretch">
            <div className="justify-start text-xs leading-tight font-medium text-white opacity-80 sm:text-sm">
              © 2025 Zero Email Inc, All Rights Reserved
            </div>
            <div className="flex items-center justify-start gap-4">
              <Link
                to="/about"
                className="justify-start text-sm leading-tight font-normal text-white/70 opacity-80 transition-opacity hover:opacity-100"
              >
                About
              </Link>
              <div className="h-5 w-0 outline outline-1 outline-offset-[-0.50px] outline-white/20" />

              <Link
                to="/terms"
                className="justify-start text-sm leading-tight font-normal text-white/70 opacity-80 transition-opacity hover:opacity-100"
              >
                Terms & Conditions
              </Link>
              <div className="h-5 w-0 outline outline-1 outline-offset-[-0.50px] outline-white/20" />
              <Link
                to="/privacy"
                className="justify-start text-sm leading-tight font-normal text-white/70 opacity-80 transition-opacity hover:opacity-100"
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
