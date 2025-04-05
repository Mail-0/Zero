'use client';

import { useEffect, useState } from 'react';
import { EventCalendar } from '@/components/ui/event-calendar';
import { type CalendarEvent } from '@/components/ui/event-calendar';
import { getCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/actions/calendar';
import { toast } from 'sonner';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await getCalendarEvents();
      setEvents(data);
    } catch (error) {
      toast.error('Failed to load events');
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventAdd = async (event: CalendarEvent) => {
    try {
      const newEvent = await addCalendarEvent(event);
      setEvents([...events, newEvent]);
    } catch (error) {
      toast.error('Failed to add event');
      console.error('Error adding event:', error);
    }
  };

  const handleEventUpdate = async (event: CalendarEvent) => {
    try {
      const updatedEvent = await updateCalendarEvent(event);
      setEvents(events.map(e => e.id === event.id ? updatedEvent : e));
      toast.success('Event updated successfully');
    } catch (error) {
      toast.error('Failed to update event');
      console.error('Error updating event:', error);
    }
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      await deleteCalendarEvent(eventId);
      setEvents(events.filter(e => e.id !== eventId));
      toast.success('Event deleted successfully');
    } catch (error) {
      toast.error('Failed to delete event');
      console.error('Error deleting event:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

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