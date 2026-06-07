import { SettingsCard } from '@/components/settings/settings-card';
import { useSession } from '@/lib/auth-client';
import { m } from '@/paraglide/messages';

/**
 * User Information settings page.
 * Customize this file to add editable profile fields, forms, and save logic.
 */
export default function UserInformationPage() {
  const { data: session } = useSession();

  return (
    <SettingsCard
      title={m['navigation.settings.userInformation']()}
      description={m['pages.settings.userInformation.description']()}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">{m['pages.settings.userInformation.email']()}</p>
          <p className="text-muted-foreground text-sm">{session?.user?.email ?? '—'}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{m['pages.settings.userInformation.name']()}</p>
          <p className="text-muted-foreground text-sm">{session?.user?.name ?? '—'}</p>
        </div>
      </div>
    </SettingsCard>
  );
}
