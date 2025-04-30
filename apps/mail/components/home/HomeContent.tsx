'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  ListItem,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { PixelatedBackground, PixelatedLeft, PixelatedRight } from '@/components/home/pixelated-bg';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Command, Menu, MoveRight } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { SuccessEmailToast } from '../theme/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurvedArrow } from '../icons/icons';
import Balancer from 'react-wrap-balancer';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { toast } from 'sonner';
import Link from 'next/link';
import axios from 'axios';
import React from 'react';
import { z } from 'zod';
import { useTheme } from 'next-themes';

const tabs = [
  { label: 'Chat With Your Inbox', value: 'smart-categorization' },
  { label: 'Smart Labels', value: 'ai-features' },
  { label: 'Write Better Emails', value: 'feature-3' },
];

const resources = [
  {
    title: 'GitHub',
    href: 'https://github.com/Mail-0/Zero',
    description: 'Check out our open-source projects and contributions.',
    platform: 'github' as const,
  },
  {
    title: 'Twitter',
    href: 'https://x.com/zerodotemail',
    description: 'Follow us for the latest updates and announcements.',
    platform: 'twitter' as const,
  },
  {
    title: 'LinkedIn',
    href: 'https://www.linkedin.com/company/zerodotemail/',
    description: 'Connect with us professionally and stay updated.',
    platform: 'linkedin' as const,
  },
  {
    title: 'Discord',
    href: 'https://discord.gg/0email',
    description: 'Join our community and chat with the team.',
    platform: 'discord' as const,
  },
];

const betaSignupSchema = z.object({
  email: z.string().email().min(9),
});

