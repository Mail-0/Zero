import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { OnboardingWrapper } from '@/components/onboarding';
import { NotificationProvider } from '@/components/party';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { Outlet, useLoaderData } from 'react-router';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  return {
    headers: Object.fromEntries(request.headers.entries()),
  };
}

export default function MailLayout() {
  const { headers } = useLoaderData<typeof loader>();
  return (
    <HotkeyProviderWrapper>
      <AppSidebar />
      <div className="bg-sidebar dark:bg-sidebar w-full">
        <Outlet />
      </div>
      <OnboardingWrapper />
      <NotificationProvider headers={headers} />
    </HotkeyProviderWrapper>
  );
}
