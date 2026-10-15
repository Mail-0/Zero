import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { recoveryAuthClient, useSession } from '@/lib/auth-client';
import { Google, Microsoft } from '@/components/icons/icons';
import { Link, useSearchParams } from 'react-router';
import { getConsentURL } from '@/lib/auth-recovery';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function ReconnectPage() {
  const [params] = useSearchParams();
  const provider = params.get('provider');
  const loginHint = params.get('loginHint');
  const email = params.get('email');
  const { data: session, isPending } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validProvider = provider === 'google' || provider === 'microsoft';
  const providerName = provider === 'google' ? 'Google' : 'Microsoft';

  const reconnect = async () => {
    if (!validProvider || !loginHint || isRedirecting) return;
    setIsRedirecting(true);
    setError(null);
    try {
      const callbackURL = `${window.location.origin}${session ? '/settings/connections' : '/mail'}`;
      const errorCallbackURL = window.location.href.split('#')[0];
      const result = session
        ? await recoveryAuthClient.linkSocial({
            provider,
            callbackURL,
            errorCallbackURL,
          })
        : await recoveryAuthClient.signIn.social({
            provider,
            loginHint,
            callbackURL,
            errorCallbackURL,
            disableRedirect: true,
          });
      if (result.error || !result.data || !('url' in result.data) || !result.data.url) {
        throw new Error(result.error?.message || 'Could not start reconnection. Please try again.');
      }
      // This Better Auth version only supports prompt in provider config. Override it for this
      // repair request without forcing every normal login to show consent.
      window.location.assign(getConsentURL(result.data.url, provider, loginHint));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reconnect. Please try again.');
      setIsRedirecting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F0F0F] px-4 py-12 text-white">
      <section className="w-full max-w-[440px] space-y-6 rounded-2xl border border-[#2A2A2A] bg-[#1E1E1E] p-6 sm:p-8">
        <img src="/white-icon.svg" alt="Zero" width={28} height={28} />
        <div className="space-y-3">
          <h1 className="text-2xl font-medium">Reconnect your email account</h1>
          <p className="text-sm text-[#B7B7B7]">
            Your email connection is missing the permission needed to stay connected. Sign in to the
            same account and approve access again so we can securely refresh your connection.
          </p>
          {email && <p className="text-sm font-medium break-all">{email}</p>}
        </div>
        {!validProvider || !loginHint ? (
          <Alert className="border-orange-500/40 bg-orange-500/10 text-orange-300">
            <AlertTitle>Connection not specified</AlertTitle>
            <AlertDescription>Open your connection settings and choose Reconnect.</AlertDescription>
          </Alert>
        ) : (
          <>
            {(error || (params.get('error') && params.get('error') !== 'missing_tokens')) && (
              <Alert className="border-orange-500/40 bg-orange-500/10 text-orange-300">
                <AlertTitle>Reconnection failed</AlertTitle>
                <AlertDescription>
                  {error || 'Please try again and approve access to your email account.'}
                </AlertDescription>
              </Alert>
            )}
            <Button
              className="h-12 w-full bg-white text-black hover:bg-white/90"
              disabled={isPending || isRedirecting}
              onClick={() => void reconnect()}
            >
              {provider === 'google' ? (
                <Google className="mr-2 size-5" />
              ) : (
                <Microsoft className="mr-2 size-5" />
              )}
              {isRedirecting ? 'Redirecting…' : `Reconnect with ${providerName}`}
            </Button>
            <p className="text-xs text-[#B7B7B7]">
              Approve the requested permissions on the next screen to restore access. Your existing
              account and email will not be deleted.
            </p>
          </>
        )}
        <Link
          className="inline-flex min-h-11 items-center text-sm text-[#B7B7B7] underline underline-offset-4"
          to={session ? '/settings/connections' : '/login'}
        >
          {session ? 'Back to connections' : 'Back to login'}
        </Link>
      </section>
    </main>
  );
}
