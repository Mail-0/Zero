"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import React from "react";

const LAST_UPDATED = "February 19, 2025";

export default function PrivacyPolicy() {
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
              <CardTitle className="text-4xl font-bold tracking-tight">Privacy Policy</CardTitle>
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
                <span className="text-sm text-muted-foreground">•</span>
                <a href="/terms" className="text-sm">
                  Terms of Service
                </a>
              </div>
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

            <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
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
    title: "Our Commitment to Privacy",
    content: (
      <p>
        At Zero, we believe that privacy is a fundamental right. Our open-source email solution
        is built with privacy at its core, and we&apos;re committed to being transparent about how
        we handle your data.
      </p>
    ),
  },
  {
    title: "Google Account Integration",
    content: (
      <>
        <p className="mb-4">When you use Zero with your Google Account:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>We request access to your Gmail data only after receiving your explicit consent</li>
          <li>We access only the necessary Gmail API scopes required for email functionality</li>
          <li>Your Google account credentials are never stored on our servers</li>
          <li>We use secure OAuth 2.0 authentication provided by Google</li>
          <li>
            You can revoke our access to your Google account at any time through your Google Account
            settings
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Data Collection and Usage",
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Google Services Data Handling</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Email data is processed in accordance with Google API Services User Data Policy</li>
            <li>
              We only process and display email data - we don&apos;t store copies of your emails
            </li>
            <li>
              All data transmission between our service and Google is encrypted using
              industry-standard protocols
            </li>
            <li>
              We maintain limited temporary caches only as necessary for application functionality
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Self-Hosted Instances</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              When you self-host Zero, your email data remains entirely under your control
            </li>
            <li>No data is sent to our servers or third parties without your explicit consent</li>
            <li>You maintain complete ownership and responsibility for your data</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "Data Protection and Security",
    content: (
      <ul className="ml-4 list-disc space-y-2">
        <li>End-to-end encryption for all email communications</li>
        <li>Secure OAuth 2.0 authentication for Google services</li>
        <li>Regular security audits and updates</li>
        <li>Open-source codebase for transparency and community review</li>
        <li>Compliance with Google API Services User Data Policy</li>
      </ul>
    ),
  },
  {
    title: "Google User Data Handling",
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Access and Usage</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              We access the following Google user data: email content, attachments, and metadata
              through Gmail API
            </li>
            <li>This data is used exclusively for providing email functionality within Zero</li>
            <li>No Google user data is used for advertising or marketing purposes</li>
            <li>We maintain detailed logs of all data access for security and compliance</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Sharing and Transfer</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              Google user data is never shared with third parties except as required for core
              service functionality
            </li>
            <li>
              When necessary, we only work with service providers who comply with Google API
              Services User Data Policy
            </li>
            <li>All service providers are bound by strict confidentiality agreements</li>
            <li>
              We maintain a current list of all third-party service providers with access to Google
              user data
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Retention and Deletion</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Email data is processed in real-time and not permanently stored</li>
            <li>Temporary caches are automatically cleared within 24 hours</li>
            <li>All Google user data is permanently deleted when you revoke application access</li>
            <li>
              You can request immediate deletion of all your Google user data by contacting
              nizabizaher@gmail.com
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "Limited Use Disclosure",
    content: (
      <div>
        Our use and transfer to any other app of information received from Google APIs will adhere
        to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
          <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
        , including the Limited Use requirements.
      </div>
    ),
  },
  {
    title: "Your Rights and Controls",
    content: (
      <ul className="ml-4 list-disc space-y-2">
        <li>Right to revoke access to your Google account at any time</li>
        <li>Right to request deletion of any cached data</li>
        <li>Right to export your data</li>
        <li>Right to lodge complaints about data handling</li>
      </ul>
    ),
  },
  {
    title: "Contact Us",
    content: (
      <div className="space-y-3">
        <p>For privacy-related questions or concerns:</p>
        <div className="flex flex-col space-y-2">
          <a
            href="mailto:nizabizaher@gmail.com"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <Mail className="mr-2 h-4 w-4" />
            nizabizaher@gmail.com
          </a>
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
  {
    title: "Updates to This Policy",
    content: (
      <p>
        We may update this privacy policy from time to time. We will notify users of any material
        changes through our application or website.
      </p>
    ),
  },
];
