import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Automatically lose sheet on lg screen
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setOpen(false);
    }
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="mx-auto flex w-full items-center justify-between p-4 px-7 lg:px-20">
      <Image 
        src="/white-icon.svg" 
        alt="zerodotemail" 
        className="h-9 w-9 invert dark:invert-0" 
        width={180} 
        height={180} 
      />

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="cursor-pointer">
            <Menu className="hover:bg-gray-100 dark:hover:bg-accent h-9 w-9 rounded-md p-2 text-gray-800 dark:text-white" />
          </SheetTrigger>
          <SheetContent
            side="top"
            className="w-full !translate-y-0 border-none bg-white dark:bg-black px-4 py-4 !duration-0 data-[state=closed]:!translate-y-0 data-[state=open]:!translate-y-0"
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
                  className="h-9 w-9 invert dark:invert-0"
                  width={180}
                  height={180}
                />
                <SheetTrigger asChild>
                  <X className="hover:bg-gray-100 dark:hover:bg-accent h-9 w-9 cursor-pointer rounded-md p-2 text-gray-800 dark:text-white" />
                </SheetTrigger>
              </div>
              <div className="mt-7 space-y-4 px-3">
                <Button className="w-full bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90" asChild>
                  <Link href="https://cal.com/team/0/chat">Contact Us</Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <>
          <div className="hidden items-center gap-4 lg:flex">
            <Link
              href="login"
              className="text-gray-800 dark:bg-gradient-to-r dark:from-gray-300 dark:via-gray-100 dark:to-gray-200 dark:bg-clip-text text-sm dark:text-transparent transition-opacity hover:opacity-80"
            >
              Sign in
            </Link>
            <Button className="h-[32px] w-[110px] rounded-md bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90" asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </>
      ) : (
        <Button className="hidden h-[32px] w-[110px] rounded-md bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 lg:flex" asChild>
          <Link href="https://cal.com/team/0/chat">Contact Us</Link>
        </Button>
      )}
    </div>
  );
}
