import { ArrowLeft, ChevronDown, ExternalLink, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { PixelatedBackground } from '@/components/home/pixelated-bg';
import type { EnvVarInfo } from '@zero/server/auth-providers';
import { assistantReturnTo } from '@/lib/assistant-return-to';
import { Google, Microsoft } from '@/components/icons/icons';
import ErrorMessage from '@/app/(auth)/login/error-message';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';
import { motion } from 'motion/react';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';

interface EnvVarStatus {
  name: string;
  set: boolean;
  source: string;
  defaultValue?: string;
}

export interface Provider {
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

    case 'microsoft':
      return <Microsoft className={defaultClass} />;

    case 'zero':
      return (
        <>
          <img
            src="/white-icon.svg"
            alt="Zero"
            width={15}
            height={15}
            className="mr-2 hidden dark:block"
          />
          <img
            src="/black-icon.svg"
            alt="Zero"
            width={15}
            height={15}
            className="mr-2 block dark:hidden"
          />
        </>
      );
    default:
      return null;
  }
};

function LoginClientContent({ providers, isProd }: LoginClientProps) {
  const navigate = useNavigate();
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [error, _] = useQueryState('error');
  const [returnTo] = useQueryState('returnTo');

  useEffect(() => {
    const missing = providers.find((p) => p.required && !p.enabled);
    if (missing?.id) {
      setExpandedProviders({ [missing.id]: true });
    }
  }, [providers]);

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

  const displayProviders = isProd ? providers.filter((p) => p.enabled || p.isCustom) : providers;

  const hasMissingRequiredProviders = missingRequiredProviders.length > 0;

  const shouldShowDetailedConfig = !isProd && hasMissingRequiredProviders;

  const shouldShowSimplifiedMessage = isProd && hasMissingRequiredProviders;

  const handleProviderClick = (provider: Provider) => {
    if (provider.isCustom && provider.customRedirectPath) {
      navigate(provider.customRedirectPath);
    } else {
      toast.promise(
        signIn.social({
          provider: provider.id as Parameters<typeof signIn.social>[0]['provider'],
          callbackURL: `${window.location.origin}${assistantReturnTo(returnTo)}`,
        }),
        {
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
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#0F0F0F] text-white">
      <PixelatedBackground
        className="pointer-events-none absolute top-[-40px] left-1/2 z-0 h-auto w-screen min-w-[1920px] -translate-x-1/2 object-cover"
        style={{
          mixBlendMode: 'screen',
          maskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
      />

      <header className="relative z-10 flex w-full justify-center px-4 pt-6">
        <nav className="flex w-full max-w-4xl items-center justify-between rounded-xl border-t border-[#2A2A2A] bg-[#1E1E1E] p-3 px-6">
          <Link to="/" className="relative bottom-0.5 flex items-center gap-2">
            <img src="/white-icon.svg" alt="Zero" width={22} height={22} />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-[#B7B7B7] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </nav>
      </header>

      <section className="relative z-10 flex grow items-center justify-center px-4 py-16">
        <div className="w-full max-w-[440px]">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center text-4xl font-medium md:text-5xl"
          >
            Welcome back
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-3 max-w-sm text-center text-base font-medium text-[#B7B7B7]"
          >
            The AI-native email client that manages your inbox, so you don&apos;t have to.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 space-y-4 rounded-2xl border border-[#2A2A2A] bg-[#1E1E1E]/80 p-4 shadow-md backdrop-blur-sm sm:p-6"
          >
            {error && (
              <Alert variant="default" className="border-orange-500/40 bg-orange-500/10">
                <AlertTitle className="text-orange-400">Error</AlertTitle>
                <AlertDescription>Failed to log you in. Please try again.</AlertDescription>
              </Alert>
            )}

            {shouldShowDetailedConfig && (
              <div className="rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] p-4">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center gap-2">
                    <TriangleAlert size={20} className="text-orange-400" />
                    <h3 className="text-sm font-medium">Configuration required</h3>
                  </div>

                  <p className="text-sm text-[#B7B7B7]">
                    To enable login with{' '}
                    <span className="font-semibold text-white">
                      {missingRequiredProviders.join(', ')}
                    </span>
                    , add these variables to your{' '}
                    <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">.env</code> file:
                  </p>

                  <div className="space-y-3">
                    {missingProviders.map((provider) => (
                      <div
                        key={provider.id}
                        className="overflow-hidden rounded-lg border border-[#2A2A2A]"
                      >
                        <button
                          onClick={() => toggleProvider(provider.id)}
                          className="flex w-full items-center justify-between bg-[#1E1E1E] px-4 py-3 text-left transition-colors hover:bg-[#262626]"
                        >
                          <div className="flex items-center">
                            {getProviderIcon(provider.id)}
                            <span className="font-medium">{provider.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#B7B7B7]">
                            {provider.envVarStatus.filter((v) => !v.set).length} missing
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${expandedProviders[provider.id] ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>

                        <div
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedProviders[provider.id] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                          <div className="space-y-3 p-4 font-mono text-sm">
                            {provider.envVarStatus.map((envVar) => (
                              <div key={envVar.name} className="flex items-start">
                                <div
                                  className={`mt-1.5 mr-2 h-2 w-2 rounded-full ${!envVar.set ? 'bg-red-500' : 'bg-green-500'}`}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center">
                                    <span className="font-semibold">{envVar.name}</span>
                                    <span
                                      className={`ml-2 rounded px-1.5 py-0.5 text-xs ${!envVar.set ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}
                                    >
                                      {!envVar.set ? 'Missing' : 'Set'}
                                    </span>
                                  </div>
                                  {!envVar.set && (
                                    <code className="mt-1.5 block text-[#B7B7B7]">
                                      {envVar.name}=
                                      {envVar.defaultValue || `# from ${envVar.source}`}
                                    </code>
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
                    className="inline-flex items-center gap-1 text-sm text-[#B7B7B7] underline underline-offset-2 hover:text-white"
                  >
                    Setup instructions in documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {shouldShowSimplifiedMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] p-4">
                <TriangleAlert size={20} className="text-orange-400" />
                <p className="text-sm text-[#B7B7B7]">Authentication service unavailable</p>
              </div>
            )}

            <ErrorMessage />

            {!hasMissingRequiredProviders && (
              <div className="flex w-full flex-col gap-2">
                {sortedProviders.map(
                  (provider) =>
                    (provider.enabled || provider.isCustom) && (
                      <Button
                        key={provider.id}
                        onClick={() => handleProviderClick(provider)}
                        className="h-12 w-full rounded-lg bg-white text-base font-medium text-black hover:bg-white/90"
                      >
                        {getProviderIcon(provider.id)}
                        Continue with {provider.name}
                      </Button>
                    ),
                )}
              </div>
            )}

            <p className="text-center text-xs text-[#B7B7B7]/60">No credit card required.</p>
          </motion.div>
        </div>
      </section>

      <footer className="relative z-10 w-full px-6 pb-6">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-6 text-xs text-[#B7B7B7]/60">
          <Link to="/terms" className="transition-colors hover:text-white">
            Terms of Service
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-white">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </main>
  );
}

export function LoginClient(props: LoginClientProps) {
  const fallback = (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0F0F0F]">
      <p className="text-sm text-[#B7B7B7]">Loading...</p>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <LoginClientContent {...props} />
    </Suspense>
  );
}
