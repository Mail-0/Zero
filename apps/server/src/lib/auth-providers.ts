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
  config: unknown;
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

export const authProviders = (env: Record<string, string>): ProviderConfig[] => [
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
        env.NODE_ENV === 'production' && env.FORCE_GMAIL_CONSENT !== 'true' ? undefined : 'consent',
      accessType: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    required: true,
  },
  //   {
  //     id: 'microsoft',
  //     name: 'Microsoft',
  //     requiredEnvVars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  //     envVarInfo: [
  //       { name: 'MICROSOFT_CLIENT_ID', source: 'Microsoft Azure App ID' },
  //       { name: 'MICROSOFT_CLIENT_SECRET', source: 'Microsoft Azure App Password' },
  //     ],
  //     config: {
  //       clientId: env.MICROSOFT_CLIENT_ID!,
  //       clientSecret: env.MICROSOFT_CLIENT_SECRET!,
  //       redirectUri: env.MICROSOFT_REDIRECT_URI!,
  //       scope: ['https://graph.microsoft.com/User.Read', 'offline_access'],
  //       authority: 'https://login.microsoftonline.com/common',
  //       responseType: 'code',
  //       prompt: 'consent',
  //       loginHint: 'email',
  //     },
  //   },
];

export function isProviderEnabled(provider: ProviderConfig, env: Record<string, string>): boolean {
  if (provider.isCustom) return true;

  const hasEnvVars = provider.requiredEnvVars.every((envVar) => !!env[envVar]);

  if (provider.required && !hasEnvVars) {
    console.error(`Required provider "${provider.id}" is not configured properly.`);
    console.error(
      `Missing environment variables: ${provider.requiredEnvVars.filter((envVar) => !env[envVar]).join(', ')}`,
    );
  }

  return hasEnvVars;
}

export function getSocialProviders(env: Record<string, string>) {
  const socialProviders = Object.fromEntries(
    authProviders(env)
      .map((provider) => {
        if (isProviderEnabled(provider, env)) {
          return [provider.id, provider.config] as [string, unknown];
        } else if (provider.required) {
          throw new Error(
            `Required provider "${provider.id}" is not configured properly. Check your environment variables.`,
          );
        } else {
          console.warn(`Provider "${provider.id}" is not configured properly. Skipping.`);
          return null;
        }
      })
      .filter((provider) => provider !== null),
  );
  return socialProviders;
}
