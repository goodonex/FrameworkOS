import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useViewport'
import { useArbeitsDauern } from '../../hooks/useArbeitsDauern'
import { useBookings } from '../../hooks/useSalesPro'
import { useContentPieces } from '../../hooks/useContentPieces'
import { entwuerfeOffen, usePosten } from '../../hooks/usePosten'
import { useActiveBrand } from '../lib/activeBrand'
import { agentenBefund } from '../lib/agentenGesundheit'
import { eventsByDate, termineAmTag, ymd, type CalEvent } from '../lib/termineEvents'
import { tagesansage } from '../lib/tagesansage'
import { CALENDAR_ICAL_KEY, useCalendarFeed } from '../lib/useCalendarFeed'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useRunnerData } from '../lib/useRunnerData'
import { Benachrichtigungen } from '../components/Benachrichtigungen'
import { BefundZeile } from '../components/home/BefundZeile'

/**
 * `/morgen` — was der Tipp auf die Benachrichtigung öffnet (O3, Zug 6).
 *
 * Vollbild ist ein Handy-Konzept: am Desktop leitet die Route auf `/cockpit`
 * um, statt eine zweite Heimat für dieselben Zahlen aufzumachen.
 *
 * Die Seite rechnet **nichts selbst**. Posten, Tagesansage und Termine kommen
 * aus denselben Hooks wie das Sales-Dashboard (`usePosten`, `tagesansage`,
 * `termineEvents`) — sonst stünden morgens am Handy andere Zahlen als tagsüber
 * am Rechner, und keine wäre verbindlich.
 */

const ANFRAGEN_ZIEL = 30

function datumLang(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
}

function gruss(d: Date): string {
  const h = d.getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function MorgenArea() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug

  const { geordnet, jetzt, contacts } = usePosten(slug)
  const dauern = useArbeitsDauern(slug)
  const bookings = useBookings(slug)
  const content = useContentPieces(slug)
  const metrics = useDailyMetrics()
  const { runs } = useRunnerData()

  const icalUrl = (() => {
    try {
      return localStorage.getItem(CALENDAR_ICAL_KEY) ?? ''
    } catch {
      return ''
    }
  })()
  const cal = useCalendarFeed(icalUrl || null)

  const termine = useMemo<CalEvent[]>(() => {
    const map = eventsByDate({
      bookings: bookings.items,
      contacts: contacts.items,
      content: content.items,
      kalender: cal.events,
    })
    return termineAmTag(map, ymd(jetzt))
  }, [bookings.items, contacts.items, content.items, cal.events, jetzt])

  const ansage = useMemo(() => tagesansage(geordnet, dauern, jetzt), [geordnet, dauern, jetzt])
  const entwuerfe = useMemo(() => entwuerfeOffen(geordnet), [geordnet])
  const befund = useMemo(() => agentenBefund(runs, jetzt), [runs, jetzt])
  const anfragen = metrics.today?.li_anfragen ?? 0

  // Vollbild nur am Handy (Kevins UI-Gesetz). Am Rechner gibt es das Cockpit.
  if (!isMobile) return <Navigate to="/cockpit" replace />

  const zeile = (label: string, wert: string, betonen = false) => (
    <div
      key={label}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '11px 0',
        borderBottom: '1px solid var(--ck-border)',
      }}
    >
      <span className="ck-label">{label}</span>
      <span
        style={{
          fontSize: betonen ? 22 : 15,
          color: betonen ? 'var(--ck-accent)' : 'var(--ck-text-1)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {wert}
      </span>
    </div>
  )

  return (
    <div
      style={{
        // `#app-ui-overlay` setzt global pointer-events: none — ohne das hier
        // reagiert kein Knopf auf dieser Seite (die Falle vom 08.07.).
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        // Unten Luft fuer die Uriel-Blase und die Bottom-Bar — sonst liegt der
        // Benachrichtigungs-Block halb unter dem FAB (am 390er-Handy geprueft).
        padding: '10px 4px 96px',
      }}
    >
      <header>
        <div style={{ fontSize: 19, color: 'var(--ck-text-1)' }}>{gruss(jetzt)}.</div>
        <div className="ck-label" style={{ marginTop: 2 }}>
          {datumLang(jetzt)}
        </div>
      </header>

      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ck-text-2)', lineHeight: 1.55 }}>{ansage}</p>

      {/* O17: Wenn die Nacht-Analyse gescheitert ist, gehört das an den Anfang
          des Morgens — nicht in ein Protokoll, das niemand aufmacht.
          O18, Zug 2: dieselbe Zeile steht jetzt auch auf dem Homescreen —
          eine Komponente, damit sie nicht auseinanderläuft. */}
      <BefundZeile meldung={befund.meldung} onOeffnen={() => navigate('/agenten')} />

      <section>
        {zeile('Posten offen', String(geordnet.length), true)}
        {zeile('Entwürfe fertig', String(entwuerfe))}
        {zeile(
          'Termine heute',
          termine.length === 0
            ? '—'
            : termine.map((t) => `${t.time ?? ''} ${t.title}`.trim()).join(' · '),
        )}
      </section>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--ck-text-3)' }}>
        Vernetzungsanfragen {anfragen}/{ANFRAGEN_ZIEL} — am Laptop.
      </p>

      {/* Die Morgenlese steht VOR dem Loslegen — dieselbe Reihenfolge wie in
          der Visionmap (Regel 1: erst lesen, dann der Block). Damit führt der
          Push-Tipp in zwei Tipps zur Sunrise Success Formel, ohne den Arbeitsweg darunter
          zu verstellen. */}
      <button
        type="button"
        className="ck-btn"
        onClick={() => navigate('/identitaet')}
        style={{ minHeight: 48, fontSize: 13, justifyContent: 'center' }}
      >
        Sunrise Success Formel · 2 Minuten
      </button>

      {/* Ein Knopf, ein Ziel: ≤ 2 Interaktionen bis zur ersten erledigten
          Einheit (Push-Tipp → Loslegen → erster Posten steht). */}
      <button
        type="button"
        className="ck-btn ck-btn--primary"
        onClick={() => navigate('/sales?kachel=jetzt-dran&modus=arbeit')}
        disabled={geordnet.length === 0}
        style={{ minHeight: 54, fontSize: 15 }}
      >
        {geordnet.length === 0 ? 'Nichts offen' : 'Loslegen'}
      </button>

      <div style={{ marginTop: 6 }}>
        <Benachrichtigungen kompakt />
      </div>
    </div>
  )
}
