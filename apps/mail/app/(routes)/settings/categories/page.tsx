import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingsCard } from '@/components/settings/settings-card';
import { LabelDialog } from '@/components/labels/label-dialog';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { useLabels } from '@/hooks/use-labels';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { type Label as LabelType } from '@/types';
import { Plus, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { m } from '@/paraglide/messages';
import { toast } from 'sonner';

export default function CategoriesSettingsPage() {
  const trpc = useTRPC();
  const { userLabels, isLoading, error, refetch } = useLabels();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null);

  const { mutateAsync: createLabel } = useMutation(trpc.labels.create.mutationOptions());
  const { mutateAsync: updateLabel } = useMutation(trpc.labels.update.mutationOptions());

  const labelFilters = useMemo(() => {
    return userLabels.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [userLabels]);

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
    await refetch();
  };

  const handleEdit = (label: LabelType) => {
    setEditingLabel(label);
    setIsDialogOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingLabel(null);
    setIsDialogOpen(true);
  };

  return (
    <SettingsCard
      title={m['navigation.settings.categories']()}
      description={m['pages.settings.categories.description']()}
      action={
        <LabelDialog
          trigger={
            <Button onClick={handleOpenAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add label filter
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
      <div className="space-y-3">
        <Label>Label filters</Label>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading label filters...</p>
        ) : error ? (
          <p className="text-muted-foreground text-sm">{error.message}</p>
        ) : labelFilters.length === 0 ? (
          <p className="text-muted-foreground text-sm">No label filters found.</p>
        ) : (
          <div className="border-border divide-border max-h-[420px] divide-y overflow-y-auto rounded-lg border">
            {labelFilters.map((labelFilter) => (
              <div
                key={labelFilter.id}
                className="hover:bg-muted/40 flex items-center justify-between gap-4 px-4 py-3 transition-colors"
              >
                <Badge
                  className="px-2 py-1 font-normal"
                  style={{
                    backgroundColor:
                      labelFilter.color?.backgroundColor || 'hsl(var(--secondary))',
                    color: labelFilter.color?.textColor || 'hsl(var(--secondary-foreground))',
                  }}
                >
                  {labelFilter.name}
                </Badge>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleEdit(labelFilter)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{m['common.labels.editLabel']()}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
