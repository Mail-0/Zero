'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ThemeStylesSchema } from '@/lib/theme';
import { useForm } from 'react-hook-form';
import { Form } from '../ui/form';
import { z } from 'zod';

export function CreateThemeFormProvider({ children }: { children: React.ReactNode }) {
  const form = useForm<z.infer<typeof ThemeStylesSchema>>({
    resolver: zodResolver(ThemeStylesSchema),
    defaultValues: {
      dark: {
        background: '#000000',
        foreground: '#ffffff',
        card: '#111111',
        'card-foreground': '#ffffff',
        primary: '#000000',
        'primary-foreground': '#ffffff',
      },
      light: {
        background: '#ffffff',
        foreground: '#000000',
        card: '#f1f1f1',
        'card-foreground': '#000000',
        primary: '#000000',
        'primary-foreground': '#ffffff',
        muted: '#000000',
        'muted-foreground': '#ffffff',
        'secondary-foreground': '#000000',
        secondary: '#f1f1f1',
        radius: '0.5em',
      },
    },
  });

  return <Form {...form}>{children}</Form>;
}
