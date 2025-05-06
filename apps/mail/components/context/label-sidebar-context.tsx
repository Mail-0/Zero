import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useLabels } from '@/hooks/use-labels';
import { useTranslations } from 'next-intl';
import { Trash } from '../icons/icons';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface LabelAction {
  id: string;
  label: string | ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

interface LabelSidebarContextMenuProps {
  children: ReactNode;
  labelId: string;
}

export function LabelSidebarContextMenu({ children, labelId }: LabelSidebarContextMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const t = useTranslations();
  const trpc = useTRPC();
  const { mutateAsync: deleteLabel } = useMutation(trpc.labels.delete.mutationOptions());
  const { refetch } = useLabels();

  const handleDelete = () => {
    toast.promise(deleteLabel({ id: labelId }), {
      success: t('common.labels.deleteLabelSuccess'),
      error: 'Error deleting label',
      finally: () => {
        refetch();
        setDeleteDialogOpen(false);
      },
    });
  };

  return (
    <>
      <ContextMenu modal={false}>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="bg-white dark:bg-[#313131]">
          <ContextMenuItem
            asChild
            onClick={() => setDeleteDialogOpen(true)}
            disabled={false}
            className="gap-2 text-sm"
          >
            <Button
              size={'sm'}
              variant="ghost"
              className="hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-3.5"
            >
              <Trash className="fill-[#F43F5E]" />
              <span>{t('common.labels.deleteLabel')}</span>
            </Button>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent
          className="bg-panelLight dark:bg-panelDark rounded-xl p-4"
          showOverlay={true}
        >
          <DialogHeader>
            <DialogTitle>{t('common.labels.deleteLabelConfirm')}</DialogTitle>
            <DialogDescription>
              {t('common.labels.deleteLabelConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">{t('common.labels.deleteLabelConfirmCancel')}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={handleDelete}>{t('common.labels.deleteLabelConfirmDelete')}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
