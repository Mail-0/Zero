"use client";

import { GitHub, Google } from "@/components/icons/icons";
import { signIn, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/home/navbar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";

export default function Login() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session?.connectionId) {
      router.push("/mail");
    }
  }, [session, isPending, router]);

  if (isPending || (session && session.connectionId)) return null;

  return (
    <div className="flex w-full flex-col bg-white dark:bg-black">
      <div className="flex w-full justify-center">
        <Navbar />
      </div>
      <div className="flex min-h-[80vh] w-full items-center justify-center">
        <div className="animate-in slide-in-from-bottom-4 max-w-[600px] space-y-8 px-4 duration-500 sm:px-12 md:px-0">
          <p className="text-center font-bold text-4xl md:text-5xl">Login to Zero</p>

          <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-2">
            <Button
              onClick={async () => {
                router.push("/zero/signup");
              }}
              className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-12 w-full rounded-lg border-2 bg-black px-6"
            >
              <Image
                src="/white-icon.svg"
                alt="Email"
                width={15}
                height={15}
                className="invert dark:invert-0"
              />
              Continue with Zero
            </Button>
            <Button
              onClick={async () => {
                signIn.social({
                  provider: "google",
                  callbackURL: "/mail",
                });
              }}
              className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-12 w-full rounded-lg border-2 bg-black"
            >
              <Google />
              Continue with Google
            </Button>
            <Button
              onClick={async () => {
                signIn.social({
                  provider: "github",
                  callbackURL: "/mail",
                });
              }}
              className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-12 w-full rounded-lg border-2 bg-black"
            >
              <GitHub />
              Continue with Github
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
