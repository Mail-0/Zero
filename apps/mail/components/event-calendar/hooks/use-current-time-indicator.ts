"use client"

import { useEffect, useState } from "react"
import { endOfWeek, isSameDay, isWithinInterval, startOfWeek } from "date-fns"

export function useCurrentTimeIndicator(
  currentDate: Date,
  view: "day" | "week"
) {
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0)
  const [currentTimeVisible, setCurrentTimeVisible] = useState<boolean>(false)

  useEffect(() => {
    const calculateTimePosition = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const totalMinutes = hours * 60 + minutes
      const dayStartMinutes = 0 // 12am
      const dayEndMinutes = 24 * 60 // 12am next day

      // Calculate position as percentage of day
      const position =
        ((totalMinutes - dayStartMinutes) / (dayEndMinutes - dayStartMinutes)) *
        100

      // Check if current day is in view based on the calendar view
      let isCurrentTimeVisible = false

      if (view === "day") {
        isCurrentTimeVisible = isSameDay(now, currentDate)
      } else if (view === "week") {
        const startOfWeekDate = startOfWeek(currentDate, { weekStartsOn: 0 })
        const endOfWeekDate = endOfWeek(currentDate, { weekStartsOn: 0 })
        isCurrentTimeVisible = isWithinInterval(now, {
          start: startOfWeekDate,
          end: endOfWeekDate,
        })
      }

      setCurrentTimePosition(position)
      setCurrentTimeVisible(isCurrentTimeVisible)
    }

    // Calculate immediately
    calculateTimePosition()

    // Update every minute
    const interval = setInterval(calculateTimePosition, 60000)

    return () => clearInterval(interval)
  }, [currentDate, view])

  return { currentTimePosition, currentTimeVisible }
}
