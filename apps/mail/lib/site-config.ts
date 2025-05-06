import { type Metadata } from "next";

const TITLE = "Zero";
const DESCRIPTION =
  "Experience email the way you want with 0 - the first open source email app that puts your privacy and safety first.";

export const siteConfig: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
  applicationName: "Zero",
  creator: "@nizzyabi @bruvimtired @ripgrim @needleXO @dakdevs @mrgsub",
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/og/home`,
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },
  category: "Email Client",
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL,
  },
  keywords: [
    "Mail",
    "Email",
    "Open Source",
    "Email Client",
    "Gmail Alternative",
    "Webmail",
    "Secure Email",
    "Email Management",
    "Email Platform",
    "Communication Tool",
    "Productivity",
    "Business Email",
    "Personal Email",
    "Mail Server",
    "Email Software",
    "Collaboration",
    "Message Management",
    "Digital Communication",
    "Email Service",
    "Web Application",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
};
