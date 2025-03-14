"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function NotFound() {
  const router = useRouter();
  const t = useTranslations();

  return (
    <div className="dark:bg-background flex w-full items-center justify-center bg-white text-center">
      <div className="flex-col items-center justify-center md:flex dark:text-gray-100">
        <div className="relative">
          <h1 className="text-muted-foreground/20 select-none text-[150px] font-bold">404</h1>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <AlertCircle className="text-muted-foreground h-20 w-20" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("pages.error.notFound.title")}
          </h2>
          <p className="text-muted-foreground">{t("pages.error.notFound.description")}</p>
        </div>

        {/* Buttons */}
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="text-muted-foreground gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("pages.error.notFound.goBack")}
          </Button>
        </div>
      </div>
    </div>
  );
}
