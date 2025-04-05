export type CalendarView = "month" | "week" | "day" | "agenda"

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  allDay?: boolean
  color?: EventColor
  location?: string
}

export type EventColor =
  | "default"
  | "important"
  | "promotions"
  | "personal"
  | "updates"
  | "forums"
