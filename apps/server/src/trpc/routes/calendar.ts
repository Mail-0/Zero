import { privateProcedure, router } from '../trpc';
import { createGoogleCalendarClient } from '../../lib/google-calendar';
import { getZeroDB } from '../../lib/server-utils';
import { z } from 'zod';
import { calendar_v3 } from '@googleapis/calendar';

export const calendarRouter = router({
  getEvents: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getZeroDB(ctx.sessionUser.id);
      const connection = await db.findUserConnection(input.connectionId);

      if (!connection || !connection.accessToken || !connection.refreshToken) {
        throw new Error('Connection not found or is missing tokens');
      }

      const calendarClient = createGoogleCalendarClient(
        connection.accessToken,
        connection.refreshToken,
      );

      return await calendarClient.listEvents();
    }),

  createEvent: privateProcedure
    .input(
      z.object({
        connectionId: z.string(),
        event: z.any(), // Using z.any() for simplicity, but you can define a more specific schema
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getZeroDB(ctx.sessionUser.id);
      const connection = await db.findUserConnection(input.connectionId);

      if (!connection || !connection.accessToken || !connection.refreshToken) {
        throw new Error('Connection not found or is missing tokens');
      }

      const calendarClient = createGoogleCalendarClient(
        connection.accessToken,
        connection.refreshToken,
      );

      return await calendarClient.createEvent(input.event as calendar_v3.Schema$Event);
    }),

  updateEvent: privateProcedure
    .input(
      z.object({
        connectionId: z.string(),
        eventId: z.string(),
        event: z.any(), // Using z.any() for simplicity
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getZeroDB(ctx.sessionUser.id);
      const connection = await db.findUserConnection(input.connectionId);

      if (!connection || !connection.accessToken || !connection.refreshToken) {
        throw new Error('Connection not found or is missing tokens');
      }

      const calendarClient = createGoogleCalendarClient(
        connection.accessToken,
        connection.refreshToken,
      );

      return await calendarClient.updateEvent(input.eventId, input.event as calendar_v3.Schema$Event);
    }),

  deleteEvent: privateProcedure
    .input(
      z.object({
        connectionId: z.string(),
        eventId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getZeroDB(ctx.sessionUser.id);
      const connection = await db.findUserConnection(input.connectionId);

      if (!connection || !connection.accessToken || !connection.refreshToken) {
        throw new Error('Connection not found or is missing tokens');
      }

      const calendarClient = createGoogleCalendarClient(
        connection.accessToken,
        connection.refreshToken,
      );

      return await calendarClient.deleteEvent(input.eventId);
    }),
});
