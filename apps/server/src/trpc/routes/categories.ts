import { defaultMailCategories } from '../../lib/schemas';
import { router, publicProcedure } from '../trpc';

export const categoriesRouter = router({
  defaults: publicProcedure.query(() => defaultMailCategories),
});
