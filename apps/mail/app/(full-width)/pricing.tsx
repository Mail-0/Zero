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
import PricingCard from '@/components/pricing/pricing-card';
import Comparision from '@/components/pricing/comparision';
import { signIn, useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';
import { Navigation } from '@/components/navigation';
import { useBilling } from '@/hooks/use-billing';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import Footer from '@/components/home/footer';
import { useState, useMemo } from 'react';
import { Menu } from 'lucide-react';
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
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <main className="relative flex min-h-screen flex-1 flex-col overflow-x-hidden bg-[#0F0F0F]">
      <PixelatedBackground
        className="z-1 absolute left-1/2 top-[-40px] h-auto w-screen min-w-[1920px] -translate-x-1/2 object-cover"
        style={{
          mixBlendMode: 'screen',
          maskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
      />
      <Navigation />

      <div className="container mx-auto mt-12 px-4 py-16 md:mt-44">
        <div className="mb-12 text-center">
          <h1 className="mb-2 self-stretch text-5xl font-medium leading-[62px] text-white md:text-6xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-6 text-2xl font-light text-[#B8B8B9]">
            Choose the plan that's right for you
          </p>
        </div>

        <div className="mx-auto max-w-7xl">
          <PricingCard />
        </div>
      </div>
      <div className="container mx-auto mb-40 px-4">
        <Comparision />
      </div>
      <div className="mt-auto">
        <Footer />
      </div>
    </main>
  );
}
