import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useBookings } from '../../hooks/useSalesPro'
import { HeuteTabs } from '../components/HeuteTabs'
import { useActiveBrand } from '../lib/activeBrand'
import { runnerDirekt } from '../lib/runnerBridge'
import {
  eventsByDate as baueEvents,
  KIND_LABEL,
  KIND_TONE,
  ymd,
  type EventKind,
} from '../lib/termineEvents'
import { CALENDAR_ICAL_KEY, useCalendarFeed } from '../lib/useCalendarFeed'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** 42-Tage-Raster ab dem Montag vor dem Monatsersten. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Mo=0
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

/** Kalender (/termine) — vereint Buchungen, Kontakt-Follow-ups und Content-Slots. */
export function TermineArea() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug
  const contacts = useContacts(slug)
  const bookings = useBookings(slug)
  const content = useContentPieces(slug)

  const [icalUrl, setIcalUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(CALENDAR_ICAL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const cal = useCalendarFeed(icalUrl || null)
  const [showSettings, setShowSettings] = useState(false)
  const [icalDraft, setIcalDraft] = useState(icalUrl)

  const saveIcal = (value: string) => {
    const v = value.trim()
    setIcalUrl(v)
    try {
      if (v) localStorage.setItem(CALENDAR_ICAL_KEY, v)
      else localStorage.removeItem(CALENDAR_ICAL_KEY)
    } catch {
      /* ohne localStorage nur diese Session */
    }
  }

  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [filter, setFilter] = useState<Record<EventKind, boolean>>({
    booking: true,
    followup: true,
    content: true,
    external: true,
  })

  const todayYmd = ymd(new Date())

  const eventsByDate = useMemo(
    () =>
      baueEvents({
        bookings: bookings.items,
        contacts: contacts.items,
        content: content.items,
        kalender: cal.events,
      }),
    [bookings.items, contacts.items, content.items, cal.events],
  )

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  const step = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }
  const goToday = () => {
    const n = new Date()
    setCursor({ year: n.getFullYear(), month: n.getMonth() })
  }

  const loading = contacts.loading || bookings.loading || content.loading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <HeuteTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)', margin: 0 }}>
            {MONTHS[cursor.month]} {cursor.year}
          </h1>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            <button type="button" className="ck-btn" onClick={() => step(-1)} aria-label="Vorheriger Monat" style={{ padding: '5px 9px' }}>‹</button>
            <button type="button" className="ck-btn" onClick={goToday} style={{ padding: '5px 10px', fontSize: 10 }}>Heute</button>
            <button type="button" className="ck-btn" onClick={() => step(1)} aria-label="Nächster Monat" style={{ padding: '5px 9px' }}>›</button>
          </div>
        </div>
        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter((f) => ({ ...f, [k]: !f[k] }))}
              className="ck-btn"
              style={{
                fontSize: 10,
                padding: '5px 10px',
                opacity: filter[k] ? 1 : 0.4,
                borderColor: filter[k] ? KIND_TONE[k] : undefined,
                color: filter[k] ? KIND_TONE[k] : undefined,
              }}
            >
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: KIND_TONE[k], display: 'inline-block' }} />
              {KIND_LABEL[k]}
            </button>
          ))}
          <button
            type="button"
            className="ck-btn"
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Kalender-Feed einstellen"
            aria-expanded={showSettings}
            style={{ fontSize: 11, padding: '5px 9px' }}
          >
            ⚙
          </button>
        </div>
      </div>

      {showSettings ? (
        <section className="ck-panel" style={{ padding: 12 }}>
          <div className="ck-label" style={{ marginBottom: 6 }}>Kalender-Feed (privater iCal-Link)</div>
          {!runnerDirekt() ? (
            // Der Link hier ist an diesen Browser gebunden — vom Handy aus wäre
            // ein Eingabefeld eine Falle. Hier kommt der Kalender aus dem Spiegel.
            <div style={{ fontSize: 11.5, color: 'var(--ck-text-3)', lineHeight: 1.5 }}>
              Der Kalender kommt hier aus dem Spiegel, den der Runner auf dem Mac füllt
              (<code>CALENDAR_ICAL_URL</code> in runner/.env). Einstellen lässt er sich nur dort.
            </div>
          ) : (
          <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="ck-input"
              value={icalDraft}
              onChange={(e) => setIcalDraft(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}
              aria-label="iCal-URL"
            />
            <button type="button" className="ck-btn ck-btn--primary" style={{ fontSize: 10 }} onClick={() => saveIcal(icalDraft)}>
              Speichern
            </button>
            {icalUrl ? (
              <button
                type="button"
                className="ck-btn"
                style={{ fontSize: 10 }}
                onClick={() => {
                  setIcalDraft('')
                  saveIcal('')
                }}
              >
                Entfernen
              </button>
            ) : null}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ck-text-3)', marginTop: 8, lineHeight: 1.5 }}>
            Google Kalender → Einstellungen → deinen Kalender → „Privatadresse im iCal-Format" kopieren.
            Nur lesend, wird über den lokalen Runner geholt (der muss laufen). Wiederkehrende Termine
            erscheinen v1 nur zu ihrem ersten Datum.
          </div>
          </>
          )}
          {cal.loading ? (
            <div style={{ fontSize: 11, color: 'var(--ck-text-3)', marginTop: 6 }}>lädt Kalender…</div>
          ) : cal.error ? (
            <div style={{ fontSize: 11, color: 'var(--ck-warn)', marginTop: 6 }}>{cal.error}</div>
          ) : icalUrl || cal.events.length > 0 ? (
            <div style={{ fontSize: 11, color: 'var(--ck-accent)', marginTop: 6 }}>
              ✓ verbunden · {cal.events.length} Termine
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="ck-panel" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="ck-label" style={{ padding: '8px 10px', borderBottom: '1px solid var(--ck-border)', textAlign: 'left' }}>
              {w}
            </div>
          ))}
          {grid.map((d, i) => {
            const key = ymd(d)
            const inMonth = d.getMonth() === cursor.month
            const isToday = key === todayYmd
            const events = (eventsByDate.get(key) ?? []).filter((e) => filter[e.kind])
            return (
              <div
                key={key + i}
                style={{
                  minHeight: 96,
                  padding: 6,
                  borderBottom: '1px solid var(--ck-border)',
                  borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--ck-border)',
                  background: inMonth ? 'transparent' : 'var(--ck-bg)',
                  opacity: inMonth ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--ck-accent)' : 'var(--ck-text-3)',
                    marginBottom: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={
                      isToday
                        ? {
                            background: 'var(--ck-accent-dim)',
                            borderRadius: 999,
                            padding: '0 6px',
                          }
                        : undefined
                    }
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {events.slice(0, 4).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => e.href && navigate(e.href)}
                      title={`${KIND_LABEL[e.kind]}: ${e.title}${e.sub ? ` — ${e.sub}` : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: '1px 2px',
                        borderRadius: 4,
                        cursor: e.href ? 'pointer' : 'default',
                        opacity: e.muted ? 0.5 : 1,
                      }}
                    >
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: KIND_TONE[e.kind] }} />
                      <span
                        style={{
                          fontSize: 10.5,
                          color: 'var(--ck-text-2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: e.muted ? 'line-through' : 'none',
                        }}
                      >
                        {e.time ? <span style={{ color: 'var(--ck-text-3)' }}>{e.time} </span> : null}
                        {e.title}
                      </span>
                    </button>
                  ))}
                  {events.length > 4 ? (
                    <span style={{ fontSize: 9.5, color: 'var(--ck-text-3)', paddingLeft: 2 }}>
                      +{events.length - 4} mehr
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>Lädt Termine …</div>
      ) : null}
    </div>
  )
}
