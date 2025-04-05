'use client';

import { useEffect, type ReactNode, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type EnvVarInfo } from '@/lib/auth-providers';
import { signIn, useSession } from '@/lib/auth-client';
import { Google } from '@/components/icons/icons';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { toast } from 'sonner';
import Link from 'next/link';

interface EnvVarStatus {
  name: string;
  set: boolean;
  source: string;
  defaultValue?: string;
}

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  required?: boolean;
  envVarInfo?: EnvVarInfo[];
  envVarStatus: EnvVarStatus[];
  isCustom?: boolean;
  customRedirectPath?: string;
}

interface LoginClientProps {
  providers: Provider[];
  isProd: boolean;
}

const getProviderIcon = (providerId: string, className?: string): ReactNode => {
  const defaultClass = className || 'w-5 h-5 mr-2';

  switch (providerId) {
    case 'google':
      return <Google className={defaultClass} />;

    case 'zero':
      return (
        <Image
          src="/white-icon.svg"
          alt="Zero"
          width={15}
          height={15}
          className="mr-2 invert dark:invert-0"
        />
      );
    default:
      return null;
  }
};

function LoginClientContent({ providers, isProd }: LoginClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'early_access_required') {
      toast.error('Early access is required to log in');
    }

    const missing = providers.find((p) => p.required && !p.enabled);
    if (missing?.id) {
      setExpandedProviders({ [missing.id]: true });
    }
  }, [searchParams, providers, router]);

  const missingRequiredProviders = providers
    .filter((p) => p.required && !p.enabled)
    .map((p) => p.name);

  const missingProviders = providers
    .filter((p) => p.required && !p.enabled && p.envVarInfo)
    .map((p) => ({
      id: p.id,
      name: p.name,
      envVarInfo: p.envVarInfo || [],
      envVarStatus: p.envVarStatus,
    }));

  const toggleProvider = (providerId: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  useEffect(() => {
    if (!isPending && session?.connectionId) {
      router.push('/mail');
    }
  }, [session, isPending, router]);

  if (isPending || (session && session.connectionId)) return null;

  const displayProviders = isProd ? providers.filter((p) => p.enabled || p.isCustom) : providers;

  const hasMissingRequiredProviders = missingRequiredProviders.length > 0;

  const shouldShowDetailedConfig = !isProd && hasMissingRequiredProviders;

  const shouldShowSimplifiedMessage = isProd && hasMissingRequiredProviders;

  const handleProviderClick = (provider: Provider) => {
    if (provider.isCustom && provider.customRedirectPath) {
      router.push(provider.customRedirectPath);
    } else {
      toast.promise(
        signIn.social({
          provider: provider.id as any,
          callbackURL: '/mail',
        }),
        {
          loading: 'Redirecting...',
          success: 'Redirected successfully!',
          error: 'Login redirect failed',
        },
      );
    }
  };

  const sortedProviders = [...displayProviders].sort((a, b) => {
    if (a.id === 'zero') return -1;
    if (b.id === 'zero') return 1;

    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-between">
      <div className="absolute left-4 top-4 z-10">
        <Link href="/">
          <Image
            src="/white-icon.svg"
            alt="Zero"
            width={40}
            height={40}
            className="cursor-pointer invert dark:invert-0"
          />
        </Link>
      </div>

      <div className="animate-in slide-in-from-bottom-4 mx-auto flex max-w-[600px] flex-grow items-center justify-center space-y-8 px-4 duration-500 sm:px-12 md:px-0">
        <div className="w-full space-y-8">
          <p className="text-center text-4xl font-bold md:text-5xl">Login to Zero</p>

          {shouldShowDetailedConfig && (
            <div className="rounded-lg border border-black/10 bg-black/5 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-black dark:text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <h3 className="ml-2 text-base font-medium text-black dark:text-white">
                    Configuration Required
                  </h3>
                </div>

                <p className="text-sm text-black/80 dark:text-white/80">
                  To enable login with{' '}
                  <span className="font-semibold">{missingRequiredProviders.join(', ')}</span>, add
                  these variables to your{' '}
                  <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono dark:bg-white/10">
                    .env
                  </code>{' '}
                  file:
                </p>

                <div className="space-y-3">
                  {missingProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className="overflow-hidden rounded-md border border-black/10 dark:border-white/10"
                    >
                      <button
                        onClick={() => toggleProvider(provider.id)}
                        className="flex w-full items-center justify-between bg-black/5 px-4 py-3 text-left transition-colors hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <div className="flex items-center">
                          {getProviderIcon(provider.id)}
                          <span className="font-medium text-black dark:text-white">
                            {provider.name}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2 text-xs text-black/60 dark:text-white/60">
                            {provider.envVarStatus.filter((v) => !v.set).length} missing
                          </span>
                          <svg
                            className={`h-5 w-5 text-black/60 transition-transform duration-200 dark:text-white/60 ${expandedProviders[provider.id] ? 'rotate-180' : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedProviders[provider.id] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                      >
                        <div className="bg-black/[0.03] p-4 font-mono text-sm dark:bg-white/[0.03]">
                          {provider.envVarStatus.map((envVar) => (
                            <div
                              key={envVar.name}
                              className={`mb-3 flex items-start transition-all duration-300 ease-in-out last:mb-0 ${expandedProviders[provider.id] ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
                              style={{
                                transitionDelay: expandedProviders[provider.id]
                                  ? `${provider.envVarStatus.indexOf(envVar) * 50}ms`
                                  : '0ms',
                              }}
                            >
                              <div
                                className={`mr-2 mt-1.5 h-2 w-2 rounded-full ${!envVar.set ? 'bg-red-500' : 'bg-green-500'}`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <span className="font-semibold text-black dark:text-white">
                                    {envVar.name}
                                  </span>
                                  <span
                                    className={`ml-2 rounded px-1.5 py-0.5 text-xs ${!envVar.set ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}
                                  >
                                    {!envVar.set ? 'Missing' : 'Set'}
                                  </span>
                                </div>
                                {!envVar.set && (
                                  <div className="mt-1.5">
                                    <code className="block text-black/80 dark:text-white/80">
                                      {envVar.name}=
                                      {envVar.defaultValue || `# from ${envVar.source}`}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <a
                  href="https://github.com/Mail-0/Mail-0/blob/main/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-black/60 underline underline-offset-2 hover:text-black dark:text-white/60 dark:hover:text-white"
                >
                  Setup instructions in documentation
                  <svg
                    className="ml-1 h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          )}

          {shouldShowSimplifiedMessage && (
            <div className="rounded-lg border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-black dark:text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="ml-2 text-sm text-black/80 dark:text-white/80">
                  Authentication service unavailable
                </p>
              </div>
            </div>
          )}

          {!hasMissingRequiredProviders && (
            <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-2">
              {sortedProviders.map(
                (provider) =>
                  (provider.enabled || provider.isCustom) && (
                    <Button
                      key={provider.id}
                      onClick={() => handleProviderClick(provider)}
                      className="border-input bg-background text-primary hover:bg-accent hover:text-accent-foreground h-12 w-full rounded-lg border-2"
                    >
                      {getProviderIcon(provider.id)}
                      Continue with {provider.name}
                    </Button>
                  ),
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="w-full px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-6">
          <a
            href="/terms"
            className="text-[10px] text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Terms of Service
          </a>
          <a
            href="/privacy"
            className="text-[10px] text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}

export function LoginClient(props: LoginClientProps) {
  const fallback = (
    <div className="flex min-h-screen w-full items-center justify-center">
      <p>Loading...</p>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <LoginClientContent {...props} />
    </Suspense>
  );
}
