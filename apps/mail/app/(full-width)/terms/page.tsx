"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import React from "react";

const LAST_UPDATED = "February 13, 2025";

export default function TermsOfService() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen w-full bg-background">
      {/* Back Button */}
      <div className="absolute left-4 top-4 md:left-8 md:top-8">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-16">
        <Card className="overflow-hidden border-none py-0 shadow-none">
          <CardHeader className="space-y-4">
            <div className="space-y-2 text-center">
              <CardTitle className="text-4xl font-bold tracking-tight">Terms of Service</CardTitle>
              <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
            </div>
          </CardHeader>

          <div className="space-y-6 px-6 pb-6">
            {sections.map((section) => (
              <div
                key={section.title}
                className="group rounded-xl border bg-card/50 p-6 shadow-sm transition-all hover:bg-card/80"
              >
                <h2 className="mb-4 text-xl font-semibold tracking-tight">{section.title}</h2>
                <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
                  {section.content}
                </div>
              </div>
            ))}

            <div className="flex justify-center pt-6">
              <Button variant="outline" size="lg" className="gap-2" asChild>
                <a href="https://github.com/nizzyabi/mail0">
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const sections = [
  {
    title: "Overview",
    content: (
      <p>
        Mail0.io is an open-source email solution that enables users to self-host their email
        service or integrate with external email providers. By using Mail0.io, you agree to these
        terms.
      </p>
    ),
  },
  {
    title: "Service Description",
    content: (
      <div className="space-y-8">
        <div>
          <h3 className="mb-3 text-xl font-medium text-card-foreground">Self-Hosted Service</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Mail0.io provides software that users can deploy on their own infrastructure</li>
            <li>Users are responsible for their own hosting, maintenance, and compliance</li>
            <li>The software is provided &quot;as is&quot; under the MIT License</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-xl font-medium text-card-foreground">
            External Email Integration
          </h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Mail0.io can integrate with third-party email providers</li>
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
      <div className="mt-4 space-y-3 text-muted-foreground">
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
      <div className="mt-4 space-y-3 text-muted-foreground">
        <p>Mail0.io is licensed under the MIT License:</p>
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
      <div className="mt-4 space-y-3 text-muted-foreground">
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
      <div className="mt-4 space-y-3 text-muted-foreground">
        <p>For questions about these terms:</p>
        <div className="flex flex-col space-y-2">
          <a
            href="https://github.com/nizzyabi/mail0"
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
