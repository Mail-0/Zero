"use client";

import { GitHub, Google } from "@/components/icons/icons";
import { signIn, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { EnvVarInfo } from "@/lib/auth-providers";

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
}

interface LoginClientProps {
  providers: Provider[];
}

const getProviderIcon = (providerId: string, className?: string): ReactNode => {
  const defaultClass = className || "w-5 h-5 mr-2";
  
  switch (providerId) {
    case "google":
      return <Google className={defaultClass} />;
    case "github":
      return <GitHub className={defaultClass} />;
    default:
      return null;
  }
};

export function LoginClient({ providers }: LoginClientProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    const missingProviders = providers
      .filter(p => p.required && !p.enabled);
      
    if (missingProviders.length > 0 && missingProviders[0]?.id) {
      setExpandedProviders({ [missingProviders[0].id]: true });
    }
  }, [providers]);

  const missingRequiredProviders = providers
    .filter(p => p.required && !p.enabled)
    .map(p => p.name);

  const missingProviders = providers
    .filter(p => p.required && !p.enabled && p.envVarInfo)
    .map(p => ({
      id: p.id,
      name: p.name,
      envVarInfo: p.envVarInfo || [],
      envVarStatus: p.envVarStatus
    }));

  const toggleProvider = (providerId: string) => {
    setExpandedProviders(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  useEffect(() => {
    if (!isPending && session?.connectionId) {
      router.push("/mail");
    }
  }, [session, isPending, router]);

  if (isPending || (session && session.connectionId)) return null;

  const sortedProviders = [...providers].sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white dark:bg-black">
      <div className="max-w-[500px] space-y-8 px-4 duration-500 animate-in slide-in-from-bottom-4 sm:px-12 md:px-0">
        <p className="text-center font-mono text-4xl font-bold md:text-5xl">Welcome to 0</p>
        <div className="flex w-full items-center justify-center">
          <Image
            src="/mail.svg"
            alt="logo"
            className="w-[300px] sm:w-[500px]"
            width={500}
            height={500}
          />
        </div>
        
        {missingRequiredProviders.length > 0 ? (
          <div className="bg-black/5 border border-black/10 rounded-lg p-5 dark:bg-white/5 dark:border-white/10">
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
                To enable login with <span className="font-semibold">{missingRequiredProviders.join(', ')}</span>, 
                add these variables to your <code className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">.env</code> file:
              </p>
              
              <div className="space-y-3">
                {missingProviders.map((provider) => (
                  <div key={provider.id} className="border border-black/10 dark:border-white/10 rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleProvider(provider.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center">
                        {getProviderIcon(provider.id)}
                        <span className="font-medium text-black dark:text-white">{provider.name}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs mr-2 text-black/60 dark:text-white/60">
                          {provider.envVarStatus.filter(v => !v.set).length} missing
                        </span>
                        <svg
                          className={`h-5 w-5 text-black/60 dark:text-white/60 transition-transform duration-200 ${expandedProviders[provider.id] ? 'rotate-180' : ''}`}
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
                      <div className="p-4 font-mono text-sm bg-black/[0.03] dark:bg-white/[0.03]">
                        {provider.envVarStatus.map((envVar) => (
                          <div key={envVar.name} 
                            className={`flex items-start mb-3 last:mb-0 transition-all duration-300 ease-in-out ${expandedProviders[provider.id] ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
                            style={{ 
                              transitionDelay: expandedProviders[provider.id] 
                                ? `${provider.envVarStatus.indexOf(envVar) * 50}ms` 
                                : '0ms' 
                            }}
                          >
                            <div className={`w-2 h-2 mt-1.5 mr-2 rounded-full ${!envVar.set ? 'bg-red-500' : 'bg-green-500'}`} />
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="text-black dark:text-white font-semibold">{envVar.name}</span>
                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${!envVar.set ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                                  {!envVar.set ? 'Missing' : 'Set'}
                                </span>
                              </div>
                              {!envVar.set && (
                                <div className="mt-1.5">
                                  <code className="block text-black/80 dark:text-white/80">
                                    {envVar.name}={envVar.defaultValue || `# from ${envVar.source}`}
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
                className="text-sm inline-flex items-center text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white underline underline-offset-2"
              >
                Setup instructions in documentation
                <svg 
                  className="ml-1 h-3 w-3" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        ) : (
          <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-2 sm:flex-row">
            {sortedProviders.map(provider => 
              provider.enabled && (
                <Button
                  key={provider.id}
                  onClick={async () => {
                    toast.promise(
                      signIn.social({
                        provider: provider.id as any,
                        callbackURL: "/mail",
                      }),
                      {
                        loading: "Redirecting...",
                        success: "Redirected successfully!",
                        error: "Login redirect failed",
                      },
                    );
                  }}
                  className="h-9 w-full rounded-lg border-2 border-input bg-background bg-black text-primary hover:bg-accent hover:text-accent-foreground"
                >
                  {getProviderIcon(provider.id)}
                  Continue with {provider.name}
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
} 