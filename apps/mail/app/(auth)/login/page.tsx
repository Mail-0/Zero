import { authProviders, customProviders, isProviderEnabled } from '@zero/server/auth-providers';
import { authProxy } from '@/lib/auth-proxy';
import { LoginClient } from './login-client';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

export default async function LoginPage() {
  const headersList = new Headers(Object.fromEntries(await (await headers()).entries()));
  const session = await authProxy.api.getSession({ headers: headersList });
  if (session?.connectionId) {
    redirect('/mail/inbox');
  }
  const envNodeEnv = env.NODE_ENV;
  const isProd = envNodeEnv === 'production';

  const authProviderStatus = authProviders(env as unknown as Record<string, string>).map(
    (provider) => {
      const envVarStatus =
        provider.envVarInfo?.map((envVar) => {
          const envVarName = envVar.name as keyof typeof env;
          return {
            name: envVar.name,
            set: !!env[envVarName],
            source: envVar.source,
            defaultValue: envVar.defaultValue,
          };
        }) || [];

      return {
        id: provider.id,
        name: provider.name,
        enabled: isProviderEnabled(provider, env as unknown as Record<string, string>),
        required: provider.required,
        envVarInfo: provider.envVarInfo,
        envVarStatus,
      };
    },
  );

  const customProviderStatus = customProviders.map((provider) => {
    return {
      id: provider.id,
      name: provider.name,
      enabled: true,
      isCustom: provider.isCustom,
      customRedirectPath: provider.customRedirectPath,
      envVarStatus: [],
    };
  });

  const allProviders = [...customProviderStatus, ...authProviderStatus];

  return (
    <div className="flex min-h-screen w-full flex-col bg-white dark:bg-black">
      <LoginClient providers={allProviders} isProd={isProd} />
    </div>
  );
}
