import { Metadata } from "next";

const TITLE = "0 Email";
const DESCRIPTION = "An Open Source Gmail Alternative.";

const BASE_URL = "https://mail0.io";

export const siteConfig: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
  applicationName: "0 Email",
  creator: "Open Source Developers",

  category: "AU",
  alternates: {
    canonical: BASE_URL,
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
  metadataBase: new URL(BASE_URL),
};
