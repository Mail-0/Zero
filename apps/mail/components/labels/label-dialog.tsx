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
import { CurvedArrow } from '@/components/icons/icons';
import { LABEL_COLORS } from '@/lib/label-colors';
import type { Label as LabelType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { Command, Check } from 'lucide-react';
import { useTranslations } from 'use-intl';

interface LabelDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  editingLabel?: LabelType | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: LabelType) => Promise<void>;
}

export function LabelDialog({
  trigger,
  onSuccess,
  editingLabel,
  open,
  onOpenChange,
  onSubmit,
}: LabelDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : isOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setIsOpen;
  const t = useTranslations();
  const form = useForm<LabelType>({
    defaultValues: {
      name: '',
      color: {
        backgroundColor: '',
        textColor: '',
      },
    },
  });

  const formColor = form.watch('color');

  // Reset form when editingLabel changes or dialog opens
  useEffect(() => {
    if (dialogOpen) {
      if (editingLabel) {
        form.reset({
          name: editingLabel.name,
          color: editingLabel.color || { backgroundColor: '#E2E2E2', textColor: '#000000' },
        });
      } else {
        form.reset({
          name: '',
          color: { backgroundColor: '#E2E2E2', textColor: '#000000' },
        });
      }
    }
  }, [dialogOpen, editingLabel, form]);

  const handleSubmit = async (data: LabelType) => {
    await onSubmit(data);
    handleClose();
    onSuccess?.();
  };

  const handleClose = () => {
    setDialogOpen(false);
    form.reset({
      name: '',
      color: { backgroundColor: '#E2E2E2', textColor: '#000000' },
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent showOverlay={true} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingLabel ? t('common.labels.editLabel') : t('common.mail.createNewLabel')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="mt-4 space-y-6"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                form.handleSubmit(handleSubmit)();
              }
            }}
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t('common.labels.labelName')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('common.labels.enterLabelName')}
                        {...field} 
                        autoFocus
                        className="h-10" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel className="text-sm font-medium">{t('common.labels.color')}</FormLabel>
                
                <div className="flex items-center gap-4 mb-2">
                  <Badge
                    className="h-6 min-w-[24px] px-2"
                    style={{
                      backgroundColor: formColor?.backgroundColor,
                      color: formColor?.textColor,
                    }}
                  />
                  <span className="text-sm">
                    {form.watch('name') || t('common.labels.labelPreview')}
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {LABEL_COLORS.map((color, index) => (
                    <button
                      key={index}
                      type="button"
                      className={cn(
                        "relative h-10 rounded-md transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                        formColor?.backgroundColor === color.backgroundColor && 
                        formColor?.textColor === color.textColor && 
                        "ring-2 ring-primary"
                      )}
                      style={{ backgroundColor: color.backgroundColor }}
                      onClick={() =>
                        form.setValue('color', {
                          backgroundColor: color.backgroundColor,
                          textColor: color.textColor,
                        })
                      }
                    >
                      {formColor?.backgroundColor === color.backgroundColor && 
                       formColor?.textColor === color.textColor && (
                        <Check className="absolute inset-0 m-auto h-5 w-5" style={{ color: color.textColor }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="h-9"
              >
                {t('common.actions.cancel')}
              </Button>
              <Button 
                type="submit" 
                className="h-9"
              >
                <span className="mr-1">
                  {editingLabel ? t('common.actions.saveChanges') : t('common.labels.createLabel')}
                </span>
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
