"use client";

import { Button } from "@/components/ui/button";
import React, { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex w-full items-center justify-center bg-white text-center dark:bg-background">
      <div className="flex-col items-center justify-center dark:text-gray-100 md:flex">
        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Something went wrong!</h2>
          <p className="text-muted-foreground">See the console for more information.</p>
        </div>

        {/* Buttons */}
        <div className="mt-2">
          <Button variant="outline" onClick={() => reset()} className="gap-2 text-muted-foreground">
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
