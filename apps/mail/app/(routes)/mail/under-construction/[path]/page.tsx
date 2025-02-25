"use client";

import { SidebarToggle } from "@/components/ui/sidebar-toggle";
import { Construction } from "lucide-react";
import BackButton from "./back-button";
import { use } from "react";

interface UnderConstructionProps {
  params: Promise<{
    path: string;
  }>;
}

export default function UnderConstruction({ params }: UnderConstructionProps) {
  const resolvedParams = use(params);
  // Decode the path parameter
  const decodedPath = decodeURIComponent(resolvedParams.path);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-screen items-center justify-center px-4">
      <div className="flex flex-col items-center justify-between p-4">
        <div className="absolute left-2 top-2">
          <SidebarToggle className="block md:hidden" />
        </div>
        <div className="flex flex-col items-center text-center">
          <Construction className="h-16 w-16 animate-pulse text-muted-foreground" />
          <div className="mt-6 space-y-2">
            <h2 className="text-2xl font-semibold">Under Construction</h2>
            <p className="text-muted-foreground">
              <span className="block">The {decodedPath} page is currently under construction.</span>
              <span className="block">Check back soon!</span>
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <BackButton />
          </div>
        </div>
      </div>
    </div>
  );
}
