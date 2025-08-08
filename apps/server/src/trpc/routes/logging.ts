import { privateProcedure, router } from '../trpc';
import { getLoggingDO } from '../../lib/server-utils';
import { z } from 'zod';

export const loggingRouter = router({
    getSessionStats: privateProcedure
        .query(async ({ ctx }) => {
            const sessionId = ctx.sessionUser?.id || 'anonymous';
            const loggingDO = await getLoggingDO(sessionId);
            return await loggingDO.getSessionStats();
        }),

    getCallHistory: privateProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(1000).default(100),
            })
        )
        .query(async ({ ctx, input }) => {
            const sessionId = ctx.sessionUser?.id || 'anonymous';
            const loggingDO = await getLoggingDO(sessionId);
            return await loggingDO.getCallHistory(input.limit);
        }),

    clearSession: privateProcedure
        .mutation(async ({ ctx }) => {
            const sessionId = ctx.sessionUser?.id || 'anonymous';
            const loggingDO = await getLoggingDO(sessionId);
            await loggingDO.clearSession();
            return { success: true };
        }),

    getSessionState: privateProcedure
        .query(async ({ ctx }) => {
            const sessionId = ctx.sessionUser?.id || 'anonymous';
            const loggingDO = await getLoggingDO(sessionId);
            return await loggingDO.getState();
        }),

    exportToDatadog: privateProcedure
        .mutation(async ({ ctx }) => {
            const sessionId = ctx.sessionUser?.id || 'anonymous';
            const loggingDO = await getLoggingDO(sessionId);
            await loggingDO.exportCurrentSessionToDatadog();
            return { success: true };
        }),

    endSession: privateProcedure
        .mutation(async ({ ctx }) => {
            const sessionId = ctx.sessionUser?.id || 'anonymous';
            const loggingDO = await getLoggingDO(sessionId);
            await loggingDO.endSession();
            return { success: true };
        }),
}); 