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
import { Check, Plus, Pencil } from 'lucide-react';
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
import { HexColorPicker } from 'react-colorful';
import { Command } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Bin } from '@/components/icons/icons';
import { CurvedArrow } from '@/components/icons/icons';

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
                <div className="container max-w-[750px] mx-auto">
                <DialogContent showOverlay={true} className="bg-panelLight dark:bg-panelDark w-full p-4 max-w-[500px] rounded-xl">
                  
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
                      <div className="space-y-4">
                        <Label>Color</Label>
                        <div className="w-full">
                          <div className="grid grid-cols-7 gap-4">
                            {[
                              // Row 1 - Grayscale
                              '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff',
                              // Row 2 - Warm colors
                              '#fb4c2f', '#ffad47', '#fad165', '#ff7537', '#cc3a21', '#8a1c0a',
                              // Row 3 - Cool colors
                              '#16a766', '#43d692', '#4a86e8', '#285bac', '#3c78d8', '#0d3472',
                              // Row 4 - Purple tones
                              '#a479e2', '#b99aff', '#653e9b', '#3d188e', '#f691b3', '#994a64',
                              // Row 5 - Pastels
                              '#f6c5be', '#ffe6c7', '#c6f3de', '#c9daf8'
                            ].map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`h-10 w-10 rounded-[4px] border-[0.5px] border-white/10 ${
                                  formColor?.backgroundColor === color ? 'ring-2 ring-blue-500' : ''
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => form.setValue('color', {
                                  backgroundColor: color,
                                  textColor: '#ffffff'
                                })}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        className="h-8"
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                      >
                        Cancel
                      </Button>
                      <Button className="h-8 [&_svg]:size-4" onClick={form.handleSubmit(onSubmit)}>
                        {editingLabel ? 'Save Changes' : 'Create Label'}
                        <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10 ">
                          <Command className="h-3 w-3 text-white dark:text-[#929292]" />
                          <CurvedArrow className="mt-1.5 h-3.5 w-3.5 fill-white dark:fill-[#929292]" />
                        </div>
                      </Button>
                      
                    </div>
                 
                </DialogContent>
                </div>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
                  {labels.map((label) => {
                    return (
                      <div key={label.id} className="group relative flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <Badge
                            className="px-2 py-1"
                            style={{
                              backgroundColor: label.color?.backgroundColor,
                            }}
                          >
                            <span className="dark:text-whitemix-blend-difference darK:text-black">
                              {label.name}
                            </span>
                          </Badge>
                        </div>
                        <div className="absolute right-2 z-[25] flex items-center gap-1 rounded-xl border bg-white p-1 shadow-sm dark:bg-[#1A1A1A] opacity-0 group-hover:opacity-100 transition-opacity">
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
                            <TooltipContent className="mb-1 bg-white dark:bg-[#1A1A1A]">
                              Edit Label
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
                            <TooltipContent className="mb-1 bg-white dark:bg-[#1A1A1A]">
                              Delete Label
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
