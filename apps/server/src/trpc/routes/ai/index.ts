import { generateSearchQuery } from './search';
import { router } from '../../trpc';
import { compose } from './compose';

export const aiRouter = router({
  generateSearchQuery: generateSearchQuery,
  compose: compose,
});
