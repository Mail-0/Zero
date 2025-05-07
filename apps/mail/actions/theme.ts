'use server';

import { authActionClient } from '@/lib/safe-action';
import { CreateThemeSchema } from '@/lib/theme';
import { TThemeStyles } from '@/lib/theme';
import { theme } from '@zero/db/schema';
import { db } from '@zero/db';
interface SaveThemeProps {
  name: string;
  styles: TThemeStyles;
  visibility: 'PUBLIC' | 'PRIVATE';
}

export const saveThemeAction = authActionClient
  .schema(CreateThemeSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { session } = ctx;
    const { name, visibility, light, dark } = parsedInput;

    const userId = session.user.id;

    const theme_ = await db
      .insert(theme)
      .values({
        id: crypto.randomUUID(),
        name,
        styles: {
          light,
          dark,
        },
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isFeatured: false,
        visibility,
      })
      .returning({
        id: theme.id,
        name: theme.name,
        styles: theme.styles,
        visibility: theme.visibility,
        userId: theme.userId,
      });

    if (!theme_[0]) {
      throw new Error('Failed to create theme');
    }

    return {
      id: theme_[0].id,
      name: theme_[0].name,
      styles: theme_[0].styles,
      visibility: theme_[0].visibility,
      userId: theme_[0].userId,
    };
  });
