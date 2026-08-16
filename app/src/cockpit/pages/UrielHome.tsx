import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArbeitsDauern } from '../../hooks/useArbeitsDauern'
import { useContentPieces } from '../../hooks/useContentPieces'
import { entwuerfeOffen, usePosten } from '../../hooks/usePosten'
import { useBookings } from '../../hooks/useSalesPro'
import { useCommandPalette } from '../../lib/commandPaletteContext'
import { BereichIcon } from '../components/BereichIcon'
import { AgentenKacheln } from '../components/home/AgentenKacheln'
import { AppGrid } from '../components/home/AppGrid'
import { BefundZeile } from '../components/home/BefundZeile'
import { HeroHorizont } from '../components/home/HeroHorizont'
import { JetztDran } from '../components/home/JetztDran'
import { TermineWidget } from '../components/home/TermineWidget'
import { VitalsWidget } from '../components/home/VitalsWidget'
import { useActiveBrand } from '../lib/activeBrand'
import { agentenBefund } from '../lib/agentenGesundheit'
import { PALETTEN_BEREICHE } from '../lib/bereiche'
import { weekVitals } from '../lib/metricsAggregate'
import { useSocialUnread } from '../lib/socialApi'
import {
  KACHEL_REIHENFOLGE,
  kontextReihenfolge,
  ordneNach,
  verschiebeVor,
} from '../lib/kachelReihenfolge'
import { useUiSetting } from '../lib/uiSettings'
import { tagesansage } from '../lib/tagesansage'
import { eventsByDate, termineAmTag, ymd, type CalEvent } from '../lib/termineEvents'
import { CALENDAR_ICAL_KEY, useCalendarFeed } from '../lib/useCalendarFeed'
import { useUrielBus } from '../../store/urielBus'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useTagesFlow } from '../lib/useTagesFlow'
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

/** Alle Bereiche außer dem, auf dem man gerade steht. */
const APPS = PALETTEN_BEREICHE.filter((b) => b.path !== '/cockpit')

/**
 * Schnell-Aktionen hinter dem Halten (v2 a).
 *
 * Bewusst nur dort, wo eine Route wirklich in EINE Arbeit springt — ein
 * Halte-Menü, das nur „Bereich öffnen" anbietet, ist ein leerer Umweg.
 *
 * **Der Zähler zeigt seit dem 11.08. auf den Zähl-Modus**, nicht mehr auf
 * `/sales?kachel=vernetzungsanfragen`. Dort lag am Handy noch der alte
 * `AnfragenZaehler` — ein zweites Bedienbild für dieselbe Zahl, und das
 * einzige, das den Tages-Flow nicht kennt. Der Desktop-Weg über die
 * Sales-Kachel bleibt unangetastet.
 */
const SCHNELL_AKTIONEN: Record<string, Array<{ label: string; route: string }>> = {
  '/sales': [
    { label: 'Arbeitsmodus starten', route: '/sales?kachel=jetzt-dran&modus=arbeit' },
    { label: 'Antworten', route: '/sales?kachel=antworten' },
    { label: 'Anfragen zählen', route: '/tracking/zaehlen/li_anfragen' },
  ],
}

