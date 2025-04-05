'use server';

import { db } from '@zero/db';
import { calendarEvent } from '@zero/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string;
  location?: string;
};

async function getAuthenticatedUserId(): Promise<string> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized, please reconnect");
  }
  
  return session.user.id;
}

export async function getCalendarEvents() {
  const userId = await getAuthenticatedUserId();
  
  const events = await db
    .select()
    .from(calendarEvent)
    .where(eq(calendarEvent.userId, userId))
    .orderBy(calendarEvent.start);

  return events;
}

export async function addCalendarEvent(event: Omit<CalendarEvent, 'id'>) {
  const userId = await getAuthenticatedUserId();
  
  const [newEvent] = await db
    .insert(calendarEvent)
    .values({
      id: crypto.randomUUID(),
      userId,
      title: event.title,
      description: event.description,
      start: event.start,
      end: event.end,
      allDay: event.allDay || false,
      color: event.color,
      location: event.location,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath('/mail/calendar');
  return newEvent;
}

export async function updateCalendarEvent(event: CalendarEvent) {
  const userId = await getAuthenticatedUserId();
  
  const [updatedEvent] = await db
    .update(calendarEvent)
    .set({
      title: event.title,
      description: event.description,
      start: event.start,
      end: event.end,
      allDay: event.allDay || false,
      color: event.color,
      location: event.location,
      updatedAt: new Date(),
    })
    .where(eq(calendarEvent.id, event.id))
    .where(eq(calendarEvent.userId, userId))
    .returning();

  revalidatePath('/mail/calendar');
  return updatedEvent;
}

export async function deleteCalendarEvent(eventId: string) {
  const userId = await getAuthenticatedUserId();
  
  await db
    .delete(calendarEvent)
    .where(eq(calendarEvent.id, eventId))
    .where(eq(calendarEvent.userId, userId));

  revalidatePath('/mail/calendar');
} 