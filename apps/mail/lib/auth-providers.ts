export interface EnvVarInfo {
  name: string;
  source: string;
  defaultValue?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  requiredEnvVars: string[];
  envVarInfo?: EnvVarInfo[];
  config: any;
  required?: boolean;
  isCustom?: boolean;
  customRedirectPath?: string;
}

export const customProviders: ProviderConfig[] = [
  // {
  //   id: "zero",
  //   name: "Zero",
  //   requiredEnvVars: [],
  //   config: {},
  //   isCustom: true,
  //   customRedirectPath: "/zero/signup"
  // }
];

export const authProviders: ProviderConfig[] = [
  {
    id: 'google',
    name: 'Google',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    envVarInfo: [
      { name: 'GOOGLE_CLIENT_ID', source: 'Google Cloud Console' },
      { name: 'GOOGLE_CLIENT_SECRET', source: 'Google Cloud Console' },
    ],
    config: {
      // TODO: Remove this before going to prod, it's to force to get `refresh_token` from google, some users don't have it yet.
      prompt:
        process.env.NODE_ENV === 'production' && !process.env.FORCE_GMAIL_CONSENT
          ? undefined
          : 'consent',
      accessType: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.modify'],
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    required: true,
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    requiredEnvVars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    envVarInfo: [
      { name: 'MICROSOFT_CLIENT_ID', source: 'Microsoft Azure App ID' },
      { name: 'MICROSOFT_CLIENT_SECRET', source: 'Microsoft Azure App Password' },
    ],
    config: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
      scope: ['https://graph.microsoft.com/User.Read', 'offline_access'],
      authority: 'https://login.microsoftonline.com/common',
      responseType: 'code',
      prompt: 'consent',
      loginHint: 'email',
    },
  },
  // Commented out GitHub provider
  // {
  //   id: "github",
  //   name: "Github",
  //   requiredEnvVars: [
  //     "GITHUB_CLIENT_ID",
  //     "GITHUB_CLIENT_SECRET",
  //     "GITHUB_REDIRECT_URI"
  //   ],
  //   envVarInfo: [
  //     { name: "GITHUB_CLIENT_ID", source: "GitHub Developer Settings" },
  //     { name: "GITHUB_CLIENT_SECRET", source: "GitHub Developer Settings" },
  //     {
  //       name: "GITHUB_REDIRECT_URI",
  //       source: "GitHub Developer Settings",
  //       defaultValue: "http://localhost:3000/api/auth/callback/github"
  //     }
  //   ],
  //   config: {
  //     clientId: process.env.GITHUB_CLIENT_ID,
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET,
  //   },
  // }
];

export function isProviderEnabled(provider: ProviderConfig): boolean {
  if (provider.isCustom) return true;

  const hasEnvVars = provider.requiredEnvVars.every((envVar) => !!process.env[envVar]);

  if (provider.required && !hasEnvVars) {
    console.error(`Required provider "${provider.id}" is not configured properly.`);
    console.error(
      `Missing environment variables: ${provider.requiredEnvVars.filter((envVar) => !process.env[envVar]).join(', ')}`,
    );
  }

  return hasEnvVars;
}

export function getSocialProviders() {
  const socialProviders: Record<string, any> = {};

  authProviders.forEach((provider) => {
    if (isProviderEnabled(provider)) {
      socialProviders[provider.id] = provider.config;
    } else if (provider.required) {
      throw new Error(
        `Required provider "${provider.id}" is not configured properly. Check your environment variables.`,
      );
    }
  });

  return socialProviders;
}
