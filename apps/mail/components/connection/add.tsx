import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { useBilling } from '@/hooks/use-billing';
import { emailProviders } from '@/lib/constants';
import { authClient } from '@/lib/auth-client';
import { Plus, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

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
  const t = useTranslations();

  const canCreateConnection = useMemo(() => {
    if (!connections?.remaining && !connections?.unlimited) return false;
    return (connections?.unlimited && !connections?.remaining) || (connections?.remaining ?? 0) > 0;
  }, [connections]);

  const handleUpgrade = async () => {
    if (attach) {
      return attach({
        productId: 'pro-example',
      })
        .catch((error) => {
          console.error('Failed to upgrade:', error);
        })
        .then(() => {
          console.log('Upgraded successfully');
        });
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button
            size={'dropdownItem'}
            variant={'dropdownItem'}
            className={cn('w-full justify-start gap-2', className)}
          >
            <UserPlus size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
            <p className="text-[13px] opacity-60">{t('pages.settings.connections.addEmail')}</p>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="w-full max-w-sm rounded-xl border bg-white p-6 sm:max-w-md dark:bg-[#1A1A1A]"
        showOverlay={true}
      >
        <DialogHeader>
          <DialogTitle>{t('pages.settings.connections.connectEmail')}</DialogTitle>
          <DialogDescription>
            {t('pages.settings.connections.connectEmailDescription')}
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
                Upgrade
              </span>{' '}
              to connect more.
            </span>
            <Button onClick={handleUpgrade} className="text-sm">
              $20<span className="text-muted-foreground -ml-2 text-xs">/month</span>
            </Button>
          </div>
        )}
        <motion.div
          className="mt-4 grid grid-cols-2 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {emailProviders.map((provider, index) => (
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
                  })
                }
              >
                <svg viewBox="0 0 24 24" className="h-12 w-12">
                  <path fill="currentColor" d={provider.icon} />
                </svg>
                <span className="text-xs">{provider.name}</span>
              </Button>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: emailProviders.length * 0.1, duration: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Button
              variant="outline"
              className="h-24 w-full flex-col items-center justify-center gap-2 border-dashed"
            >
              <Plus className="h-12 w-12" />
              <span className="text-xs">{t('pages.settings.connections.moreComingSoon')}</span>
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
