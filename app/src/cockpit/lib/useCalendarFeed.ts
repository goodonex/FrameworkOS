import { useEffect, useState } from 'react'
import { fetchCalendar } from './runnerApi'
import { parseIcal, type CalendarEvent } from './icalParse'

export const CALENDAR_ICAL_KEY = 'ck.calendar.ical'

/**
 * Kalender-Feed für /termine: lädt die iCal über den Runner und parst sie.
 *
 * Quelle ist der Spiegel des Runners (`CALENDAR_ICAL_URL`, beliebig viele
 * Kalender) — auf jedem Gerät gleich. Die im ⚙-Panel gespeicherte URL ist nur
 * noch Rückfallebene für den Fall, dass der Runner keine Kalender kennt;
 * deshalb wird auch ohne sie geladen.
 */
export function useCalendarFeed(icalUrl: string | null): {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
} {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Kein Vorab-Abbruch mehr ohne lokale URL: der Spiegel kann Kalender haben,
    // auch wenn im ⚙-Panel nie etwas eingetragen wurde (Normalfall am Mac).
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCalendar(icalUrl)
      .then((text) => {
        if (!cancelled) setEvents(parseIcal(text))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kalender nicht erreichbar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [icalUrl])

  return { events, loading, error }
}
