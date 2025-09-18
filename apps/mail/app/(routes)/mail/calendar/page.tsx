import { Metadata } from 'next';
import { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useActiveConnection } from '@/hooks/use-connections';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EventDialog } from './EventDialog';
import type { EventFormValues } from './EventDialog';

export const metadata: Metadata = {
  title: 'Calendar - Zero',
  description: 'Manage your calendar and schedule',
};

export default function CalendarPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const trpc = useTRPC();
  const { data: activeConnection } = useActiveConnection();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery(
    trpc.calendar.getEvents.queryOptions(
      { connectionId: activeConnection?.id || '' },
      {
        enabled: !!activeConnection?.id,
      },
    ),
  );

  const { mutate: createEvent } = useMutation({
    ...trpc.calendar.createEvent.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.calendar.getEvents.queryKey() }),
  });

  const { mutate: updateEvent } = useMutation({
    ...trpc.calendar.updateEvent.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.calendar.getEvents.queryKey() }),
  });

  const { mutate: deleteEvent } = useMutation({
    ...trpc.calendar.deleteEvent.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.calendar.getEvents.queryKey() }),
  });

  const events = eventsQuery.data
    ?.map((event) => {
      const start = event.start?.dateTime || event.start?.date;
      if (!start || !event.id) return null;

      return {
        id: event.id,
        title: event.summary || 'No Title',
        start,
        end: event.end?.dateTime || event.end?.date,
        allDay: !!event.start?.date,
      };
    })
    .filter(Boolean) as any;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Manage your schedule and appointments
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Create Event</Button>
      </div>

      <div className="flex-1 p-6">
        {eventsQuery.isLoading && <p>Loading...</p>}
        {eventsQuery.isError && <p>Error loading events.</p>}
        {eventsQuery.isSuccess && (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            dateClick={(info) => {
              setSelectedEvent({ start: info.date, allDay: info.allDay });
              setDialogOpen(true);
            }}
            eventClick={(info) => {
              setSelectedEvent(info.event);
              setDialogOpen(true);
            }}
          />
        )}
      </div>
      <EventDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onSubmit={(values) => {
          if (!activeConnection?.id) return;

          const eventData = {
            summary: values.title,
            description: values.description,
            start: { [values.allDay ? 'date' : 'dateTime']: values.start },
            end: { [values.allDay ? 'date' : 'dateTime']: values.end },
          };

          if (selectedEvent?.id) {
            updateEvent({ 
              connectionId: activeConnection.id, 
              eventId: selectedEvent.id, 
              event: eventData 
            });
          } else {
            createEvent({ connectionId: activeConnection.id, event: eventData });
          }
          setDialogOpen(false);
          setSelectedEvent(null);
        }}
        onDelete={() => {
          if (activeConnection?.id && selectedEvent?.id) {
            deleteEvent({ connectionId: activeConnection.id, eventId: selectedEvent.id });
            setDialogOpen(false);
            setSelectedEvent(null);
          }
        }}
      />
    </div>
  );
}
