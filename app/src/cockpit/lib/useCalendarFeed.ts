import { useEffect, useState } from 'react'
import { fetchCalendar } from './runnerApi'
import { runnerDirekt } from './runnerBridge'
import { parseIcal, type CalendarEvent } from './icalParse'

export const CALENDAR_ICAL_KEY = 'ck.calendar.ical'

/**
 * Kalender-Feed für /termine: lädt die iCal über den Runner und parst sie.
 *
 * Lokal steuert die im Cockpit gespeicherte URL alles; ohne URL passiert nichts.
 * Auf der Live-Domain gibt es diese URL nicht (localStorage lebt nur auf dem
 * Mac) — dort kommt der Kalender aus dem Spiegel, ganz ohne lokale Einstellung.
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
    const ausSpiegel = !runnerDirekt()
    if (!icalUrl && !ausSpiegel) {
      setEvents([])
      setError(null)
      return
    }
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
