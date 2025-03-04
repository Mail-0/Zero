import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ArrowRightIcon, Menu, X } from "lucide-react";
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
    <div className="mx-auto flex w-full items-center justify-between p-4 px-7 lg:px-4">
      <Image src="/white-icon.svg" alt="Mail0" className="h-9 w-9" width={180} height={180} />

      {/* Desktop Navigation */}
      <div className="text-muted-foreground absolute left-1/2 hidden -translate-x-1/2 gap-10 text-sm lg:flex">
        <Link href="/">About us</Link>
        <Link href="https://github.com/nizzyabi/Mail0">Github</Link>
        <Link href="/privacy">Privacy</Link>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="cursor-pointer">
            <Menu className="hover:bg-accent h-9 w-9 rounded-md p-2" />
          </SheetTrigger>
          <SheetContent
            side="top"
            className="w-full !translate-y-0 border-none bg-black px-4 py-4 !duration-0 data-[state=closed]:!translate-y-0 data-[state=open]:!translate-y-0"
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
                  alt="Mail0"
                  className="h-9 w-9"
                  width={180}
                  height={180}
                />
                <SheetTrigger asChild>
                  <X className="hover:bg-accent h-9 w-9 cursor-pointer rounded-md p-2" />
                </SheetTrigger>
              </div>
              <div className="mt-7 space-y-4 px-3">
                {/* <Button variant="outline" className="w-full bg-black" asChild>
                  <Link href="/login">Log In</Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link href="/login">Sign Up</Link>
                </Button> */}
                <Button className="w-full" asChild>
                  <Link href="https://cal.com/team/0/chat">Contact Us</Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-col space-y-8 bg-gradient-to-r from-gray-300 via-gray-100 to-gray-200 bg-clip-text px-3 text-lg text-transparent transition-opacity hover:opacity-80">
                <Link href="/">About us</Link>

                <Link href="https://github.com/nizzyabi/Mail0">Github</Link>

                <Link href="/privacy">Privacy</Link>
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
              className="bg-gradient-to-r from-gray-300 via-gray-100 to-gray-200 bg-clip-text text-sm text-transparent transition-opacity hover:opacity-80"
            >
              Sign in
            </Link>
            <Button className="h-[32px] w-[110px] rounded-md" asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </>
      ) : (
        <Button className="hidden h-[32px] w-[110px] rounded-md lg:flex" asChild>
          <Link href="https://cal.com/team/0/chat">Contact Us</Link>
        </Button>
      )}
    </div>
  );
}
