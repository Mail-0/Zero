import { phoneNumberClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { Auth } from '@zero/server/auth';

const clientOptions = {
  baseURL: import.meta.env.VITE_PUBLIC_BACKEND_URL,
  fetchOptions: {
    credentials: 'include' as const,
  },
  plugins: [phoneNumberClient()],
};

export const authClient = createAuthClient(clientOptions);

// Account linking always returns redirect=true in this Better Auth version. Recovery must
// amend the authorization URL before navigating, rather than use its automatic redirect.
export const recoveryAuthClient = createAuthClient({
  ...clientOptions,
  disableDefaultFetchPlugins: true,
});

export const { signIn, signUp, signOut, useSession, getSession, $fetch } = authClient;
export type Session = Awaited<ReturnType<Auth['api']['getSession']>>;