export default function HomeContent() {
  const tabRefs = useRef<HTMLButtonElement[]>([]);
  const [glowStyle, setGlowStyle] = useState({ left: 0, width: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [signupCount, setSignupCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const { setTheme } = useTheme();

  const form = useForm<z.infer<typeof betaSignupSchema>>({
    resolver: zodResolver(betaSignupSchema),
    defaultValues: {
      email: '',
    },
  });

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  useEffect(() => {
    const fetchSignupCount = async () => {
      try {
        const response = await axios.get('/api/auth/early-access/count');
        setSignupCount(response.data.count);
      } catch (error) {
        console.error('Failed to fetch signup count:', error);
      }
    };

    fetchSignupCount();
  }, []);

  const handleTabChange = useCallback((value: string) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    const tab = tabRefs.current[index];
    if (tab) {
      const rect = tab.getBoundingClientRect();
      const listRect = tab.parentElement?.getBoundingClientRect();
      const offsetLeft = listRect ? rect.left - listRect.left : 0;

      const newWidth = rect.width * 0.9;
      const newLeft = offsetLeft + (rect.width - newWidth) / 2;

      setGlowStyle({ left: newLeft, width: newWidth });
    }
  }, []);

  useEffect(() => {
    if (tabs[0] && tabs[0].value) {
      handleTabChange(tabs[0].value);
    }
  }, [handleTabChange]);

  const onSubmit = async (values: z.infer<typeof betaSignupSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/auth/early-access', {
        email: values.email,
      });

      form.reset();
      setShowSuccess(true);
      toast.success("You're on the list! We'll notify you when we launch!");

      // Increment the signup count if it was a new signup
      if (response.status === 201 && signupCount !== null) {
        setSignupCount(signupCount + 1);
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Command+Enter (Mac) or Ctrl+Enter (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <main className="relative flex max-h-screen flex-1 flex-col overflow-hidden">
      <PixelatedBackground
        className="absolute -top-32 left-1/2 -z-10 h-auto w-screen min-w-[1920px] -translate-x-1/2 object-cover opacity-5"
        style={{ mixBlendMode: 'screen' }}
      />
      {/* Desktop Navigation - Hidden on mobile */}
      <header className="fixed z-50 hidden w-full items-center justify-center px-4 pt-6 md:flex">
        <nav className="border-input/50 bg-popover flex w-full max-w-3xl items-center justify-between gap-2 rounded-xl border-t p-2 px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="cursor-pointer">
              <Image src="white-icon.svg" alt="Zero Email" width={22} height={22} />
            </Link>
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <NavigationMenuLink href="/about" className={navigationMenuTriggerStyle()}>
                    About
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink href="/pricing" className={navigationMenuTriggerStyle()}>
                    Pricing
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {resources.map((resource) => (
                        <ListItem
                          key={resource.title}
                          title={resource.title}
                          href={resource.href}
                          platform={resource.platform}
                        >
                          {resource.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="ghost" className="h-8">
                Sign in
              </Button>
            </Link>
            <Link href="https://cal.com/team/0">
              <Button className="h-8 font-medium">Contact Us</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Mobile Navigation Sheet */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed left-4 top-6 z-50">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] bg-[#111111] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>
                <Image src="white-icon.svg" alt="Zero Email" width={22} height={22} />
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col space-y-4">
              <Link href="/investor" className="text-sm font-medium">
                Investors
              </Link>
              <Link href="#" className="text-sm font-medium">
                Solutions
              </Link>
              <Link href="#" className="text-sm font-medium">
                Resource
              </Link>
              <div className="pt-4">
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Sign in
                  </Button>
                </Link>
              </div>
              <Link href="https://cal.com/team/0">
                <Button className="w-full">Contact Us</Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <section className="mt-32 flex flex-col items-center px-4 md:mt-40">
        <div className="border-input/50 mb-6 inline-flex items-center gap-4 rounded-full border bg-[#2a2a2a] px-4 py-1 pr-1.5">
          <span className="text-sm">See what's new from 0.email</span>
          <Link
            href="/#"
            className="text-foreground ml-2 flex items-center gap-1 rounded-full bg-gradient-to-b from-neutral-600 to-neutral-700 px-3 py-1 text-sm"
          >
            <span>Learn More</span>
            <MoveRight className="!size-4" />
          </Link>
        </div>
        <Balancer className="mb-3 max-w-[1130px] text-center text-6xl font-semibold">
          <h1 className="text-center text-4xl font-medium md:text-6xl">
            AI Powered Email, Built to Save You Time
          </h1>
        </Balancer>
        <p className="mx-auto mb-4 max-w-2xl text-center text-base font-medium text-[#B7B7B7] md:text-lg">
          Zero is an AI native email client that manages your inbox, so you don't have to.
        </p>

        <Button className="h-8">Get Started</Button>
      </section>
      <section className="relative mt-10 hidden flex-col justify-center md:flex">
        <div className="bg-border absolute left-1/2 top-0 h-px w-full -translate-x-1/2 md:container xl:max-w-7xl" />
        <Tabs
          defaultValue="smart-categorization"
          onValueChange={handleTabChange}
          className="flex w-full flex-col items-center gap-0"
        >
          <div className="tabs-container relative hidden w-full max-w-[40rem] justify-center md:flex md:max-w-max">
            <TabsList className="relative h-fit w-full rounded-none bg-transparent pb-0 md:w-auto">
              <div className="bg-border absolute -top-4 left-0 h-[calc(100%+16px)] w-px" />
              <div className="bg-border absolute -top-4 right-0 h-[calc(100%+16px)] w-px" />
              {/* Glow */}
              <CustomTabGlow glowStyle={glowStyle} />

              {/* Tab Triggers */}
              {tabs.map((tab, index) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative h-12 w-52 rounded-none !bg-transparent !shadow-none"
                  ref={(el) => {
                    if (el) tabRefs.current[index] = el;
                  }}
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="relative flex w-full justify-center md:border-t">
            <div className="container relative md:border-x xl:max-w-7xl">
              <PixelatedLeft
                className="absolute left-0 top-0 -z-10 hidden h-full w-auto -translate-x-full opacity-50 md:block"
                style={{ mixBlendMode: 'screen' }}
              />
              <PixelatedRight
                className="absolute right-0 top-0 -z-10 hidden h-full w-auto translate-x-full opacity-50 md:block"
                style={{ mixBlendMode: 'screen' }}
              />
              <div className="bg-border absolute -left-px -top-4 hidden h-4 w-px md:block" />
              <div className="bg-border absolute -right-px -top-4 hidden h-4 w-px md:block" />
              {tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value}>
                  <Image
                    src="/email-preview.png"
                    alt="Zero Email Preview"
                    width={1920}
                    height={1080}
                    className="relative -top-2 hidden md:block"
                  />
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
      </section>
      <div className="mx-auto mt-8 w-full max-w-5xl px-4">
        <div className="border-muted-foreground/30 bg-muted md:animate-move-up relative flex items-center justify-center rounded-xl border p-1 shadow-xl shadow-black/40 backdrop-blur-lg md:hidden md:p-2">
          <Image
            src="/email-preview.png"
            alt="hero"
            width={800}
            height={600}
            className="h-full w-full rounded-xl shadow-md shadow-black invert md:rounded-lg dark:invert-0"
          />
        </div>
      </div>
    </main>
  );
}

const CustomTabGlow = ({ glowStyle }: { glowStyle: { left: number; width: number } }) => {
  return (
    <div
      className="absolute w-1/3 transition-all duration-300 ease-in-out"
      style={{
        left: `${glowStyle.left}px`,
      }}
    >
      <div
        style={{
          width: `${glowStyle.width}px`,
        }}
        className="bottom-0 h-12 translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.3)_0%,_transparent_70%)] blur-md"
      />
      <div
        style={{ width: `${glowStyle.width}px` }}
        className="bottom-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/90 to-transparent"
      />
    </div>
  );
};
