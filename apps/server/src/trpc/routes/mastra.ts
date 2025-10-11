import { checkMastraHealth } from '../../lib/mastra';
import { publicProcedure, router } from '../trpc';

export const mastraRouter = router({
  // Health check
  health: publicProcedure.query(async () => {
    return checkMastraHealth();
  }),
});
