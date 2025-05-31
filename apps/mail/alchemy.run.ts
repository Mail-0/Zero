/// <reference types="node" />

import alchemy from "alchemy";
import { ReactRouter } from "alchemy/cloudflare";

const app = await alchemy("my-react-router-app", {
  stage: process.env.USER ?? "dev",
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
});

export const website = await ReactRouter("website", {
  noBundle: true,
  main: "./worker.ts",
  command: "bun run build",
  compatibilityDate: "2025-05-01",
  compatibilityFlags: ["nodejs_compat"],
  env: {
    "VITE_PUBLIC_BACKEND_URL": "http://localhost:8787",
    "VITE_PUBLIC_APP_URL": "http://localhost:3000",
  }
});

console.log({
  url: website.url,
});

await app.finalize();