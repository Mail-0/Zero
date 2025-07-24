import { OAuth2Client } from 'google-auth-library';
import { calendar, type calendar_v3 } from '@googleapis/calendar';
import { env } from 'cloudflare:workers';

export interface GoogleCalendarManagerOptions {
  refreshToken: string;
  scope: string;
}

export class GoogleCalendarManager {
  private auth: OAuth2Client;
  private cal: calendar_v3.Calendar;

  constructor(private options: GoogleCalendarManagerOptions) {
    this.auth = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);

    this.auth.setCredentials({
      refresh_token: options.refreshToken,
      scope: options.scope,
    });


    this.cal = calendar({ version: 'v3', auth: this.auth as unknown as any });
  }

  public getScope(): string {
    return 'https://www.googleapis.com/auth/calendar';
  }

  public async createEvent(params: {
    summary: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    timeZone?: string;
    attendees?: { email: string }[];
  }) {
    const {
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone = 'UTC',
      attendees = [],
    } = params;

    const response = await this.cal.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        attendees,
      },
    });

    return response.data;
  }

  public async getNextEvent() {
    try {
      const events = await this.listUpcomingEvents(1);
      const event = events[0] || null;
      return event;
    } catch (error: any) {
      console.error('Error getting next event:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  public async listUpcomingEvents(maxResults = 5) {
    try {
      const accessToken = await this.auth.getAccessToken();

      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('timeMin', new Date().toISOString());
      url.searchParams.set('maxResults', maxResults.toString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('key', env.GOOGLE_API_KEY);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Calendar API error response:', errorText);
        throw new Error(`Calendar API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json<{ items?: any[] }>();
      return data.items ?? [];
    } catch (error: any) {
      console.error('Error listing upcoming events:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        errors: error.response?.data?.error?.errors,
      });
      throw error;
    }
  }
} 