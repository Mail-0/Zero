import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Define the type for our form values first
export type EventFormValues = {
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;
};

// Create a Zod schema that matches the type
const eventSchema: z.ZodType<EventFormValues> = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start: z.string().min(1, 'Start date is required'),
  end: z.string().min(1, 'End date is required'),
  allDay: z.boolean(),
});

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  onSubmit: (values: EventFormValues) => void;
  onDelete: () => void;
}

export function EventDialog({ isOpen, onClose, event, onSubmit, onDelete }: EventDialogProps) {
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      start: '',
      end: '',
      allDay: false,
    },
  });

  useEffect(() => {
    if (event) {
      reset({
        title: event.title || '',
        description: event.extendedProps?.description || '',
        start: event.startStr || new Date(event.start).toISOString().substring(0, 16),
        end: event.endStr || new Date(event.end).toISOString().substring(0, 16),
        allDay: event.allDay || false,
      });
    } else {
      reset();
    }
  }, [event, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event?.id ? 'Edit Event' : 'Create Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} />
          </div>
          <div>
            <Label htmlFor="start">Start</Label>
            <Input id="start" type="datetime-local" {...register('start')} />
            {errors.start && <p className="text-red-500 text-sm">{errors.start.message}</p>}
          </div>
          <div>
            <Label htmlFor="end">End</Label>
            <Input id="end" type="datetime-local" {...register('end')} />
            {errors.end && <p className="text-red-500 text-sm">{errors.end.message}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <Controller
              name="allDay"
              control={control}
              render={({ field }) => (
                <Checkbox id="allDay" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="allDay">All Day</Label>
          </div>
          <DialogFooter>
            {event?.id && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            )}
            <Button type="submit">{event?.id ? 'Save Changes' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