export function UrielHome() {
  const navigate = useNavigate()
  const { openPalette } = useCommandPalette()
  // Die Ask-Pille oeffnet das BESTEHENDE Uriel-Dock (D4) — kein zweiter Chat.
  const urielOeffnen = useUrielBus((s) => s.setOpen)
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

  /**
   * Die fünf Stufen des Tages für die Hero-Kette (D6: der Hero rechnet nichts).
   *
   * Das Soll der Follow-up-Stufe kommt aus `quellen.followup` — derselben
   * Liste, die auch „Jetzt dran" und die Sales-Kachel füttern. Die Seite lädt
   * dafür nichts nach: `usePosten` hat die Threads schon in der Hand.
   */
  const faelligeFollowups = posten.quellen.followup?.length ?? 0
  const flow = useTagesFlow(metrics.today, faelligeFollowups, metrics.loading || posten.linkedinThreads.loading)

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

  /**
   * Badges nur aus Quellen, die diese Seite ohnehin geladen hat (D5).
   * `useSocialUnread` teilt sich seit Zug 4 einen Ladelauf mit der NavRail —
   * sonst liefe der 60-Sekunden-Takt doppelt.
   *
   * **Kein Badge an `/freigaben`**, obwohl D5 einen vorsah. Die Gegenprobe der
   * Blaupause (Verifikation 5: Badge == Karten auf der Seite) ging nicht auf:
   * `entwuerfeOffen(geordnet)` zählt Posten der Posten-Engine mit frischem
   * Entwurf (20), `/freigaben` zählt offene Karten der Agenten-Warteschlange
   * (24) — zwei verschiedene Mengen. Gleichziehen ginge nur, indem die Home
   * die Freigaben-Karten selbst lädt; das ist genau der Nachlade-Pfad, den
   * Gesetz 4 verbietet. Eine Zahl, die neben der Seite steht, die sie meint,
   * ist schlimmer als keine — die Zahl steht eine Zeile höher im Heute-Widget.
   */
  const socialUnread = useSocialUnread()
  const badgeFuer = (path: string) => (path === '/content' ? socialUnread : 0)

  /**
   * Eigene Kachel-Reihenfolge (v2 d). Liegt in Supabase (0068), damit sie das
   * Neu-Hinzufügen der PWA überlebt; localStorage ist nur der Zwischenspeicher,
   * damit die Kacheln beim Öffnen nicht sichtbar umspringen.
   */
  const { wert: reihenfolge, setzen: setReihenfolge } = useUiSetting<string[]>(KACHEL_REIHENFOLGE, [])
  const [anordnen, setAnordnen] = useState(false)
  /**
   * v2 (e): Solange nichts selbst angeordnet ist, entscheidet die Tageszeit über
   * die ersten drei Kacheln. Sobald Kevin einmal anordnet, gilt seine Liste —
   * eine Oberfläche, die sich unter der eigenen Anordnung weiterbewegt, wäre
   * kein Dienst, sondern ein Ärgernis.
   */
  const sortierteApps = useMemo(
    () => ordneNach(APPS, reihenfolge.length > 0 ? reihenfolge : kontextReihenfolge(jetzt.getHours())),
    [reihenfolge, jetzt],
  )

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
        padding: '0 0 96px',
      }}
    >
      <HeroHorizont
        gruss={`${gruss(jetzt)}.`}
        datum={laedt ? datumLang(jetzt) : ansage}
        stufen={flow.staende}
        stufenLaden={flow.laedt}
        onAsk={() => urielOeffnen(true)}
        onStufe={(feld) => navigate(`/tracking/zaehlen/${feld}`)}
      />

      {/* Der Ein-Klick-Weg in die Morgenlese (Visionmap-Regel 1: erst lesen,
          dann der Block). Rein zeitbasiert wie kontextReihenfolge — bewusst
          OHNE den Check-in-Hook: der Homescreen lädt nichts Neues (Gesetz 4),
          und die Zeile verschwindet mittags von allein. Sie hängt nicht an
          der Kachel-Reihenfolge, überlebt also auch Kevins eigene Anordnung. */}
      {jetzt.getHours() < 11 ? (
        <button type="button" className="ck-morgenlese-zeile" onClick={() => navigate('/identitaet')}>
          <span className="ck-morgenlese-zeichen" aria-hidden>
            <BereichIcon name="horizont" size={18} />
          </span>
          <span className="ck-morgenlese-text">
            <span className="ck-morgenlese-titel">Morgenlese</span>
            <span className="ck-morgenlese-unter">2 Minuten — dann der Block</span>
          </span>
        </button>
      ) : null}

      <BefundZeile meldung={befund.meldung} onOeffnen={() => navigate('/agenten')} />

      {/* HEUTE — was feststeht. Derselbe Baustein wie vorher im Wisch-Stapel,
          jetzt als eigene Sektion (D4: keine versteckten Seiten mehr). */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="ck-label" style={{ paddingLeft: 2, letterSpacing: '0.16em' }}>
          Heute
        </span>
        <TermineWidget termine={termine} onOeffnen={() => navigate('/termine')} />
      </section>

      {/* JETZT DRAN — die obersten drei Posten DER EINEN Rangfolge. Der Weg in
          die Arbeit ist derselbe wie der frühere „Loslegen"-Knopf. */}
      <JetztDran
        posten={geordnet}
        entwuerfe={entwuerfe}
        laedt={laedt}
        onOeffnen={() => navigate('/sales?kachel=jetzt-dran&modus=arbeit')}
      />

      {/* Suche = die bestehende CommandPalette (O18, Zug 6). Am Handy gibt es
          keinen anderen Weg dorthin — Cmd+K hat kein Telefon. */}
      <button
        type="button"
        className="ck-btn"
        onClick={openPalette}
        style={{ alignSelf: 'flex-start', minHeight: 44, fontSize: 12 }}
      >
        Suchen und springen
      </button>

      {/* Die Apps. `/cockpit` fehlt bewusst — man ist schon da. Reihenfolge =
          Registry-Reihenfolge, also Warteschlange vorn. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className="ck-label" style={{ paddingLeft: 2, color: anordnen ? 'var(--ck-warn)' : undefined }}>
            {anordnen ? 'Kachel antippen, dann Ziel antippen' : 'Apps'}
          </span>
          <button
            type="button"
            className="ck-btn"
            onClick={() => {
              // Beim Einsteigen die gerade sichtbare Reihenfolge festschreiben —
              // sonst verschöbe der erste Griff gegen eine leere Liste und die
              // Tageszeit-Sortierung würde die eigene Wahl gleich wieder
              // überstimmen.
              if (!anordnen && reihenfolge.length === 0) setReihenfolge(sortierteApps.map((b) => b.path))
              setAnordnen((a) => !a)
            }}
            style={{ fontSize: 11, padding: '0 14px' }}
          >
            {anordnen ? 'Fertig' : 'Anordnen'}
          </button>
        </div>
        <AppGrid
          bereiche={sortierteApps}
          badgeFuer={badgeFuer}
          schnellAktionen={(p) => SCHNELL_AKTIONEN[p] ?? []}
          anordnen={anordnen}
          onVerschieben={(was, vor) =>
            setReihenfolge(verschiebeVor(sortierteApps.map((b) => b.path), was, vor))
          }
          onWaehle={(p) => navigate(p)}
        />
      </div>

      {/* v2 (b): Lief die Nacht durch? Die Antwort gehört auf den Homescreen,
          nicht hinter einen Bereichswechsel. Dieselben Runs, aus denen oben
          schon die Warnzeile kommt. */}
      <AgentenKacheln runs={runs} befund={befund} jetzt={jetzt} onOeffnen={() => navigate('/agenten')} />

      {/* Die Wochenzahlen stehen in D4 nicht im Hero — geloescht werden sie
          deshalb nicht. Sie sind unter die Apps gerueckt, wo sie niemandem im
          Weg stehen und trotzdem ohne Bereichswechsel lesbar bleiben. */}
      <VitalsWidget vitals={vitals} onOeffnen={() => navigate('/tracking')} />
    </div>
  )
}
