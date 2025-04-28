'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useSession } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  if (session) {
    redirect('/mail');
  }

  // Automatically lose sheet on lg screen
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setOpen(false);
    }
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const mobileNavContent = () => {
    return (
      <>
        <Button asChild>
          <Link href={'/login'}>Get Started</Link>
        </Button>
        <Button
          className="w-full bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90"
          asChild
        >
          <Link href="https://cal.com/team/0/chat">Contact</Link>
        </Button>
      </>
    );
  };

  const desktopNavContent = () => {
    return (
      <>
        <Button asChild>
          <Link href={'/login'}>Get Started</Link>
        </Button>

        {/* It is better to enable this button when we implement our own mail server, no need for it honestly */}
        {/* <Button
          className="h-[32px] w-[110px] rounded-md bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90"
          asChild
        >
          <Link href={session ? '/mail' : '/login'}>Get Started</Link>
        </Button> */}
      </>
    );
  };

  return (
    <div className="mx-auto flex w-full items-center justify-between p-4 px-3 lg:px-4">
      <Link href="/">
        <Image
          src="/white-icon.svg"
          alt="zerodotemail"
          className="hidden h-6 w-6 dark:block"
          width={180}
          height={180}
        />
        <Image
          src="/black-icon.svg"
          alt="zerodotemail"
          width={180}
          height={180}
          className="block h-6 w-6 dark:hidden"
        />
      </Link>
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="cursor-pointer">
            <Menu className="dark:hover:bg-accent h-9 w-9 rounded-md p-2 text-gray-800 hover:bg-gray-100 dark:text-white" />
          </SheetTrigger>
          <SheetContent
            side="top"
            className="w-full !translate-y-0 border-none bg-white px-0 py-4 !duration-0 data-[state=closed]:!translate-y-0 data-[state=open]:!translate-y-0 dark:bg-black"
          >
            <SheetHeader className="">
              <VisuallyHidden>
                <SheetTitle>Navigation Menu</SheetTitle>
              </VisuallyHidden>
            </SheetHeader>
            <div className="flex h-screen flex-col">
              <div className="flex items-center justify-between px-3">
                <Image
                  src="/white-icon.svg"
                  alt="zerodotemail"
                  className="hidden size-6 dark:block"
                  width={180}
                  height={180}
                />
                <Image
                  src="/black-icon.svg"
                  alt="zerodotemail"
                  className="block size-6 dark:hidden"
                  width={180}
                  height={180}
                />
                <SheetTrigger asChild>
                  <X className="dark:hover:bg-accent h-9 w-9 cursor-pointer rounded-md p-2 text-gray-800 hover:bg-gray-100 dark:text-white" />
                </SheetTrigger>
              </div>
              <div className="mt-7 flex flex-col space-y-4 px-3">{mobileNavContent()}</div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden items-center gap-4 lg:flex">{desktopNavContent()}</div>
    </div>
  );
}
