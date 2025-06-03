import { getSignedUrl } from './get-signed-url';
import { router } from '../../trpc';

export const voiceRouter = router({
  getSignedUrl,
});
