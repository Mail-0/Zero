import { publicProcedure, router } from '../trpc';
import { checkMastraHealth } from '../../mastra';

export const mastraRouter = router({
  // Health check
  health: publicProcedure.query(async () => {
    return checkMastraHealth();
  }),
});
