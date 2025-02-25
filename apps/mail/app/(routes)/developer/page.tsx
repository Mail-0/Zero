"use client";

import { Github, Book, Users, Terminal, Code2, Webhook, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";

const developerResources = [
  {
    title: "API Documentation",
    description: "Comprehensive API references and guides",
    details: "Explore our REST APIs, WebSocket endpoints, and integration guides.",
    icon: Book,
    href: "/docs",
    linkText: "View Documentation",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "GitHub",
    description: "Open source repositories",
    details: "Access our source code, contribute, and track issues.",
    icon: Github,
    href: "https://github.com",
    linkText: "View Repository",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Contributing",
    description: "Join our community",
    details: "Learn how to contribute to our open source projects.",
    icon: Users,
    href: "/contributing",
    linkText: "Contribute",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "CLI Tools",
    description: "Command line utilities",
    details: "Download and install our command line tools.",
    icon: Terminal,
    href: "/cli",
    linkText: "View CLI Docs",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    title: "SDKs",
    description: "Development kits",
    details: "Find SDKs for your preferred programming language.",
    icon: Code2,
    href: "/sdks",
    linkText: "View SDKs",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    title: "Webhooks",
    description: "Event notifications",
    details: "Set up and manage webhook integrations.",
    icon: Webhook,
    href: "/webhooks",
    linkText: "Configure",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
] as const;

export default function DeveloperPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          <div className="sticky top-0 z-10 mb-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="space-y-4">
              <h1 className="text-2xl font-bold sm:text-3xl">Developer Resources</h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Everything you need to build with Mail0&apos;s APIs and tools.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pb-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {developerResources.map((resource) => (
              <Card key={resource.title} className="transition-all hover:shadow-md">
                <CardHeader className="sm:p-6">
                  <div className="flex items-start gap-4 sm:items-center">
                    <div className={`shrink-0 rounded-lg ${resource.bgColor} p-2.5`}>
                      <resource.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${resource.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg sm:text-xl">{resource.title}</CardTitle>
                      <CardDescription className="text-sm">{resource.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4 sm:p-6">
                  <p className="text-sm text-muted-foreground">{resource.details}</p>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-between hover:bg-secondary"
                  >
                    <Link href={resource.href}>
                      <span className="flex items-center justify-between">
                        {resource.linkText}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </span>
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 rounded-lg border bg-card p-4 sm:mt-12 sm:p-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex-1 space-y-1">
                <h3 className="text-lg font-semibold sm:text-xl">Need Help?</h3>
                <p className="text-sm text-muted-foreground">
                  Can&apos;t find what you&apos;re looking for? Get in touch with our developer
                  support team.
                </p>
              </div>
              <Button asChild variant="default" className="w-full sm:w-auto">
                <Link href="/support">Contact Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
