'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  ListItem,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useState } from 'react';
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

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop Navigation - Hidden on mobile */}
      <header className="fixed z-50 hidden w-full items-center justify-center px-4 pt-6 md:flex">
        <nav className="border-input/50 bg-popover flex w-full max-w-3xl items-center justify-between gap-2 rounded-xl border-t p-2 px-4">
          <div className="flex items-center gap-6">
            <a href="/" className="relative cursor-pointer">
              <Image src="white-icon.svg" alt="Zero Email" width={22} height={22} />
              <span className="absolute right-0 text-[10px]">beta</span>
            </a>
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
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex gap-2">
            <a href="/login">
              <Button variant="ghost" className="h-8">
                Sign in
              </Button>
            </a>
            <a target="_blank" href="https://cal.com/team/0">
              <Button className="h-8 font-medium">Contact Us</Button>
            </a>
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
              <a href="/login">
                <Button className="w-full">Sign in</Button>
              </a>
            </SheetHeader>
            <div className="mt-8 flex flex-col space-y-3">
              <div className="space-y-3">
                <h4 className="text-muted-foreground text-sm font-medium">Company</h4>
                {aboutLinks.map((link) => (
                  <a key={link.title} href={link.href} className="block font-medium">
                    {link.title}
                  </a>
                ))}
              </div>
              <a target="_blank" href="https://cal.com/team/0" className="font-medium">
                Contact Us
              </a>
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
    </>
  );
}
