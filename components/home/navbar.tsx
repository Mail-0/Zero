import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { ArrowRightIcon, Menu } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";

export default function Navbar() {
  return (
    <div className="mx-auto flex w-full items-center justify-between p-4">
      <div className="w-[180px]">
        <p className="text-2xl font-bold">Mail0</p>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden gap-10 text-sm text-muted-foreground md:flex">
        <Link href="https://github.com/nizzyabi/Mail0">Github</Link>
        <Link href=" https://discord.gg/adkjqMUK">Discord</Link>
        <Link href="/privacy">Privacy</Link>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-9 w-9" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-52">
            <SheetHeader>
              <SheetTitle className="text-left text-2xl">Mail0</SheetTitle>
            </SheetHeader>
            <div className="mt-7 flex flex-col gap-4 text-muted-foreground">
              <Link href="https://github.com/nizzyabi/mail0">Github</Link>
              <Link href="https://discord.gg/5nwrvt3JH2">Discord</Link>
              <Link href="/privacy">Terms & Privacy</Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <Button variant="outline" className="hidden h-9 w-[180px] md:inline-flex" asChild>
          <Link href="/login">
            Get Started
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
