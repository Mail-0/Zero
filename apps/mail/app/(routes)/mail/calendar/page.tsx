"use client"

import { useEffect, useState, Suspense } from 'react';
import { EventCalendar } from '@/components/event-calendar/event-calendar';
import type { CalendarEvent } from '@/components/event-calendar/types';
import { getCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/actions/calendar';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';

// Separate loading component
function LoadingCalendar() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-muted-foreground">Loading calendar...</div>
    </div>
  );
}

// Main calendar content component
function CalendarContent({ session }: { session: any }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (session?.user?.id) {
      loadEvents();
    }
  }, [session?.user?.id]); // More specific dependency

  const loadEvents = async () => {
    try {
      const data = await getCalendarEvents();
      setEvents(data.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description || undefined,
        start: event.start,
        end: event.end,
        allDay: event.allDay || false,
        color: event.color as CalendarEvent['color'],
        location: event.location || undefined,
      })));
    } catch (error) {
      toast.error('Failed to load events');
      console.error('Error loading events:', error);
    }
  };

  const handleEventAdd = async (event: CalendarEvent) => {
    try {
      const newEvent = await addCalendarEvent(event);
      if (newEvent) {
        setEvents([...events, {
          id: newEvent.id,
          title: newEvent.title,
          description: newEvent.description || undefined,
          start: newEvent.start,
          end: newEvent.end,
          allDay: newEvent.allDay || false,
          color: newEvent.color as CalendarEvent['color'],
          location: newEvent.location || undefined,
        }]);
      }
    } catch (error) {
      toast.error('Failed to add event');
      console.error('Error adding event:', error);
    }
  };

  const handleEventUpdate = async (event: CalendarEvent) => {
    try {
      const updatedEvent = await updateCalendarEvent(event);
      if (updatedEvent) {
        setEvents(events.map(e => e.id === event.id ? {
          id: updatedEvent.id,
          title: updatedEvent.title,
          description: updatedEvent.description || undefined,
          start: updatedEvent.start,
          end: updatedEvent.end,
          allDay: updatedEvent.allDay || false,
          color: updatedEvent.color as CalendarEvent['color'],
          location: updatedEvent.location || undefined,
        } : e));
        toast.success('Event updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update event');
      console.error('Error updating event:', error);
    }
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      await deleteCalendarEvent(eventId);
      setEvents(events.filter(e => e.id !== eventId));
    } catch (error) {
      toast.error('Failed to delete event');
      console.error('Error deleting event:', error);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <EventCalendar
        events={events}
        onEventAdd={handleEventAdd}
        onEventUpdate={handleEventUpdate}
        onEventDelete={handleEventDelete}
      />
    </div>
  );
}

export default function CalendarPage() {
  const { data: session } = useSession();

  if (!session?.user?.id) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground">Please sign in to view your calendar</div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingCalendar />}>
      <CalendarContent session={session} />
    </Suspense>
  );
}
