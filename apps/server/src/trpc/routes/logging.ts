import { privateProcedure, router } from '../trpc';
import { getLoggingDO } from '../../lib/server-utils';
import { TRPCError } from '@trpc/server';

export const loggingRouter = router({
    getSessionStats: privateProcedure
        .query(async ({ ctx }) => {
            if (!ctx.sessionUser) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                });
            }
            const sessionId = ctx.sessionUser.id;
            const loggingDO = await getLoggingDO(sessionId);
            return await loggingDO.getSessionStats();
        }),

    clearSession: privateProcedure
        .mutation(async ({ ctx }) => {
            if (!ctx.sessionUser) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                });
            }
            const sessionId = ctx.sessionUser.id;
            const loggingDO = await getLoggingDO(sessionId);
            await loggingDO.clearSession();
            return { success: true };
        }),

    getSessionState: privateProcedure
        .query(async ({ ctx }) => {
            if (!ctx.sessionUser) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                });
            }
            const sessionId = ctx.sessionUser.id;
            const loggingDO = await getLoggingDO(sessionId);
            return await loggingDO.getState();
        }),
}); 
