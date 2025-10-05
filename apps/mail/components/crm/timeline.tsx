import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mail, Calendar, Phone, MessageSquare, FileText, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export type HistoryEventType =
  | 'inbound_email'
  | 'outbound_email'
  | 'meeting'
  | 'call'
  | 'note'
  | 'document'
  | 'other';

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  title: string;
  date: string;
  description?: string;
}

const getEventIcon = (type: HistoryEventType) => {
  switch (type) {
    case 'inbound_email':
      return <Mail className="h-3 w-3" />;
    case 'outbound_email':
      return <Mail className="h-3 w-3" />;
    case 'meeting':
      return <Users className="h-3 w-3" />;
    case 'call':
      return <Phone className="h-3 w-3" />;
    case 'note':
      return <MessageSquare className="h-3 w-3" />;
    case 'document':
      return <FileText className="h-3 w-3" />;
    default:
      return <Calendar className="h-3 w-3" />;
  }
};

const getEventColor = (type: HistoryEventType) => {
  switch (type) {
    case 'inbound_email':
      return 'bg-blue-500';
    case 'outbound_email':
      return 'bg-green-500';
    case 'meeting':
      return 'bg-purple-500';
    case 'call':
      return 'bg-orange-500';
    case 'note':
      return 'bg-yellow-500';
    case 'document':
      return 'bg-gray-500';
    default:
      return 'bg-gray-400';
  }
};

const formatEventType = (type: HistoryEventType) => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface TimelineProps {
  events: HistoryEvent[];
  onChange: (events: HistoryEvent[]) => void;
}

export function Timeline({ events, onChange }: TimelineProps) {
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<HistoryEvent>>({
    type: 'inbound_email',
    title: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const addEvent = () => {
    if (!newEvent.title) return;
    const event: HistoryEvent = {
      id: `event_${Date.now()}`,
      type: newEvent.type || 'other',
      title: newEvent.title,
      date: newEvent.date || new Date().toISOString().split('T')[0],
      description: newEvent.description || '',
    };
    onChange(
      [...events, event].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    );
    setNewEvent({
      type: 'inbound_email',
      title: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setIsAddingEvent(false);
  };

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (events.length === 0 && !isAddingEvent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Popover open={isAddingEvent} onOpenChange={setIsAddingEvent}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Plus className="mr-2 h-3 w-3" />
              Add event
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <h4 className="font-medium leading-none">Add History Event</h4>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        {getEventIcon(newEvent.type || 'other')}
                        {formatEventType(newEvent.type || 'other')}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full">
                    <DropdownMenuItem
                      onClick={() => setNewEvent({ ...newEvent, type: 'inbound_email' })}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Inbound Email
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setNewEvent({ ...newEvent, type: 'outbound_email' })}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Outbound Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewEvent({ ...newEvent, type: 'meeting' })}>
                      <Users className="mr-2 h-4 w-4" />
                      Meeting
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewEvent({ ...newEvent, type: 'call' })}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewEvent({ ...newEvent, type: 'note' })}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Note
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setNewEvent({ ...newEvent, type: 'document' })}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Event title"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Input
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event description"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAddingEvent(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={addEvent}>
                  Add
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="relative py-2">
      <div className="space-y-3">
        {sortedEvents.map((event, index) => (
          <div key={event.id} className="relative flex gap-3">
            {/* Timeline line */}
            {index < sortedEvents.length - 1 && (
              <div className="bg-border absolute left-[9px] top-6 h-[calc(100%+0.75rem)] w-px" />
            )}

            {/* Icon */}
            <div
              className={`${getEventColor(event.type)} relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white`}
            >
              {getEventIcon(event.type)}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium leading-none">{event.title}</p>
                  {event.description && (
                    <p className="text-muted-foreground mt-1 text-xs">{event.description}</p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {new Date(event.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Event Button */}
      <div className="mt-3">
        <Popover open={isAddingEvent} onOpenChange={setIsAddingEvent}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 w-full">
              <Plus className="mr-2 h-3 w-3" />
              Add event
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <h4 className="font-medium leading-none">Add History Event</h4>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        {getEventIcon(newEvent.type || 'other')}
                        {formatEventType(newEvent.type || 'other')}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full">
                    <DropdownMenuItem
                      onClick={() => setNewEvent({ ...newEvent, type: 'inbound_email' })}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Inbound Email
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setNewEvent({ ...newEvent, type: 'outbound_email' })}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Outbound Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewEvent({ ...newEvent, type: 'meeting' })}>
                      <Users className="mr-2 h-4 w-4" />
                      Meeting
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewEvent({ ...newEvent, type: 'call' })}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewEvent({ ...newEvent, type: 'note' })}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Note
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setNewEvent({ ...newEvent, type: 'document' })}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Event title"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Input
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event description"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAddingEvent(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={addEvent}>
                  Add
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
