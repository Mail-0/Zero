'use client';

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
import { createLabel, updateLabel, deleteLabel } from '@/hooks/use-labels';
import { useLabels, type Label as LabelType } from '@/hooks/use-labels';
import { SettingsCard } from '@/components/settings/settings-card';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { GMAIL_COLORS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { COLORS } from './colors';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LabelsPage() {
  const t = useTranslations();
  const { labels, isLoading, error, mutate } = useLabels();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null);
  const form = useForm<LabelType>({
    defaultValues: {
      name: '',
      color: { backgroundColor: '#E2E2E2', textColor: '#000000' },
    },
  });

  const formColor = form.watch('color');

  const onSubmit = async (data: LabelType) => {
    try {
      toast.promise(editingLabel ? updateLabel(editingLabel.id!, data) : createLabel(data), {
        loading: 'Saving label...',
        success: 'Label saved successfully',
        error: 'Failed to save label',
      });
    } catch (error) {
      console.error('Error saving label:', error);
    } finally {
      await mutate();
      handleClose();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      toast.promise(deleteLabel(id), {
        loading: 'Deleting label...',
        success: 'Label deleted successfully',
        error: 'Failed to delete label',
      });
    } catch (error) {
      console.error('Error deleting label:', error);
    } finally {
      await mutate();
    }
  };

  const handleEdit = async (label: LabelType) => {
    setEditingLabel(label);
    form.reset({
      name: label.name,
      color: label.color,
    });
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingLabel(null);
    form.reset({
      name: '',
      color: { backgroundColor: '#E2E2E2', textColor: '#000000' },
    });
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.labels.title')}
        description={t('pages.settings.labels.description')}
        action={
          <Form {...form}>
            <form>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingLabel(null)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Label
                  </Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingLabel ? 'Edit Label' : 'Create New Label'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Label Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter label name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="grid grid-cols-6 gap-2">
                        {COLORS.map((color) => (
                          <button
                            type="button"
                            key={color}
                            onClick={() =>
                              form.setValue('color', {
                                backgroundColor: color,
                                textColor: '#ffffff',
                              })
                            }
                            style={{
                              height: '2rem',
                              backgroundColor: color,
                              color: '#ffffff',
                              borderRadius: '0.375rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              ...(formColor?.backgroundColor === color && {
                                outline: '2px solid var(--primary)',
                                outlineOffset: '2px',
                              }),
                            }}
                          >
                            {formColor?.backgroundColor === color && <Check className="h-4 w-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button onClick={form.handleSubmit(onSubmit)}>
                      {editingLabel ? 'Save Changes' : 'Create Label'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </form>
          </Form>
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
                <p className="text-muted-foreground py-4 text-center text-sm">{error}</p>
              ) : labels.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No labels created yet. Click the button above to create one.
                </p>
              ) : (
                labels.map((label) => {
                  return (
                    <div key={label.id} className="group flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge
                          className="px-2 py-1"
                          style={{
                            backgroundColor: label.color?.backgroundColor,
                          }}
                        >
                          <span className="dark:text-whitemix-blend-difference text-black">
                            {label.name}
                          </span>
                        </Badge>
                      </div>
                      <div className="space-x-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(label)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(label.id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SettingsCard>
    </div>
  );
}
