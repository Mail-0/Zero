import { calendar as googleCalendar, auth, calendar_v3 } from '@googleapis/calendar';
import { APIError } from 'better-auth/api';

export const createGoogleCalendarClient = (accessToken: string, refreshToken: string) => {
  const authClient = new auth.OAuth2();
  authClient.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const calendar = googleCalendar({
    version: 'v3',
    auth: authClient,
  });

  return {
    async listEvents(calendarId: string = 'primary') {
      try {
        const response = await calendar.events.list({
          calendarId,
          timeMin: new Date().toISOString(),
          maxResults: 10,
          singleEvents: true,
          orderBy: 'startTime',
        });

        return response.data.items;
      } catch (error) {
        console.error('Failed to fetch calendar events:', error);
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'Failed to fetch calendar events',
        });
      }
    },

    async createEvent(event: calendar_v3.Schema$Event, calendarId: string = 'primary') {
      try {
        const response = await calendar.events.insert({
          calendarId,
          requestBody: event,
        });
        return response.data;
      } catch (error) {
        console.error('Failed to create calendar event:', error);
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'Failed to create calendar event',
        });
      }
    },

    async updateEvent(eventId: string, event: calendar_v3.Schema$Event, calendarId: string = 'primary') {
      try {
        const response = await calendar.events.update({
          calendarId,
          eventId,
          requestBody: event,
        });
        return response.data;
      } catch (error) {
        console.error('Failed to update calendar event:', error);
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'Failed to update calendar event',
        });
      }
    },

    async deleteEvent(eventId: string, calendarId: string = 'primary') {
      try {
        await calendar.events.delete({
          calendarId,
          eventId,
        });
        return { success: true };
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'Failed to delete calendar event',
        });
      }
    },
  };
};
