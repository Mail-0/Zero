import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingsCard } from '@/components/settings/settings-card';
import { LabelDialog } from '@/components/labels/label-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurvedArrow } from '@/components/icons/icons';
import { Separator } from '@/components/ui/separator';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { Check, Plus, Pencil } from 'lucide-react';
import { type Label as LabelType } from '@/types';
import { Button } from '@/components/ui/button';
import { HexColorPicker } from 'react-colorful';
import { Bin } from '@/components/icons/icons';
import { useLabels } from '@/hooks/use-labels';
import { GMAIL_COLORS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { m } from '@/paraglide/messages';
import { useForm } from 'react-hook-form';
import { Command } from 'lucide-react';
import { COLORS } from './colors';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LabelsPage() {
  const { data: labels, isLoading, error, refetch } = useLabels();
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
      loading:  m['common.labels.deletingLabel'](),
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
    <div className="grid gap-6">
      <SettingsCard
        title={m['pages.settings.labels.title']()}
        description={m['pages.settings.labels.description']()}
        action={
          <LabelDialog
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
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
        <div className="space-y-6">
          <Separator />
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {isLoading && !error ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                </div>
              ) : error ? (
                <p className="text-muted-foreground py-4 text-center text-sm">{error.message}</p>
              ) : labels?.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                 {m['common.mail.noLabelsAvailable']()}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {labels?.map((label) => {
                    return (
                      <div
                        key={label.id}
                        className="hover:bg-muted/50 group relative flex items-center justify-between rounded-lg p-3 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Badge
                            className="px-2 py-1"
                            style={{
                              backgroundColor: label.color?.backgroundColor,
                              color: label.color?.textColor,
                            }}
                          >
                            <span>{label.name}</span>
                          </Badge>
                        </div>
                        <div className="dark:bg-panelDark absolute right-2 z-[25] flex items-center gap-1 rounded-xl border bg-white p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 [&_svg]:size-3.5"
                                onClick={() => handleEdit(label)}
                              >
                                <Pencil className="text-[#898989]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                            {m['common.labels.editLabel']()}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-3.5"
                                onClick={() => handleDelete(label.id!)}
                              >
                                <Bin className="fill-[#F43F5E]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                            {m['common.labels.deleteLabel']()}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SettingsCard>
    </div>
  );
}
