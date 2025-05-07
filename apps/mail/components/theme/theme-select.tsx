import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import type { TThemeStyles } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
interface ThemeSelectProps {
  userThemes: {
    id: string;
    name: string;
  }[];
  currentTheme?: {
    id: string;
    styles: TThemeStyles;
  };
}

const defaultValue = 'default';

function ThemeSelect({ userThemes, currentTheme }: ThemeSelectProps) {
  const trpc = useTRPC();

  const router = useRouter();
  const { mutateAsync: setConnectionTheme } = useMutation(
    trpc.theme.setConnectionTheme.mutationOptions({
      onSuccess() {
        router.refresh();
      },
    }),
  );
  const { mutateAsync: resetConnectionTheme } = useMutation(
    trpc.theme.resetConnectionTheme.mutationOptions({
      onSuccess() {
        router.refresh();
      },
    }),
  );
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>(() => {
    if (currentTheme) {
      return currentTheme.id;
    }
    return defaultValue;
  });

  return (
    <Select
      value={selectedTheme}
      onValueChange={(value) => {
        if (value === defaultValue) {
          resetConnectionTheme();
        } else {
          setConnectionTheme({
            themeId: value,
          });
        }

        setSelectedTheme(value);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a theme" />
      </SelectTrigger>
      <SelectContent>
        {userThemes.map((theme) => (
          <SelectItem key={theme.id} value={theme.id}>
            {theme.name}
          </SelectItem>
        ))}
        <SelectItem value={defaultValue}>Default</SelectItem>
      </SelectContent>
    </Select>
  );
}

export { ThemeSelect };
