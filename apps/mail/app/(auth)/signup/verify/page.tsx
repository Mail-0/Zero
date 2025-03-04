import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";

export default function VerifyEmail() {
  return (
    <div className="flex h-dvh w-screen flex-col items-center justify-center bg-background">
      <Suspense>
        <Mail className="h-16 w-16 animate-pulse text-muted-foreground" />
      </Suspense>
      <Card className="w-full max-w-md border-none py-0 shadow-none">
        <CardHeader className="py-2">
          <CardTitle className="text-center">Verify your email</CardTitle>
          <p className="text-center text-sm text-gray-500 dark:text-zinc-400">
            We&apos;ve sent a verification email to your inbox. If you don&apos;t see it, please
            signup again{" "}
            <Link href="/signup" className="underline">
              here
            </Link>
            .
          </p>
        </CardHeader>
      </Card>
    </div>
  );
}
