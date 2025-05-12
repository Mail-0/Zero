'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  ListItem,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { PixelatedBackground } from '@/components/home/pixelated-bg';
import { CircleCheck, CircleX } from '@/components/icons/icons';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { Separator } from '@/components/ui/separator';
import { useBilling } from '@/hooks/use-billing';
import { Button } from '@/components/ui/button';
import { useCustomer } from 'autumn-js/next';
import { useState, useMemo } from 'react';
import { Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

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

const aboutLinks = [
  {
    title: 'About',
    href: '/about',
    description: 'Learn more about Zero and our mission.',
  },
  {
    title: 'Privacy',
    href: '/privacy',
    description: 'Read our privacy policy and data handling practices.',
  },
  {
    title: 'Terms of Service',
    href: '/terms',
    description: 'Review our terms of service and usage guidelines.',
  },
];

export default function PricingPage() {
  const [open, setOpen] = useState(false);
  const { attach } = useBilling();
  const { customer } = useCustomer();

  const isPro = useMemo(() => {
    return (
      customer &&
      Array.isArray(customer.products) &&
      customer.products.some(
        (product: any) =>
          product.id.includes('pro-example') || product.name.includes('pro-example'),
      )
    );
  }, [customer]);

  const handleUpgrade = async () => {
    if (attach) {
      try {
        await attach({
          productId: 'pro-example',
          successUrl: `${window.location.origin}/mail/inbox?success=true`,
          authUrl: `${window.location.origin}/login?redirect=/pricing`,
        });
      } catch (error) {
        console.error('Failed to upgrade:', error);
      }
    }
  };

  return (
    <main className="relative flex h-screen flex-1 flex-col overflow-x-hidden bg-[#0F0F0F]">
      <PixelatedBackground
        className="z-1 absolute -top-72 left-1/2 h-auto w-screen min-w-[1920px] -translate-x-1/2 object-cover opacity-5"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Desktop Navigation - Hidden on mobile */}
      <header className="fixed z-50 hidden w-full items-center justify-center px-4 pt-6 md:flex">
        <nav className="border-input/50 flex w-full max-w-3xl items-center justify-between gap-2 rounded-xl border-t bg-[#1E1E1E] p-2 px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="relative cursor-pointer">
              <Image src="white-icon.svg" alt="Zero Email" width={22} height={22} />
            </Link>
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Company</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-1 lg:w-[600px]">
                      {aboutLinks.map((link) => (
                        <ListItem key={link.title} title={link.title} href={link.href}>
                          {link.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
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
                <NavigationMenuItem>
                  <Link href="/pricing">
                    <Button variant="ghost" className="h-9">
                      Pricing
                    </Button>
                  </Link>
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
            <Link target="_blank" href="https://cal.com/team/0">
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
            <SheetHeader className="flex flex-row items-center justify-between">
              <SheetTitle>
                <Image src="white-icon.svg" alt="Zero Email" width={22} height={22} />
              </SheetTitle>
              <Link href="/login">
                <Button className="w-full">Sign in</Button>
              </Link>
            </SheetHeader>
            <div className="mt-8 flex flex-col space-y-3">
              <div className="space-y-3">
                <h4 className="text-muted-foreground text-sm font-medium">Company</h4>
                {aboutLinks.map((link) => (
                  <Link key={link.title} href={link.href} className="block font-medium">
                    {link.title}
                  </Link>
                ))}
              </div>
              <Link target="_blank" href="https://cal.com/team/0" className="font-medium">
                Contact Us
              </Link>
            </div>
            <Separator className="mt-8" />
            <div className="mt-8 flex flex-row items-center justify-center gap-4">
              {resources.map((resource) => (
                <Link
                  key={resource.title}
                  href={resource.href}
                  className="flex items-center gap-2 font-medium"
                >
                  {resource.platform && (
                    <Image
                      src={`/${resource.platform}.svg`}
                      alt={resource.platform}
                      width={20}
                      height={20}
                    />
                  )}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="container mx-auto mt-12 h-screen px-4 py-16 md:mt-24">
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-bold text-white md:text-6xl">Pricing</h1>
          <p className="text-lg text-white/50">Choose the plan that's right for you</p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Free Plan */}
          <div className="relative flex h-full flex-col rounded-xl border bg-[#121212] px-8 pb-4 pt-8">
            <h1 className="mb-4 text-center text-lg font-normal text-white/50">Free</h1>
            <div className="mb-4 text-center text-3xl font-bold dark:text-white">
              $0 <span className="text-lg font-medium">/ mo</span>
            </div>
            <ul className="mb-6 w-full flex-grow space-y-2 text-left">
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> 1 email connection
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI chat{' '}
                <span className="text-xs text-white/50">(25 per day)</span>
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI writing assistant
              </li>
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Auto labeling
                <span className="text-xs text-white/50">(25 per day)</span>
              </li>
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" />
                <span>
                  AI thread summaries <span className="text-xs text-white/50">(25 per day)</span>
                </span>
              </li>
              {/* <li className="flex items-center gap-2">
                <CircleX className="h-4 w-4 fill-white opacity-50" /> Instant thread AI-generated
                summaries
              </li>

              <li className="flex items-center gap-2">
                <CircleX className="h-4 w-4 fill-white opacity-50" /> Verified checkmark
              </li>
              <li className="flex items-center gap-2">
                <CircleX className="h-4 w-4 fill-white opacity-50" /> Priority customer support
              </li> */}
            </ul>
            <Link href="/login">
              <Button className="h-8 w-full">Get Started</Button>
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="relative flex h-full flex-col rounded-xl border bg-[#121212] px-8 pb-4 pt-8">
            <h1 className="mb-4 text-center text-lg font-normal text-white/50">Pro</h1>

            <div className="mb-4 text-center text-3xl font-bold dark:text-white">
              $20 <span className="text-lg font-medium">/ mo</span>
            </div>
            <ul className="mb-6 w-full flex-grow space-y-2 text-left">
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Unlimited email connections
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI chat
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI writing assistant
              </li>
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Auto labeling
              </li>
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI thread summaries
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Verified checkmark
              </li>
            </ul>
            <Button className="h-8 w-full" onClick={handleUpgrade}>
              Get Started
            </Button>
          </div>

          {/* Enterprise Plan */}
          <div className="relative flex h-full flex-col rounded-xl border bg-[#121212] px-8 pb-4 pt-8">
            <h1 className="mb-4 text-center text-lg font-normal text-white/50">Enterprise</h1>

            <div className="mb-4 text-center text-3xl font-bold dark:text-white">Contact us</div>
            <ul className="mb-6 w-full flex-grow space-y-2 text-left">
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Unlimited email connections
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI chat
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI writing assistant
              </li>
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Auto labeling
              </li>
              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> AI thread summaries
              </li>

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Verified checkmark
              </li>

              {/* <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Management dashboard
              </li> */}

              <li className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 fill-[#2FAD71]" /> Priority customer support
              </li>
            </ul>
            <Link href="https://cal.com/team/0/chat" target="_blank">
              <Button className="h-8 w-full" onClick={handleUpgrade}>
                Contact us
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
