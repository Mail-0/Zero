import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { setConnectionThemeAction, removeConnectionThemeAction } from '@/actions/theme';
import { useAction } from 'next-safe-action/hooks';
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
  const router = useRouter();
  const action = useAction(setConnectionThemeAction);
  const removeAction = useAction(removeConnectionThemeAction);
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
          removeAction.execute({
            themeId: selectedTheme as string,
          });
        } else {
          action.execute({
            themeId: value,
          });
        }

        setSelectedTheme(value);
        router.refresh();
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
