import { privateProcedure, router } from '../trpc';
import { LoggingService } from '../../lib/logging-service';
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
            const loggingService = new LoggingService(ctx.c.env);
            return loggingService.getSessionStats(sessionId);
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
            const loggingService = new LoggingService(ctx.c.env);
            loggingService.clearSession(sessionId);
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
            const loggingService = new LoggingService(ctx.c.env);
            return loggingService.getState(sessionId);
        }),
}); 
