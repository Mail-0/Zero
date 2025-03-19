"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Github, ArrowLeft, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/home/footer";
import { createSectionId } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import React from "react";

const LAST_UPDATED = "February 13, 2025";

export default function TermsOfService() {
  const router = useRouter();
  const { copiedValue: copiedSection, copyToClipboard } = useCopyToClipboard();

  const handleCopyLink = (sectionId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${sectionId}`;
    copyToClipboard(url, sectionId);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-auto bg-white dark:bg-black">
      <div className="relative z-10 flex flex-grow flex-col">
        {/* Back Button */}
        <div className="absolute left-4 top-4 md:left-8 md:top-8">
          <Button
            variant="ghost"
            size="sm"
            className="dark:text-muted-foreground gap-2 text-gray-600 hover:text-gray-900 dark:hover:text-white"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-16">
          <Card className="overflow-hidden rounded-xl border-none bg-gray-50/80 shadow-xl backdrop-blur-lg dark:bg-black/40">
            <CardHeader className="space-y-4 bg-gray-100/90 px-8 py-8 dark:bg-black/60">
              <div className="space-y-2 text-center">
                <CardTitle className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
                  Terms of Service
                </CardTitle>
                <div className="flex items-center justify-center gap-2">
                  <p className="dark:text-muted-foreground text-sm text-gray-500">
                    Last updated: {LAST_UPDATED}
                  </p>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-8 p-8">
              {sections.map((section) => {
                const sectionId = createSectionId(section.title);
                return (
                  <div
                    key={section.title}
                    id={sectionId}
                    className="group rounded-xl border border-gray-200 bg-white/70 p-6 transition-all hover:border-gray-300 hover:bg-white dark:border-gray-800/10 dark:bg-black/20 dark:hover:border-gray-700/30 dark:hover:bg-black/30"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                        {section.title}
                      </h2>
                      <button
                        onClick={() => handleCopyLink(sectionId)}
                        className="dark:text-muted-foreground text-gray-400 transition-all hover:text-gray-700 dark:hover:text-white"
                        aria-label={`Copy link to ${section.title} section`}
                      >
                        <Link2
                          className={`h-4 w-4 ${copiedSection === sectionId ? "text-green-500 dark:text-green-400" : ""}`}
                        />
                      </button>
                    </div>
                    <div className="prose prose-sm prose-a:text-blue-600 prose-a:no-underline hover:prose-a:text-blue-800 dark:prose-invert dark:prose-a:text-blue-300 dark:hover:prose-a:text-blue-200 max-w-none text-gray-700 dark:text-gray-300">
                      {section.content}
                    </div>
                  </div>
                );
              })}

              <div className="mt-12 flex flex-wrap items-center justify-center gap-4"></div>
            </div>
          </Card>
        </div>

        <Footer />
      </div>
    </div>
  );
}

const sections = [
  {
    title: "Overview",
    content: (
      <p>
        0.email is an open-source email solution that enables users to self-host their email service
        or integrate with external email providers. By using 0.email, you agree to these terms.
      </p>
    ),
  },
  {
    title: "Service Description",
    content: (
      <div className="space-y-8">
        <div>
          <h3 className="text-card-foreground mb-3 text-xl font-medium">Self-Hosted Service</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>0.email provides software that users can deploy on their own infrastructure</li>
            <li>Users are responsible for their own hosting, maintenance, and compliance</li>
            <li>The software is provided &quot;as is&quot; under the MIT License</li>
          </ul>
        </div>
        <div>
          <h3 className="text-card-foreground mb-3 text-xl font-medium">
            External Email Integration
          </h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>0.email can integrate with third-party email providers</li>
            <li>Users must comply with third-party providers&apos; terms of service</li>
            <li>We are not responsible for third-party service disruptions</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "User Responsibilities",
    content: (
      <div className="text-muted-foreground mt-4 space-y-3">
        <p>Users agree to:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Comply with all applicable laws and regulations</li>
          <li>Maintain the security of their instance</li>
          <li>Not use the service for spam or malicious purposes</li>
          <li>Respect intellectual property rights</li>
          <li>Report security vulnerabilities responsibly</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Software License",
    content: (
      <div className="text-muted-foreground mt-4 space-y-3">
        <p>0.email is licensed under the MIT License:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Users can freely use, modify, and distribute the software</li>
          <li>The software comes with no warranties</li>
          <li>Users must include the original license and copyright notice</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Community Guidelines",
    content: (
      <div className="text-muted-foreground mt-4 space-y-3">
        <p>Users participating in our community agree to:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Follow our code of conduct</li>
          <li>Contribute constructively to discussions</li>
          <li>Respect other community members</li>
          <li>Report inappropriate behavior</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Contact Information",
    content: (
      <div className="text-muted-foreground mt-4 space-y-3">
        <p>For questions about these terms:</p>
        <div className="flex flex-col space-y-2">
          <a
            href="https://github.com/Mail-0/Zero"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <Github className="mr-2 h-4 w-4" />
            Open an issue on GitHub
          </a>
        </div>
      </div>
    ),
  },
];
