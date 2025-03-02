import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "mail0.io" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/settings",
        destination: "/settings/general",
        permanent: true,
      },
      {
        source: "/mail",
        destination: "/mail/inbox",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
