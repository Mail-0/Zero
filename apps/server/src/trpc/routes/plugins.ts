import { publicProcedure, router } from '../trpc';
import fs from 'fs/promises';
import path from 'path';

export const pluginsRouter = router({
  list: publicProcedure.query(async () => {
    try {
      // Note: This path is relative to the server's execution directory.
      const pluginsDir = path.resolve(process.cwd(), '../mail/plugins');
      const files = await fs.readdir(pluginsDir);
      const plugins = files.filter(
        (file) => file.endsWith('.ts') || file.endsWith('.tsx'),
      );
      return { plugins };
    } catch (error) {
      console.error('Failed to list plugins:', error);
      // It's better to throw a TRPCError so the client can handle it.
      throw new Error('Failed to list plugins');
    }
  }),
});
