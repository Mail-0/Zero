import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';
import { LogOut } from 'lucide-react';
import { Link } from 'react-router';
import { m } from '@/paraglide/messages';
import { toast } from 'sonner';

export function DoormanTopBar() {
  const handleLogout = async () => {
    toast.promise(signOut(), {
      loading: m['common.actions.signingOut'](),
      success: () => m['common.actions.signedOutSuccess'](),
      error: m['common.actions.signOutError'](),
      finally() {
        window.location.href = '/login';
      },
    });
  };

  return (
    <header className="bg-sidebar border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
      <Link
        to="/mail"
        className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
      >
        <img
          src="/icons-pwa/icon-180.png"
          alt="Doorman"
          width={28}
          height={28}
          className="rounded-md"
        />
        <span className="text-foreground text-lg font-semibold tracking-tight">Doorman</span>
      </Link>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void handleLogout()}
        className="text-muted-foreground hover:text-foreground gap-2"
      >
        <LogOut className="h-4 w-4" />
        {m['common.actions.logout']()}
      </Button>
    </header>
  );
}
