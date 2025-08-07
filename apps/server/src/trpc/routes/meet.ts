import { activeDriverProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { env } from '../../env';

type MeetResponse = {
  success: boolean;
  data: {
    created_at: string;
    id: string;
    is_large: boolean;
    live_stream_on_start: boolean;
    persist_chat: boolean;
    record_on_start: boolean;
    status: string;
    summarize_on_end: boolean;
    updated_at: string;
  };
};

export const meetRouter = router({
  create: activeDriverProcedure.mutation(async () => {
    const AuthHeader = env.MEET_AUTH_HEADER;
    const response = await fetch(env.MEET_API_URL + '/meetings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: AuthHeader,
      },
    });

    if (!response.ok) {
      console.error(await response.text());
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create meeting' });
    }

    const data = await response.json<MeetResponse>();
    return data;
  }),
});
