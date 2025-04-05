"use client"

import { useState } from "react"
import { addDays, setHours, setMinutes } from "date-fns"

import {
  EventCalendar,
  type CalendarEvent,
} from "@/components/event-calendar"

// Sample events data with hardcoded times
const sampleEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Annual Planning",
    description: "Strategic planning for next year",
    start: subDays(new Date(), 24), // 24 days before today
    end: subDays(new Date(), 23), // 23 days before today
    allDay: true,
    color: "sky",
    location: "Main Conference Hall",
  },
  {
    id: "2",
    title: "Project Deadline",
    description: "Submit final deliverables",
    start: setMinutes(setHours(subDays(new Date(), 9), 13), 0), // 1:00 PM, 9 days before
    end: setMinutes(setHours(subDays(new Date(), 9), 15), 30), // 3:30 PM, 9 days before
    color: "amber",
    location: "Office",
  },
  {
    id: "3",
    title: "Quarterly Budget Review",
    description: "Strategic planning for next year",
    start: subDays(new Date(), 13), // 13 days before today
    end: subDays(new Date(), 13), // 13 days before today
    allDay: true,
    color: "orange",
    location: "Main Conference Hall",
  },  
  {
    id: "4",
    title: "Team Meeting",
    description: "Weekly team sync",
    start: setMinutes(setHours(new Date(), 10), 0), // 10:00 AM today
    end: setMinutes(setHours(new Date(), 11), 0), // 11:00 AM today
    color: "sky",
    location: "Conference Room A",
  },
  {
    id: "5",
    title: "Lunch with Client",
    description: "Discuss new project requirements",
    start: setMinutes(setHours(addDays(new Date(), 1), 12), 0), // 12:00 PM tomorrow
    end: setMinutes(setHours(addDays(new Date(), 1), 13), 15), // 1:15 PM tomorrow
    color: "emerald",
    location: "Downtown Cafe",
  },
  {
    id: "6",
    title: "Product Launch",
    description: "New product release",
    start: addDays(new Date(), 3),
    end: addDays(new Date(), 6),
    allDay: true,
    color: "violet",
  },
  {
    id: "7",
    title: "Sales Conference",
    description: "Discuss about new clients",
    start: setMinutes(setHours(addDays(new Date(), 4), 14), 30), // 2:30 PM
    end: setMinutes(setHours(addDays(new Date(), 5), 14), 45), // 2:45 PM
    color: "rose",
    location: "Downtown Cafe",
  },
  {
    id: "8",
    title: "Team Meeting",
    description: "Weekly team sync",
    start: setMinutes(setHours(addDays(new Date(), 5), 9), 0), // 9:00 AM
    end: setMinutes(setHours(addDays(new Date(), 5), 10), 30), // 10:30 AM
    color: "orange",
    location: "Conference Room A",
  },
  {
    id: "9",
    title: "Review contracts",
    description: "Weekly team sync",
    start: setMinutes(setHours(addDays(new Date(), 5), 14), 0), // 2:00 PM
    end: setMinutes(setHours(addDays(new Date(), 5), 15), 30), // 3:30 PM
    color: "sky",
    location: "Conference Room A",
  },
  {
    id: "10",
    title: "Team Meeting",
    description: "Weekly team sync",
    start: setMinutes(setHours(addDays(new Date(), 5), 9), 45), // 9:45 AM
    end: setMinutes(setHours(addDays(new Date(), 5), 11), 0), // 11:00 AM
    color: "amber",
    location: "Conference Room A",
  },
  {
    id: "11",
    title: "Marketing Strategy Session",
    description: "Quarterly marketing planning",
    start: new Date(2025, 3, 5, 10, 0), // April 5, 2025, 10:00 AM
    end: new Date(2025, 3, 5, 15, 30), // April 5, 2025, 3:30 PM
    color: "emerald",
    location: "Marketing Department",
  },
  {
    id: "12",
    title: "Annual Shareholders Meeting",
    description: "Presentation of yearly results",
    start: new Date(2025, 3, 13), // April 13, 2025
    end: new Date(2025, 3, 13),
    allDay: true,
    color: "sky",
    location: "Grand Conference Center",
  },
  {
    id: "13",
    title: "Product Development Workshop",
    description: "Brainstorming for new features",
    start: new Date(2025, 3, 22, 9, 0), // April 22, 2025, 9:00 AM
    end: new Date(2025, 3, 23, 17, 0), // April 23, 2025, 5:00 PM
    color: "rose",
    location: "Innovation Lab",
  },
]

export default function Component() {
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents)

  const handleEventAdd = (event: CalendarEvent) => {
    setEvents([...events, event])
  }

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents(
      events.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event
      )
    )
  }

  const handleEventDelete = (eventId: string) => {
    setEvents(events.filter((event) => event.id !== eventId))
  }

  return (
    <EventCalendar
      events={events}
      onEventAdd={handleEventAdd}
      onEventUpdate={handleEventUpdate}
      onEventDelete={handleEventDelete}
    />
  )
}
