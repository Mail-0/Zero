import { customSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth"; // Import the auth instance as a type
import { env } from "@/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  plugins: [customSessionClient<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession, getSession, $fetch } = authClient;
