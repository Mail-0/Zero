import { compose, generateEmailSubject } from './compose';
import { generateSearchQuery } from './search';
import { webSearch } from './webSearch';
import { personSearch, companySearch, smartSearch } from './personSearch';
import { router } from '../../trpc';

export const aiRouter = router({
  generateSearchQuery,
  compose,
  generateEmailSubject,
  webSearch,
  personSearch,
  companySearch,
  smartSearch,
});
