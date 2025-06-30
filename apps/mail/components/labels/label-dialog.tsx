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
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Command } from 'lucide-react';
import { m } from '@/paraglide/messages';

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
      <DialogContent showOverlay={true}>
        <DialogHeader>
          <DialogTitle>{editingLabel ? m['common.labels.editLabel']() : m['common.mail.createNewLabel']()}</DialogTitle>
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
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m['common.labels.labelName']()}</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter label name" {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>{m['common.labels.color']()}</Label>
                <div className="w-full">
                  <div className="flex flex-wrap gap-2">
                    {LABEL_COLORS.map((color, index) => (
                      <button
                        key={index}
                        type="button"
                        className={`h-10 w-10 rounded-[4px] border-[0.5px] border-white/10 transition-all ${
                          formColor?.backgroundColor.toString() === color.backgroundColor &&
                          formColor.textColor.toString() === color.textColor
                            ? 'scale-110 ring-2 ring-blue-500 ring-offset-1'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.backgroundColor }}
                        onClick={() =>
                          form.setValue('color', {
                            backgroundColor: color.backgroundColor,
                            textColor: color.textColor,
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button className="h-8" type="button" variant="outline" onClick={handleClose}>
                {m['common.actions.cancel']()}
              </Button>
              <Button className="h-8 [&_svg]:size-4" type="submit">
                {editingLabel ? m['common.actions.saveChanges']() : m['common.labels.createLabel']()}
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
