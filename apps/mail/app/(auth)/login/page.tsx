"use client";

import { GitHub, Google } from "@/components/icons/icons";
import { signIn, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen w-full items-center justify-center bg-white dark:bg-black">
      <div className="max-w-[500px] space-y-8 px-4 duration-500 animate-in slide-in-from-bottom-4 sm:px-12 md:px-0">
        <p className="text-center font-mono text-4xl font-bold md:text-5xl">Welcome to 0</p>
        <div className="flex w-full items-center justify-center">
          <Image
            src="/mail.svg"
            alt="logo"
            className="w-[300px] sm:w-[500px]"
            width={500}
            height={500}
          />
        </div>
        <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-2 sm:flex-row">
          <Button
            onClick={async () => {
              toast.promise(
                signIn.social({
                  provider: "google",
                  callbackURL: "/mail",
                }),
                {
                  loading: "Redirecting...",
                  success: "Redirected successfully!",
                  error: "Login redirect failed",
                },
              );
            }}
            className="h-9 w-full rounded-lg border-2 border-input bg-background bg-black text-primary hover:bg-accent hover:text-accent-foreground"
          >
            <Google />
            Continue with Google
          </Button>
          <Button
            onClick={async () => {
              toast.promise(
                signIn.social({
                  provider: "github",
                  callbackURL: "/mail",
                }),
                {
                  loading: "Redirecting...",
                  success: "Redirected successfully!",
                  error: "Login redirect failed",
                },
              );
            }}
            className="h-9 w-full rounded-lg border-2 border-input bg-background bg-black text-primary hover:bg-accent hover:text-accent-foreground"
          >
            <GitHub />
            Continue with Github
          </Button>
        </div>
      </div>
    </div>
  );
}
