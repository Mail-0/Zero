import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { IMAP_PRESETS, type ImapPreset } from './imap-presets';
import { useTRPC } from '@/providers/query-provider';
import { Mail, Plus, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBilling } from '@/hooks/use-billing';
import { emailProviders } from '@/lib/constants';
import { ImapConnectionForm } from './imap-form';
import { authClient } from '@/lib/auth-client';
import { useLocation } from 'react-router';
import { useMemo, useState } from 'react';
import { m } from '@/paraglide/messages';
import { ICloud } from '../icons/icons';
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const AddConnectionDialog = ({
  children,
  className,
  onOpenChange,
}: {
  children?: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { connections, attach } = useBilling();

  const canCreateConnection = useMemo(() => {
    if (!connections?.remaining && !connections?.unlimited) return false;
    return (connections?.unlimited && !connections?.remaining) || (connections?.remaining ?? 0) > 0;
  }, [connections]);
  const pathname = useLocation().pathname;
  const trpc = useTRPC();
  const { data: imapAvailability } = useQuery(trpc.connections.imap.enabled.queryOptions());
  // Shown unless the server explicitly reports IMAP as disabled (it enforces the flag too).
  const imapEnabled = imapAvailability?.enabled !== false;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'providers' | 'imap'>('providers');
  const [preset, setPreset] = useState<ImapPreset | undefined>();
  const presetIcons: Record<string, typeof ICloud> = { icloud: ICloud };
  const openImap = (selected?: ImapPreset) => {
    setPreset(selected);
    setMode('imap');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setMode('providers');
      setPreset(undefined);
    }
    onOpenChange?.(next);
  };

  const handleUpgrade = async () => {
    if (attach) {
      toast.promise(
        attach({
          productId: 'pro-example',
          successUrl: `${window.location.origin}/mail/inbox?success=true`,
        }),
        {
          success: 'Redirecting to payment...',
          error: 'Failed to process upgrade. Please try again later.',
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button
            size={'dropdownItem'}
            variant={'dropdownItem'}
            className={cn('w-full justify-start gap-2', className)}
          >
            <UserPlus size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
            <p className="text-[13px] opacity-60">{m['pages.settings.connections.addEmail']()}</p>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent showOverlay={true}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'imap'
              ? preset
                ? m['pages.settings.connections.imap.connectProvider']({ provider: preset.name })
                : m['pages.settings.connections.imap.title']()
              : m['pages.settings.connections.connectEmail']()}
          </DialogTitle>
          <DialogDescription>
            {mode === 'imap'
              ? m['pages.settings.connections.imap.description']()
              : m['pages.settings.connections.connectEmailDescription']()}
          </DialogDescription>
        </DialogHeader>
        {!canCreateConnection && (
          <div className="mt-2 flex justify-between gap-2 rounded-lg border border-red-800 bg-red-800/20 p-2">
            <span className="text-sm">
              You can only connect 1 email in the free tier.{' '}
              <span
                onClick={handleUpgrade}
                className="hover:bg-subtleWhite hover:text-subtleBlack cursor-pointer underline"
              >
                Start 7 day free trial
              </span>{' '}
              to connect more.
            </span>
            <Button onClick={handleUpgrade} className="text-sm">
              $20<span className="text-muted-foreground -ml-2 text-xs">/month</span>
            </Button>
          </div>
        )}
        {mode === 'imap' ? (
          <ImapConnectionForm
            key={preset?.id ?? 'custom'}
            preset={preset}
            onBack={() => {
              setMode('providers');
              setPreset(undefined);
            }}
            onDone={() => handleOpenChange(false)}
          />
        ) : (
          <motion.div
            className="mt-4 grid grid-cols-2 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {emailProviders.map((provider, index) => {
              const Icon = provider.icon;
              return (
                <motion.div
                  key={provider.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    disabled={!canCreateConnection}
                    variant="outline"
                    className="h-24 w-full flex-col items-center justify-center gap-2"
                    onClick={async () =>
                      await authClient.linkSocial({
                        provider: provider.providerId,
                        callbackURL: `${window.location.origin}${pathname}`,
                      })
                    }
                  >
                    <Icon className="size-6!" />
                    <span className="text-xs">{provider.name}</span>
                  </Button>
                </motion.div>
              );
            })}
            {imapEnabled &&
              IMAP_PRESETS.map((item, index) => {
                const Icon = presetIcons[item.id] ?? Mail;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (emailProviders.length + index) * 0.1, duration: 0.3 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      disabled={!canCreateConnection}
                      variant="outline"
                      className="h-24 w-full flex-col items-center justify-center gap-2"
                      onClick={() => openImap(item)}
                    >
                      <Icon className="size-6!" />
                      <span className="text-xs">{item.name}</span>
                    </Button>
                  </motion.div>
                );
              })}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: (emailProviders.length + (imapEnabled ? IMAP_PRESETS.length : 0)) * 0.1,
                duration: 0.3,
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {imapEnabled ? (
                <Button
                  disabled={!canCreateConnection}
                  variant="outline"
                  className="h-24 w-full flex-col items-center justify-center gap-2"
                  onClick={() => openImap()}
                >
                  <Mail className="size-6!" />
                  <span className="text-xs">{m['pages.settings.connections.otherProvider']()}</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-24 w-full flex-col items-center justify-center gap-2 border-dashed"
                >
                  <Plus className="h-12 w-12" />
                  <span className="text-xs">
                    {m['pages.settings.connections.moreComingSoon']()}
                  </span>
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};
