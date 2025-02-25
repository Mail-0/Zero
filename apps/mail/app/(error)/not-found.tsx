"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function NotFound() {
  const router = useRouter();

  return (
    <div className="flex w-full items-center justify-center bg-white text-center dark:bg-background">
      <div className="flex-col items-center justify-center dark:text-gray-100 md:flex">
        <div className="relative">
          <h1 className="select-none text-[150px] font-bold text-muted-foreground/20">404</h1>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <AlertCircle className="h-20 w-20 text-muted-foreground" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Page Not Found</h2>
          <p className="text-muted-foreground">
            Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-2 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
