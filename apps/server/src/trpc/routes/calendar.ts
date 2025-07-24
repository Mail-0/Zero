import { activeConnectionProcedure, router } from '../trpc';
import { getZeroDB } from '../../lib/server-utils';
import { GoogleCalendarManager } from '../../lib/calendar/google-calendar';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const calendarRouter = router({
  nextEvent: activeConnectionProcedure
    .input(z.void())
    .query(async ({ ctx }) => {
      const { activeConnection, sessionUser } = ctx;
      if (activeConnection.providerId !== 'google') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Google connection required' });
      }

      if (!activeConnection.calendarEnabled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'CALENDAR_DISABLED' });
      }

      const db = await getZeroDB(sessionUser.id);
      const connection = await db.findUserConnection(activeConnection.id);
      if (!connection?.refreshToken || !connection.scope) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing refresh token or scope' });
      }

      const calendarManager = new GoogleCalendarManager({
        refreshToken: connection.refreshToken,
        scope: connection.scope,
      });
      const event = await calendarManager.getNextEvent();

      if (!event) return null;

      return {
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        link: event.htmlLink,
      } as const;
    }),
  upcoming: activeConnectionProcedure
    .input(z.object({ max: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { activeConnection, sessionUser } = ctx;
      if (activeConnection.providerId !== 'google') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Google connection required' });
      }

      if (!activeConnection.calendarEnabled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'CALENDAR_DISABLED' });
      }

      const db = await getZeroDB(sessionUser.id);
      const connection = await db.findUserConnection(activeConnection.id);
      if (!connection?.refreshToken) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing refresh token' });
      }

      const calendarManager = new GoogleCalendarManager({
        refreshToken: connection.refreshToken,
        scope: connection.scope,
      });
      let events;
      try {
        events = await calendarManager.listUpcomingEvents(input?.max ?? 5);
      } catch (err: unknown) {
        if ((err as { response?: { status?: number } }).response?.status === 403) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'INSUFFICIENT_CALENDAR_SCOPE' });
        }
        throw err;
      }

      return events.map((ev) => ({
        id: ev.id,
        summary: ev.summary,
        description: ev.description,
        start: ev.start?.dateTime || ev.start?.date,
        end: ev.end?.dateTime || ev.end?.date,
        location: ev.location,
        link: ev.htmlLink,
      }));
    }),
}); 