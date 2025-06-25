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
import { GitHub, Twitter, Discord, LinkedIn, Star } from './icons/icons';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { signIn, useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    href: 'https://x.com/mail0dotcom',
    description: 'Follow us for the latest updates and announcements.',
    platform: 'twitter' as const,
  },
  {
    title: 'LinkedIn',
    href: 'https://www.linkedin.com/company/mail0/',
    description: 'Connect with us professionally and stay updated.',
    platform: 'linkedin' as const,
  },
  {
    title: 'Discord',
    href: 'https://discord.gg/mail0',
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

interface GitHubApiResponse {
  stargazers_count: number;
}

export function Navigation() {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0); // Default fallback value
  const { data: session } = useSession();
  const navigate = useNavigate();

  const { data: githubData } = useQuery({
    queryKey: ['githubStars'],
    queryFn: async () => {
      const response = await fetch('https://api.github.com/repos/Mail-0/Zero', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub stars');
      }
      return response.json() as Promise<GitHubApiResponse>;
    },
  });

  useEffect(() => {
    if (githubData) {
      setStars(githubData.stargazers_count || 0);
    }
  }, [githubData]);

  return (
    <>
      {/* Desktop Navigation - Hidden on mobile */}
      <header className="fixed left-[50%] z-50 hidden w-full max-w-3xl translate-x-[-50%] items-center justify-center px-4 pt-6 md:flex">
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
                  <NavigationMenuTrigger className="bg-transparent text-white">
                    Company
                  </NavigationMenuTrigger>
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
                  <NavigationMenuTrigger className="bg-transparent text-white">
                    Resources
                  </NavigationMenuTrigger>
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
                <NavigationMenuItem className="bg-transparent text-white">
                  <a href="/pricing">
                    <Button variant="ghost" className="h-9 bg-transparent">
                      Pricing
                    </Button>
                  </a>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex gap-2">
            <a
              href="https://github.com/Mail-0/Zero"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group inline-flex h-8 items-center gap-2 rounded-lg bg-black px-2 text-sm text-white transition-colors hover:bg-black/90',
              )}
            >
              <div className="flex items-center text-white">
                <GitHub className="mr-1 size-4 fill-white" />
                <span className="ml-1 lg:hidden">Star</span>
                <span className="ml-1 hidden lg:inline">GitHub</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Star className="relative top-[1px] size-4 fill-gray-400 transition-all duration-300 group-hover:fill-yellow-400 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                <AnimatedNumber value={stars} className="font-medium text-white" />
              </div>
            </a>
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
              Get Started
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
          <SheetContent side="left" className="w-[300px] sm:w-[400px] dark:bg-[#111111]">
            <SheetHeader className="flex flex-row items-center justify-between">
              <SheetTitle>
                <Link to="/" onClick={() => setOpen(false)}>
                  <img
                    src="white-icon.svg"
                    alt="Zero Email"
                    className="hidden object-contain dark:block"
                    width={22}
                    height={22}
                  />
                  <img
                    src="/black-icon.svg"
                    alt="0.email Logo"
                    className="object-contain dark:hidden"
                    width={22}
                    height={22}
                  />
                </Link>
              </SheetTitle>
              <Button
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
                className="w-full"
              >
                Get Started
              </Button>
            </SheetHeader>
            <div className="mt-8 flex flex-col space-y-3">
              <div className="flex flex-col space-y-3">
                <Link to="/" className="mt-2" onClick={() => setOpen(false)}>
                  Home
                </Link>
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
