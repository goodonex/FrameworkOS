import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArbeitsDauern } from '../../hooks/useArbeitsDauern'
import { useContentPieces } from '../../hooks/useContentPieces'
import { entwuerfeOffen, usePosten } from '../../hooks/usePosten'
import { useBookings } from '../../hooks/useSalesPro'
import { useCommandPalette } from '../../lib/commandPaletteContext'
import { BefundZeile } from '../components/home/BefundZeile'
import { HeuteWidget } from '../components/home/HeuteWidget'
import { TermineWidget } from '../components/home/TermineWidget'
import { VitalsWidget } from '../components/home/VitalsWidget'
import { useActiveBrand } from '../lib/activeBrand'
import { agentenBefund } from '../lib/agentenGesundheit'
import { weekVitals } from '../lib/metricsAggregate'
import { tagesansage } from '../lib/tagesansage'
import { eventsByDate, termineAmTag, ymd, type CalEvent } from '../lib/termineEvents'
import { CALENDAR_ICAL_KEY, useCalendarFeed } from '../lib/useCalendarFeed'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useRunnerData } from '../lib/useRunnerData'

/**
 * Der Homescreen — was `/cockpit` am Handy zeigt (O18, Züge 3–6).
 *
 * **Widgets zuerst, Icons darunter** (Gesetz 1 der Blaupause): oben steht die
 * Arbeit des Tages mit dem Loslegen-Knopf, darunter die App-Kacheln. Ein reines
 * Icon-Grid als Einstieg wäre ein Rückschritt gewesen — es kostet auf dem Weg
 * zum ersten Posten einen Klick, den die Klick-Ökonomie nicht hergibt
 * (Öffnen → Loslegen → Posten 1 = 2 Interaktionen).
 *
 * **Dieser Container ruft die Hooks, die Widgets bekommen Props.** Genau ein
 * Ort lädt, damit nicht vier Bausteine dieselben Tabellen abonnieren.
 *
 * **Was am Handy bewusst entfällt** (gegenüber `CockpitHome`): OS-Graph
 * (war mobil ein geclampter Notbehelf), GoalCard, QuickTrack und das
 * Agenten-Deck. Tracking-Eingabe lebt in `/tracking` und im Anfragen-Zähler,
 * die Agenten unter `/agenten`. Dadurch lädt der Homescreen **weniger** als
 * die Desktop-Home, nicht mehr (Gesetz 4).
 *
 * Der Desktop bleibt unangetastet — `CockpitHome` verzweigt vor allen
 * Datenpfaden, `CockpitHomeDesktop` wird am Handy gar nicht erst montiert.
 */

function datumLang(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
}

function gruss(d: Date): string {
  const h = d.getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function UrielHome() {
  const navigate = useNavigate()
  const { openPalette } = useCommandPalette()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug

  const posten = usePosten(slug)
  const { geordnet, jetzt, contacts } = posten
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
  const vitals = useMemo(
    () => weekVitals(metrics.weekRows, metrics.windowRows),
    [metrics.weekRows, metrics.windowRows],
  )

  /**
   * Solange eine der Posten-Quellen lädt, ist `geordnet` leer — ohne diese
   * Weiche stünde beim Öffnen für einen Moment „Nichts offen" da, obwohl gleich
   * 200 Posten kommen. Der Zustand kommt aus den Hooks, die ohnehin laufen;
   * es wird nichts zusätzlich geladen.
   */
  const laedt =
    posten.contacts.loading ||
    posten.tasks.loading ||
    posten.projekte.loading ||
    posten.linkedinThreads.loading ||
    posten.erstnachrichten.loading

  return (
    <div
      style={{
        // `#app-ui-overlay` setzt global pointer-events: none — ohne das hier
        // reagiert kein Knopf auf dieser Seite (die Falle vom 08.07.).
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        // Unten Luft für die Uriel-Blase und die Bottom-Bar (am 390er geprüft).
        padding: '6px 0 96px',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 19, color: 'var(--ck-text-1)' }}>{gruss(jetzt)}.</div>
          <div className="ck-label" style={{ marginTop: 2 }}>
            {datumLang(jetzt)}
          </div>
        </div>
        {/* Suche = die bestehende CommandPalette (Zug 6). Am Handy gab es bisher
            keinen Weg dorthin — Cmd+K hat kein Telefon. */}
        <button
          type="button"
          className="ck-btn"
          onClick={openPalette}
          aria-label="Suchen und springen"
          style={{ minHeight: 44, minWidth: 44, fontSize: 17, flexShrink: 0 }}
        >
          ⌕
        </button>
      </header>

      <BefundZeile meldung={befund.meldung} onOeffnen={() => navigate('/agenten')} />

      <HeuteWidget
        ansage={ansage}
        offen={geordnet.length}
        entwuerfe={entwuerfe}
        laedt={laedt}
        onLoslegen={() => navigate('/sales?kachel=jetzt-dran&modus=arbeit')}
      />

      <TermineWidget termine={termine} onOeffnen={() => navigate('/termine')} />

      <VitalsWidget vitals={vitals} onOeffnen={() => navigate('/tracking')} />
    </div>
  )
}
