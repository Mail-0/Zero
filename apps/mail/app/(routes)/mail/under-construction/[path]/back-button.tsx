"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={() => router.push("/mail")}
      className="gap-2 text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Go Back
    </Button>
  );
}
