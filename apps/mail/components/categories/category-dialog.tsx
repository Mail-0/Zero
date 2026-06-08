import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { CurvedArrow } from '@/components/icons/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';
import { Command } from 'lucide-react';

export type CategoryFormValues = {
  categoryName: string;
  promptHint: string;
};

export type EditableCategory = {
  categoryId: string;
  categoryName: string;
  promptHint: string;
};

interface CategoryDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  editingCategory?: EditableCategory | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: CategoryFormValues) => Promise<void>;
}

export function CategoryDialog({
  trigger,
  onSuccess,
  editingCategory,
  open,
  onOpenChange,
  onSubmit,
}: CategoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : isOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setIsOpen;

  const form = useForm<CategoryFormValues>({
    defaultValues: {
      categoryName: '',
      promptHint: '',
    },
  });

  useEffect(() => {
    if (dialogOpen) {
      if (editingCategory) {
        form.reset({
          categoryName: editingCategory.categoryName,
          promptHint: editingCategory.promptHint,
        });
      } else {
        form.reset({
          categoryName: '',
          promptHint: '',
        });
      }
    }
  }, [dialogOpen, editingCategory, form]);

  const handleSubmit = async (data: CategoryFormValues) => {
    await onSubmit(data);
    handleClose();
    onSuccess?.();
  };

  const handleClose = () => {
    setDialogOpen(false);
    form.reset({
      categoryName: '',
      promptHint: '',
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent showOverlay={true}>
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? m['common.labels.editLabel']() : 'Add category'}
          </DialogTitle>
          <DialogDescription>
            {editingCategory
              ? 'Modify the category name and prompt hint.'
              : 'Create a new category for email classification.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="mt-4 space-y-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                form.handleSubmit(handleSubmit)();
              }
            }}
          >
            <FormField
              control={form.control}
              name="categoryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m['common.labels.labelName']()}</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter category name" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="promptHint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt hint</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe when emails should use this category"
                      className="min-h-[100px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button className="h-8" type="button" variant="outline" onClick={handleClose}>
                {m['common.actions.cancel']()}
              </Button>
              <Button className="h-8 [&_svg]:size-4" type="submit">
                {editingCategory
                  ? m['common.actions.saveChanges']()
                  : m['common.labels.createLabel']()}
                <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                  <Command className="h-3 w-3 text-white dark:text-[#929292]" />
                  <CurvedArrow className="mt-1.5 h-3.5 w-3.5 fill-white dark:fill-[#929292]" />
                </div>
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
