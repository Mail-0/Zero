'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { defaultThemes } from './default-themes';
import { ThemeStylesSchema } from '@/lib/theme';
import { useForm } from 'react-hook-form';
import { Form } from '../ui/form';
import { z } from 'zod';

export function CreateThemeFormProvider({ children }: { children: React.ReactNode }) {
  const form = useForm<z.infer<typeof ThemeStylesSchema>>({
    resolver: zodResolver(ThemeStylesSchema),
    defaultValues: {
      ...defaultThemes,
    },
  });

  return <Form {...form}>{children}</Form>;
}
