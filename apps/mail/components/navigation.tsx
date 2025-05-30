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
import { GitHub, Twitter, Discord, LinkedIn } from './icons/icons';
import { signIn, useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
  {
    title: 'Contributors',
    href: '/contributors',
    description: 'See the contributors to Zero.',
  },
];

const IconComponent = {
  github: GitHub,
  twitter: Twitter,
  discord: Discord,
  linkedin: LinkedIn,
};

export function Navigation() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const navigate = useNavigate();

  return (
    <>
      {/* Desktop Navigation - Hidden on mobile */}
      <header className="fixed z-50 hidden w-full items-center justify-center px-4 pt-6 md:flex">
        <nav className="border-input/50 flex w-full max-w-3xl items-center justify-between gap-2 rounded-xl border-t bg-[#1E1E1E] p-2 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="relative bottom-1 cursor-pointer">
              <img src="white-icon.svg" alt="Zero Email" width={22} height={22} />
              <span className="text-muted-foreground absolute -right-[-0.5px] text-[10px]">
                beta
              </span>
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
                  <a href="/pricing">
                    <Button variant="ghost" className="h-9">
                      Pricing
                    </Button>
                  </a>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex gap-2">
            <Button
              className="h-8 bg-white text-black hover:bg-white hover:text-black"
              onClick={() => {
                if (session) {
                  navigate('/mail/inbox');
                } else {
                  toast.promise(
                    signIn.social({
                      provider: 'google',
                      callbackURL: `${window.location.origin}/mail`,
                    }),
                    {
                      error: 'Login redirect failed',
                    },
                  );
                }
              }}
            >
              Sign in
            </Button>
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
                <img src="white-icon.svg" alt="Zero Email" width={22} height={22} />
              </SheetTitle>
              <a href="/login">
                <Button className="w-full">Sign in</Button>
              </a>
            </SheetHeader>
            <div className="mt-8 flex flex-col space-y-3">
              <div className="space-y-3">
                <Link to="/pricing" className="mt-2">
                  Pricing
                </Link>
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
              {resources.map((resource) => {
                const Icon = IconComponent[resource.platform];
                return (
                  <Link
                    key={resource.title}
                    to={resource.href}
                    className="flex items-center gap-2 font-medium"
                  >
                    {resource.platform && <Icon className="dark:fill-muted-foreground h-5 w-5" />}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
