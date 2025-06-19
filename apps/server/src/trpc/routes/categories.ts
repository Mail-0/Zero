import { router, publicProcedure } from '../trpc';
import { defaultMailCategories } from '../../lib/schemas';

export const categoriesRouter = router({
  defaults: publicProcedure.query(() => defaultMailCategories),
}); 