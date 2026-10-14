import {
  SettingsEmpty,
  SettingsGroup,
  destructiveIconButton,
  iconButton,
  primaryButton,
  rowClass,
} from '@/components/settings/settings-ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingsCard } from '@/components/settings/settings-card';
import { LabelDialog } from '@/components/labels/label-dialog';
import { useTRPC } from '@/providers/query-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation } from '@tanstack/react-query';
import { type Label as LabelType } from '@/types';
import { Button } from '@/components/ui/button';
import { Bin } from '@/components/icons/icons';
import { useLabels } from '@/hooks/use-labels';
import { Plus, Pencil } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LabelsPage() {
  const { userLabels: labels, isLoading, error, refetch } = useLabels();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null);

  const trpc = useTRPC();
  const { mutateAsync: createLabel } = useMutation(trpc.labels.create.mutationOptions());
  const { mutateAsync: updateLabel } = useMutation(trpc.labels.update.mutationOptions());
  const { mutateAsync: deleteLabel } = useMutation(trpc.labels.delete.mutationOptions());

  const handleSubmit = async (data: LabelType) => {
    await toast.promise(
      editingLabel
        ? updateLabel({ id: editingLabel.id!, name: data.name, color: data.color })
        : createLabel({ color: data.color, name: data.name }),
      {
        loading: m['common.labels.savingLabel'](),
        success: m['common.labels.saveLabelSuccess'](),
        error: m['common.labels.failedToSavingLabel'](),
      },
    );
  };

  const handleDelete = async (id: string) => {
    toast.promise(deleteLabel({ id }), {
      loading: m['common.labels.deletingLabel'](),
      success: m['common.labels.deleteLabelSuccess'](),
      error: m['common.labels.failedToDeleteLabel'](),
      finally: async () => {
        await refetch();
      },
    });
  };

  const handleEdit = (label: LabelType) => {
    setEditingLabel(label);
    setIsDialogOpen(true);
  };

  return (
    <SettingsCard
      title={m['pages.settings.labels.title']()}
      description={m['pages.settings.labels.description']()}
      action={
        <LabelDialog
          trigger={
            <Button className={cn(primaryButton, 'gap-1.5')}>
              <Plus className="size-3.5" />
              {m['common.mail.createNewLabel']()}
            </Button>
          }
          editingLabel={editingLabel}
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingLabel(null);
          }}
          onSubmit={handleSubmit}
          onSuccess={refetch}
        />
      }
    >
      {isLoading && !error ? (
        <SettingsGroup>
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className={rowClass}>
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          ))}
        </SettingsGroup>
      ) : error ? (
        <SettingsEmpty>{error.message}</SettingsEmpty>
      ) : !labels?.length ? (
        <SettingsEmpty>{m['common.mail.noLabelsAvailable']()}</SettingsEmpty>
      ) : (
        <SettingsGroup>
          {labels.map((label) => (
            <div key={label.id} className={cn(rowClass, 'group py-2')}>
              <span
                className="size-3 shrink-0 rounded-full border border-black/5 dark:border-white/10"
                style={{ backgroundColor: label.color?.backgroundColor }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px]">{label.name}</span>
              <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className={iconButton}
                      aria-label={m['common.labels.editLabel']()}
                      onClick={() => handleEdit(label)}
                    >
                      <Pencil />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{m['common.labels.editLabel']()}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className={destructiveIconButton}
                      aria-label={m['common.labels.deleteLabel']()}
                      onClick={() => handleDelete(label.id!)}
                    >
                      <Bin className="fill-[#F43F5E]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{m['common.labels.deleteLabel']()}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </SettingsGroup>
      )}
    </SettingsCard>
  );
}
