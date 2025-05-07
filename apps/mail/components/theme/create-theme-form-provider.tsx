'use client';

import { CreateThemeSchema, type TCreateThemeSchema } from '@/lib/theme';
import { zodResolver } from '@hookform/resolvers/zod';
import { defaultThemes } from './default-themes';
import { useForm } from 'react-hook-form';
import { Form } from '../ui/form';
import { z } from 'zod';

export function CreateThemeFormProvider({ children }: { children: React.ReactNode }) {
  const form = useForm<TCreateThemeSchema>({
    resolver: zodResolver(CreateThemeSchema),
    defaultValues: {
      ...defaultThemes,
      name: '',
      visibility: 'PRIVATE',
    },
  });

  return <Form {...form}>{children}</Form>;
}
