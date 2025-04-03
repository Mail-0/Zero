'use client';
import { type SquarePenIconHandle } from '../icons/animated/square-pen';
import { useSidebar } from '../context/sidebar-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { SquarePenIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import { useRef } from 'react';
import Link from 'next/link';

export function ComposeButton() {
  const iconRef = useRef<SquarePenIconHandle>(null);
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const t = useTranslations();
  return (
    <Link
      prefetch={true}
      href={'/mail/create'}
      className="bg-secondary bg-subtleWhite text-primary hover:bg-subtleWhite dark:bg-subtleBlack dark:hover:bg-subtleBlack relative isolate mt-1 h-8 w-[calc(100%)] overflow-hidden whitespace-nowrap shadow-inner"
      onMouseEnter={() => () => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => () => iconRef.current?.stopAnimation?.()}
    >
      {state === 'collapsed' && !isMobile ? (
        <SquarePenIcon ref={iconRef} className="size-4" />
      ) : (
        <>
          <span className="text-center text-sm">{t('common.actions.create')}</span>
        </>
      )}
    </Link>
  );
}
