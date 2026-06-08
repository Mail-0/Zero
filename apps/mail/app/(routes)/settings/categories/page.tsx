import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingsCard } from '@/components/settings/settings-card';
import {
  CategoryDialog,
  type CategoryFormValues,
  type EditableCategory,
} from '@/components/categories/category-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Bin } from '@/components/icons/icons';
import { Plus, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { m } from '@/paraglide/messages';
import { toast } from 'sonner';

export default function CategoriesSettingsPage() {
  const trpc = useTRPC();
  const categoriesQuery = useQuery(
    trpc.categories.list.queryOptions(undefined, {
      staleTime: 60 * 1000,
    }),
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EditableCategory | null>(null);

  const { mutateAsync: createCategory } = useMutation(trpc.categories.create.mutationOptions());
  const { mutateAsync: updateCategory } = useMutation(trpc.categories.update.mutationOptions());
  const { mutateAsync: deleteCategory } = useMutation(trpc.categories.delete.mutationOptions());

  const categories = useMemo(() => {
    return (categoriesQuery.data ?? [])
      .slice()
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [categoriesQuery.data]);

  const refetch = async () => {
    await categoriesQuery.refetch();
  };

  const handleSubmit = async (data: CategoryFormValues) => {
    await toast.promise(
      editingCategory
        ? updateCategory({
            categoryId: editingCategory.categoryId,
            categoryName: data.categoryName,
            promptHint: data.promptHint,
          })
        : createCategory({
            categoryName: data.categoryName,
            promptHint: data.promptHint,
          }),
      {
        loading: m['common.labels.savingLabel'](),
        success: m['common.labels.saveLabelSuccess'](),
        error: m['common.labels.failedToSavingLabel'](),
      },
    );
    await refetch();
  };

  const handleDelete = async (categoryId: string) => {
    await toast.promise(deleteCategory({ categoryId }), {
      loading: m['common.labels.deletingLabel'](),
      success: m['common.labels.deleteLabelSuccess'](),
      error: m['common.labels.failedToDeleteLabel'](),
    });
    await refetch();
  };

  const handleEdit = (category: EditableCategory) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const handleGenerateCategories = () => {
    // TODO_doorman: need to implement
    alert('Generate categories is not implemented yet');
  };

  return (
    <SettingsCard
      title={m['navigation.settings.categories']()}
      description={m['pages.settings.categories.description']()}
      footer={
        <div className="flex justify-end">
          <Button type="button" onClick={handleGenerateCategories}>
            Generate categories
          </Button>
        </div>
      }
      action={
        <CategoryDialog
          trigger={
            <Button onClick={handleOpenAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add label filter
            </Button>
          }
          editingCategory={editingCategory}
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingCategory(null);
          }}
          onSubmit={handleSubmit}
          onSuccess={refetch}
        />
      }
    >
      <div className="space-y-3">
        <Label>Label filters</Label>
        {categoriesQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading label filters...</p>
        ) : categoriesQuery.error ? (
          <p className="text-muted-foreground text-sm">{categoriesQuery.error.message}</p>
        ) : categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">No label filters found.</p>
        ) : (
          <div className="border-border divide-border max-h-[420px] divide-y overflow-y-auto rounded-lg border">
            {categories.map((categoryItem) => (
              <div
                key={categoryItem.categoryId}
                className="hover:bg-muted/40 flex items-center justify-between gap-4 px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Badge className="bg-muted text-foreground px-2 py-1 font-normal">
                    {categoryItem.categoryName}
                  </Badge>
                  {categoryItem.promptHint ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {categoryItem.promptHint}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(categoryItem)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{m['common.labels.editLabel']()}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23]"
                        onClick={() => handleDelete(categoryItem.categoryId)}
                      >
                        <Bin className="fill-[#F43F5E]" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{m['common.labels.deleteLabel']()}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
