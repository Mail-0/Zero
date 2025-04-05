import { isSameDay } from "date-fns"

import type {
  CalendarEvent,
  EventColor,
} from "@/components/event-calendar"

/**
 * Get CSS classes for event colors
 */
export function getEventColorClasses(color?: EventColor | string): string {
  const eventColor = color || "default"

  switch (eventColor) {
    case "default":
      return "bg-background/50 hover:bg-background/40 text-foreground/80 dark:bg-background/25 dark:hover:bg-background/20 dark:text-foreground/80 border border-border"
    case "important":
      return "bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/20 dark:text-amber-500 dark:hover:bg-amber-900/30"
    case "promotions":
      return "bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-500 dark:hover:bg-red-900/30"
    case "personal":
      return "bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/20 dark:text-green-500 dark:hover:bg-green-900/30"
    case "updates":
      return "bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/20 dark:text-purple-500 dark:hover:bg-purple-900/30"
    case "forums":
      return "bg-blue-500/10 hover:bg-blue-500/15 text-blue-500 dark:bg-blue-400/10 dark:text-blue-400 dark:hover:bg-blue-400/15"
    default:
      return "bg-background/50 hover:bg-background/40 text-foreground/80 dark:bg-background/25 dark:hover:bg-background/20 dark:text-foreground/80 border border-border"
  }
}

/**
 * Get CSS classes for border radius based on event position in multi-day events
 */
export function getBorderRadiusClasses(
  isFirstDay: boolean,
  isLastDay: boolean
): string {
  if (isFirstDay && isLastDay) {
    return "rounded" // Both ends rounded
  } else if (isFirstDay) {
    return "rounded-l rounded-r-none" // Only left end rounded
  } else if (isLastDay) {
    return "rounded-r rounded-l-none" // Only right end rounded
  } else {
    return "rounded-none" // No rounded corners
  }
}

/**
 * Check if an event is a multi-day event
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  const eventStart = new Date(event.start)
  const eventEnd = new Date(event.end)
  return event.allDay || eventStart.getDate() !== eventEnd.getDate()
}

/**
 * Filter events for a specific day
 */
export function getEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events
    .filter((event) => {
      const eventStart = new Date(event.start)
      return isSameDay(day, eventStart)
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

/**
 * Sort events with multi-day events first, then by start time
 */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const aIsMultiDay = isMultiDayEvent(a)
    const bIsMultiDay = isMultiDayEvent(b)

    if (aIsMultiDay && !bIsMultiDay) return -1
    if (!aIsMultiDay && bIsMultiDay) return 1

    return new Date(a.start).getTime() - new Date(b.start).getTime()
  })
}

/**
 * Get multi-day events that span across a specific day (but don't start on that day)
 */
export function getSpanningEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((event) => {
    if (!isMultiDayEvent(event)) return false

    const eventStart = new Date(event.start)
    const eventEnd = new Date(event.end)

    // Only include if it's not the start day but is either the end day or a middle day
    return (
      !isSameDay(day, eventStart) &&
      (isSameDay(day, eventEnd) || (day > eventStart && day < eventEnd))
    )
  })
}

/**
 * Get all events visible on a specific day (starting, ending, or spanning)
 */
export function getAllEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = new Date(event.start)
    const eventEnd = new Date(event.end)
    return (
      isSameDay(day, eventStart) ||
      isSameDay(day, eventEnd) ||
      (day > eventStart && day < eventEnd)
    )
  })
}

/**
 * Get all events for a day (for agenda view)
 */
export function getAgendaEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events
    .filter((event) => {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      return (
        isSameDay(day, eventStart) ||
        isSameDay(day, eventEnd) ||
        (day > eventStart && day < eventEnd)
      )
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

/**
 * Add hours to a date
 */
export function addHoursToDate(date: Date, hours: number): Date {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}
