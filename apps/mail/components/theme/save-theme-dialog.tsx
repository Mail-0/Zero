'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useAction } from 'next-safe-action/hooks';
import { saveThemeAction } from '@/actions/theme';
import { useFormContext } from 'react-hook-form';
import { TCreateThemeSchema } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Heart } from 'lucide-react';
import { Input } from '../ui/input';
import { toast } from 'sonner';
export function SaveThemeDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Heart />
          Save Theme
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Theme</DialogTitle>
          <DialogDescription>Save your theme to your account.</DialogDescription>
        </DialogHeader>

        <SaveThemeForm />
        <DialogFooter>
          <Button form="save-theme-form" type="submit">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveThemeForm() {
  const router = useRouter();
  const form = useFormContext<TCreateThemeSchema>();

  const action = useAction(saveThemeAction, {
    onSuccess: () => {
      toast.success('Theme saved successfully');
      router.push('/themes');
    },
    onError: () => {
      toast.error('Failed to save theme');
    },
  });

  const onSubmit = (data: TCreateThemeSchema) => {
    action.execute(data);
  };

  return (
    <form
      className="flex flex-col gap-4 py-4"
      onSubmit={form.handleSubmit(onSubmit)}
      id="save-theme-form"
    >
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="visibility"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Visibility</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="PRIVATE">Private</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </form>
  );
}
