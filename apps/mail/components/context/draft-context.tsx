import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { Trash } from 'lucide-react';
import { type ReactNode } from 'react';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { useMail } from '../mail/use-mail';
import { useTranslations } from 'use-intl';


interface DraftContextMenuProps {
  children: ReactNode;
  draftId: string;
}

export function DraftContextMenu({
  children,
  draftId,
}: DraftContextMenuProps) {
  const { optimisticDeleteDrafts } = useOptimisticActions();
  const t = useTranslations();
  const [mail, setMail] = useMail();

  const handleDeleteDraft = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [draftId];
    optimisticDeleteDrafts(targets);

    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className="w-full">{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="dark:bg-panelDark w-56 bg-white"
        onContextMenu={(e) => e.preventDefault()}
      >
        <ContextMenuItem
          onClick={handleDeleteDraft}
          className="font-normal"
        >
          <Trash className="mr-2.5 h-4 w-4" />
          {t('common.actions.deleteDraft')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}