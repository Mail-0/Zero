import { compose, generateEmailSubject } from './compose';
import { generateSearchQuery } from './search';
import { router } from '../../trpc';

export const aiRouter = router({
  generateSearchQuery: generateSearchQuery,
  compose: compose,
  generateEmailSubject: generateEmailSubject,
});
