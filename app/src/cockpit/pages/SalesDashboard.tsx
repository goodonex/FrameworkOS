import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useArbeitsDauern } from '../../hooks/useArbeitsDauern'
import { useLeads } from '../../hooks/useLeads'
import { usePosten } from '../../hooks/usePosten'
import { useIsMobile } from '../../hooks/useViewport'
import { supabase } from '../../lib/supabase'
import { AnfragenZaehler } from '../components/AnfragenZaehler'
import { Arbeitsliste, type LoomSkriptAktionen } from '../components/Arbeitsliste'
import { Arbeitsmodus, type ArbeitsmodusErgebnis } from '../components/Arbeitsmodus'
import { InmailPanel } from '../components/InmailPanel'
import { FunnelCanvas } from '../components/sales/FunnelCanvas'
import { VorlagenKopf } from '../components/sales/VorlagenKopf'
import { useActiveBrand } from '../lib/activeBrand'
import { antwortPostenAusgeblendet, zeilenId } from '../lib/arbeitsmodusQuellen'
import { erledigePosten } from '../lib/arbeitsmodusTracking'
import { funnelKarten, type FunnelKartenId, type FunnelLead } from '../lib/funnelKarten'
import { ausAltemWert, poolAbleitung, type InmailStand } from '../lib/inmailStand'
import { heutigesMetrikDatum } from '../lib/metricsDates'
import { INMAIL_CREDITS_STAND, type Posten, type Spur } from '../lib/prioritaet'
import type { LinkedinThread } from '../../types/db'
import { bereiteDatenVor, salesSerie, type SalesStreak } from '../lib/salesStreak'
import {
  TAGES_FLOW,
  ersteOffeneStufe,
  flowFortschritt,
  flowQuellen,
  type Stufe,
  type StufenId,
  type StufenStand,
} from '../lib/tagesFlow'
import { useTagesFlow } from '../lib/useTagesFlow'
import { wochenkontrolle } from '../lib/wochenkontrolle'
import { WochenkontrolleTafel } from '../components/linkedin/WochenkontrolleTafel'
import { useUiSetting } from '../lib/uiSettings'
import { tagesansage } from '../lib/tagesansage'
import { postRun } from '../lib/runnerApi'
import { fetchSalesLibrary, salesFileUrl, type SalesLibrary } from '../lib/salesLibraryApi'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useRunnerData } from '../lib/useRunnerData'

/**
 * Das Sales-Board als Tages-Flow (18.08.2026) — Kevins Diktat: „Ich will es
 * von oben nach unten abarbeitbar haben."
 *
 * Aus dem Kachel-Raster (elf gleich aussehende Karten, „219 offen" als
 * Angst-Zahl obendrauf) wurden die Stufen des Tages als Zeilen in fester
 * Reihenfolge: Anfragen → Erstnachrichten → Antworten → Follow-ups →
 * InMails → Looms. Die erste offene Zeile ist betont, erledigte werden grün
 * und tragen einen Haken, jede Zähl-Zeile zeigt ihre Serie („n Werktage in
 * Folge"). Darunter, bewusst ruhig und ohne Alarm-Optik: die Projekte.
 *
 * Was BLIEB: Zeile → Fenster → Namensliste → Haken, Kopieren nur bei
 * versandfertigem Text (Kevins UI-Gesetze). Das Fenster ist dasselbe
 * (`KachelFenster`, layout-Morph), die Arbeit darin auch. Gefallen sind die
 * Kacheln „Jetzt dran" (die 219 hatte keine Funktion — der Flow ersetzt sie),
 * „Quoten" (Wochen-Thema, wohnt in /tracking) und „Werkzeuge" (wohnt in
 * /agenten).
 *
 * Vollbild gibt es NUR am Handy: den Ein-Posten-Arbeitsmodus (aus dem
 * Fenster heraus) und den Ein-Knopf-Anfragen-Zähler. Am Desktop bleibt
 * alles im Fenster — Vollbild wäre dort verschenkter Platz.
 */

export interface KachelDef {
  id: string
  titel: string
  kennzahl: string
  kennzahlFarbe?: string
  /** zweite, kleinere Zeile auf der Kachel (z. B. „zuerst: …") */
  unterzeile?: string
  /** Inhalt des aufgeklappten Fensters */
  inhalt?: () => React.ReactNode
  /** optionale Aktion im Fenster-Fuß (z. B. „Arbeitsmodus starten" am Handy) */
  fensterAktion?: { label: string; onClick: () => void }
}

/** Eine Zeile des Tages-Flows — die Kachel-Definition plus Zeilen-Zustand. */
export interface FlowZeileDef extends KachelDef {
  /** Position im Ritual (1-basiert) — der Projekte-Block hat keine. */
  nummer?: number
  zustand: 'aktiv' | 'erledigt' | 'offen' | 'ruhig'
  streak?: SalesStreak
}

/** Der grüne Haken einer stehenden Zeile. */
function HakenZeichen() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}

/** Das Serien-Flämmchen — currentColor, damit die Token-Disziplin hält. */
function SerienZeichen() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3c1 3-4 5-4 9a4 4 0 0 0 8 0c0-2-1-3.5-2-4.5 0 1.5-.7 2.3-1.5 2.8C12.8 8.6 13.5 5.5 12 3Z" />
    </svg>
  )
}

/** Eine Zeile des Boards — komplett klickbar, morpht ins Fenster. */
export function FlowZeile({ zeile, onOeffnen }: { zeile: FlowZeileDef; onOeffnen: () => void }) {
  const aktiv = zeile.zustand === 'aktiv'
  const erledigt = zeile.zustand === 'erledigt'
  const ruhig = zeile.zustand === 'ruhig'
  return (
    <motion.button
      type="button"
      layoutId={`kachel-${zeile.id}`}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onClick={onOeffnen}
      className="ck-panel"
      style={{
        padding: aktiv ? '16px 16px' : '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        width: '100%',
        borderColor: aktiv ? 'var(--ck-accent)' : undefined,
        opacity: ruhig ? 0.85 : 1,
      }}
    >
      {/* Position im Ritual — Haken, sobald die Stufe steht. */}
      {zeile.nummer !== undefined ? (
        <span
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 600,
            color: erledigt ? 'var(--ck-accent)' : aktiv ? 'var(--ck-accent)' : 'var(--ck-text-3)',
            border: `1.5px solid ${erledigt || aktiv ? 'var(--ck-accent)' : 'var(--ck-border-strong)'}`,
          }}
        >
          {erledigt ? <HakenZeichen /> : zeile.nummer}
        </span>
      ) : null}

      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ck-label" style={{ display: 'block' }}>
          {zeile.titel}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: aktiv ? 17 : 15,
            fontWeight: 600,
            marginTop: 2,
            color: zeile.kennzahlFarbe ?? (erledigt ? 'var(--ck-accent)' : 'var(--ck-text-1)'),
          }}
        >
          {zeile.kennzahl}
        </span>
        {zeile.unterzeile ? (
          <span
            style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--ck-text-2)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {zeile.unterzeile}
          </span>
        ) : null}
      </span>

      {/* Die Serie: n Werktage in Folge, ein Frei-Tag je Woche eingerechnet. */}
      {zeile.streak && zeile.streak.laenge > 0 ? (
        <span
          className="ck-zahl"
          title={`${zeile.streak.laenge} Werktage in Folge${zeile.streak.heuteOffen ? ' — heute noch offen' : ''} · ein Frei-Tag je Woche eingerechnet`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            flexShrink: 0,
            color: zeile.streak.heuteOffen ? 'var(--ck-text-3)' : 'var(--ck-accent)',
          }}
        >
          <SerienZeichen />
          {zeile.streak.laenge}
        </span>
      ) : null}
    </motion.button>
  )
}

export function KachelFenster({
  kachel,
  onClose,
  layoutId,
}: {
  kachel: KachelDef
  onClose: () => void
  /**
   * Aus welchem Element das Fenster wächst.
   *
   * Muss von aussen kommen, seit dasselbe Fenster von zwei Stellen aufgeht:
   * von einer Canvas-Karte und von der Flow-Zeile darunter. Trügen beide
   * dieselbe `layoutId`, versuchte framer-motion zwischen ihnen zu morphen —
   * bei offenen Balken geisterten Karte und Zeile ineinander (am 25.08. im
   * Browser gesehen). Zwei Kennungen, und das Fenster nimmt die des Auslösers.
   */
  layoutId?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      // pointerdown + target-Check statt onClick: eine Textselektion, die auf
      // dem Backdrop endet, feuert ihren click am gemeinsamen Vorfahren und
      // würde das Fenster mitsamt aufgeklappter Zeile schließen.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        // Dunkles Panel auf dunklem Grund verschwimmt sonst mit dem Raster
        // dahinter — hohe Deckkraft statt Farbabstufung schafft den Abstand.
        background: 'rgba(2, 3, 4, 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        layoutId={layoutId ?? `kachel-${kachel.id}`}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="ck-panel"
        style={{
          width: 'min(720px, 94vw)',
          // 88vh misst den GROSSEN Viewport — bei eingeblendeter Safari-Leiste
          // ragt das Panel sonst über den sichtbaren Bereich (svh-Falle).
          maxHeight: 'min(88svh, 100%)',
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          /**
           * DECKEND, nicht die Klassenfarbe. `.ck-panel` traegt `--ck-card`
           * (0.55) — bewusst durchscheinend fuer Flaechen AUF der Seite. Ueber
           * einem Backdrop bleibt davon Geistertext: 0.86 Backdrop mal 0.55
           * Panel laesst noch ~6 % der Zeilen dahinter durch. `--ck-panel` ist
           * die deckende Entsprechung derselben Farbe und laut tokens.css
           * genau fuer "alles, was ueber Canvas, Foto oder Backdrop liegt" da —
           * jedes andere Overlay im Cockpit macht es so (RunDrawer,
           * OsDetailPanel, FunnelStufen, Arbeitsmodus).
           */
          background: 'var(--ck-panel)',
          borderColor: 'var(--ck-border-strong)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/**
         * Kopf und Fussaktion kleben, statt mitzuscrollen. Vorher lagen beide im
         * Scrollfluss: bei langen Listen stand „Arbeitsmodus starten" unter
         * zweihundert Zeilen, und „Schliessen" war nach dem ersten Wisch weg.
         * Das negative `top`/`bottom` frisst das Panel-Padding (20), sonst
         * bliebe ein Spalt, durch den die Liste durchscheint.
         */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
            position: 'sticky',
            top: -20,
            zIndex: 1,
            background: 'var(--ck-panel)',
            paddingTop: 20,
            marginTop: -20,
            paddingBottom: 8,
          }}
        >
          <div>
            <div className="ck-label">{kachel.titel}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: kachel.kennzahlFarbe ?? 'var(--ck-text-1)', marginTop: 2 }}>
              {kachel.kennzahl}
            </div>
          </div>
          <button type="button" className="ck-btn" style={{ minHeight: 44, flexShrink: 0 }} onClick={onClose}>
            Schließen
          </button>
        </div>
        {kachel.inhalt ? kachel.inhalt() : null}
        {kachel.fensterAktion ? (
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{
              minHeight: 48,
              position: 'sticky',
              bottom: -20,
              zIndex: 1,
              marginBottom: -20,
              marginTop: 'auto',
            }}
            onClick={kachel.fensterAktion.onClick}
          >
            {kachel.fensterAktion.label}
          </button>
        ) : null}
      </motion.div>
    </motion.div>
  )
}

/** „vor 2 h", „vor 35 min", „vor 3 Tagen" — für die Daten-Frische. */
function vorZeit(iso: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `vor ${Math.max(1, min)} min`
  const std = Math.floor(min / 60)
  if (std < 48) return `vor ${std} h`
  return `vor ${Math.floor(std / 24)} Tagen`
}

export function SalesDashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug
  const metrics = useDailyMetrics()
  // Posten-Verdrahtung liegt seit Etappe 3 im gemeinsamen Hook — das Heute-Deck
  // liest exakt dieselbe Rangfolge.
  const posten = usePosten(slug)
  const { geordnet, quellen, liegend, jetzt, tasks, linkedinThreads, erstnachrichten, netzwerk } = posten
  /**
   * Laden noch Quellen? Dann ist `geordnet` nur ein Zwischenstand (O18).
   * Wichtig fuer `?modus=arbeit` unten — sonst startet der Arbeitsmodus mit den
   * zwei Posten, die zufaellig zuerst da waren, und die restlichen 200 fehlen.
   */
  const postenLaedt =
    posten.contacts.loading ||
    posten.tasks.loading ||
    posten.projekte.loading ||
    posten.linkedinThreads.loading ||
    posten.erstnachrichten.loading
  const dauern = useArbeitsDauern(slug)
  const { runner, runs, refresh: refreshRuns } = useRunnerData()

  const [offenKachelId, setOffenKachelId] = useState<string | null>(null)
  /** Die `layoutId` des Auslösers — Karte oder Balken, siehe `KachelFenster`. */
  const [offenVon, setOffenVon] = useState<string | null>(null)
  /** Snapshot beim Öffnen — die Live-Listen schrumpfen beim Abhaken (optimistische
      Updates) und würden sonst unter dem laufenden Index wegrutschen: jeder
      zweite Posten würde übersprungen und nie angezeigt. */
  const [arbeitsmodus, setArbeitsmodus] = useState<{ spur: Spur | 'alle'; posten: Posten[] } | null>(null)
  const [anfragenVollbild, setAnfragenVollbild] = useState(false)

  const kundenaufgabePosten = useMemo(() => quellen.kundenaufgabe ?? [], [quellen.kundenaufgabe])
  // Kundenaufgaben (mit Projekt) und eigene Aufgaben (ohne) landen in derselben
  // Zeile — für Kevin ist beides „was ich noch schulde". Die Rangfolge trennt
  // sie trotzdem: `aufgabe` steht hinter LinkedIn.
  const kundenarbeitPosten = useMemo(
    () => [...kundenaufgabePosten, ...(quellen.aufgabe ?? [])],
    [kundenaufgabePosten, quellen.aufgabe],
  )
  /**
   * Die Spur-Listen als STABILE Referenzen.
   *
   * Bis zum 25.08. stand hier `quellen.antwort ?? []` — ein neues Array bei
   * jedem Render, sobald die Quelle leer war. Das war harmlos, solange die
   * Listen nur angezeigt wurden. Mit dem Canvas hängt daran eine Rechnung
   * über 1.788 Leads (`funnelKarten` ruft je Lead `leadStation` auf): Ein
   * frisches Array pro Render hätte jedes `useMemo` darüber wertlos gemacht
   * und die ganze Kette bei jedem Tastendruck neu gerechnet.
   */
  const kundeLiegtListe = useMemo(() => quellen.kunde_liegt ?? [], [quellen.kunde_liegt])
  const antwortListe = useMemo(() => quellen.antwort ?? [], [quellen.antwort])
  const loomListe = useMemo(() => quellen.loom ?? [], [quellen.loom])
  const followupListe = useMemo(() => quellen.followup ?? [], [quellen.followup])
  const erstnachrichtListe = useMemo(() => quellen.erstnachricht ?? [], [quellen.erstnachricht])

  /**
   * Der Bestand des Canvas kommt aus einer anderen Quelle als das Tagespensum,
   * und das ist Absicht: `usePosten` beantwortet „was ist heute zu tun",
   * `useLeads` beantwortet „wer steckt wo". Beide Fragen brauchen einander
   * nicht — nur die Karte stellt sie nebeneinander.
   *
   * Dass hier 1.700 Leads und über 2.000 Ereignisse geladen werden, ist der
   * Preis dafür. `/linkedin` zahlt ihn seit dem 20.08. schon; ein zweiter,
   * abgespeckter Ladeweg wäre eine zweite Wahrheit über denselben Bestand.
   */
  const leadsQuery = useLeads(slug)
  const threadsJeLead = useMemo(() => {
    const karte = new Map<string, LinkedinThread>()
    // Ohne diese Zuordnung schickt `leadStation` jeden Lead in den stillen
    // Zweig — auch den, mit dem Kevin längst schreibt (dieselbe Stelle wie in
    // LinkedinArea.tsx).
    for (const t of linkedinThreads.items) if (t.lead_id) karte.set(t.lead_id, t)
    return karte
  }, [linkedinThreads.items])

  const funnelLeads = useMemo<FunnelLead[]>(
    () =>
      leadsQuery.leads.map((l) => ({
        id: l.id,
        name: l.name,
        headline: l.headline,
        lead_status: l.lead_status,
        wiedervorlage_am: l.wiedervorlage_am,
        ereignisse: (leadsQuery.ereignisseJeLead.get(l.id) ?? []).map((e) => ({ typ: e.typ, at: e.at })),
        thread: threadsJeLead.get(l.id) ?? null,
      })),
    [leadsQuery.leads, leadsQuery.ereignisseJeLead, threadsJeLead],
  )

  /**
   * Der Tages-Flow — dieselbe Rechnung wie im Hero und im Zähl-Modus, gefüttert
   * aus DENSELBEN Listen, die sich hinter den Zeilen öffnen („eine Abfrage,
   * eine Zahl"). `useTagesFlow` friert dabei die Tagesportionen ein (0074).
   */
  const flowLive = useMemo(() => flowQuellen(quellen, jetzt), [quellen, jetzt])
  const flow = useTagesFlow(metrics.today, flowLive, postenLaedt || metrics.loading)
  const staende = flow.staende
  const standJeStufe = useMemo(() => {
    const map = new Map<StufenId, StufenStand>()
    for (const s of staende) map.set(s.stufe.id, s)
    return map
  }, [staende])
  const aktivIndex = flow.laedt ? -2 : ersteOffeneStufe(staende)

  /** Serien je Zähl-Stufe — aus Metrik-Historie und eingefrorenen Portionen. */
  const heuteIso = heutigesMetrikDatum()
  const streakDaten = useMemo(
    () => bereiteDatenVor(metrics.windowRows, flow.portionen.historie),
    [metrics.windowRows, flow.portionen.historie],
  )
  const serieFuer = useCallback(
    (stufe: Stufe): SalesStreak | undefined =>
      stufe.feld === null || flow.portionen.tableMissing && stufe.standardZiel === null
        ? undefined
        : salesSerie(stufe, heuteIso, streakDaten),
    [heuteIso, streakDaten, flow.portionen.tableMissing],
  )

  // Daten-Frische: die Zahlen sind nur so jung wie der letzte Sync. Ohne den
  // Hinweis liest sich eine alte 18 wie eine falsche 18.
  const postfachStand = useMemo(() => {
    let max: string | null = null
    for (const t of linkedinThreads.items) {
      // `last_synced_at` setzt der Chrome-Sync (runner/linkedin/sync.mjs) —
      // der ehrlichste Stempel dafür, wie alt diese Zahlen wirklich sind.
      if (t.last_synced_at && (!max || t.last_synced_at > max)) max = t.last_synced_at
    }
    return max
  }, [linkedinThreads.items])

  /**
   * InMail-Pool (18.08.): der Stand trägt jetzt ein Datum, die Anzeige zieht
   * seither gebuchte InMails ab. Der alte, datumslose Schlüssel bleibt als
   * Startwert lesbar — beim ersten Speichern wandert alles auf den neuen.
   */
  const { wert: altCredits } = useUiSetting<number>('sales.inmailCredits', INMAIL_CREDITS_STAND)
  const { wert: inmailStandRoh, setzen: setzeInmailStand } = useUiSetting<InmailStand | null>(
    'sales.inmailStand',
    null,
  )
  const inmailStand = inmailStandRoh ?? ausAltemWert(altCredits)
  const reaktivierungsStand = standJeStufe.get('reaktivierung')
  const inmailPool = useMemo(
    () => poolAbleitung(inmailStand, metrics.windowRows, reaktivierungsStand?.soll ?? 0),
    [inmailStand, metrics.windowRows, reaktivierungsStand?.soll],
  )

  /**
   * Die Follow-up-Portion als Liste: nur so viele Namen, wie heute noch dran
   * sind. Der Berg dahinter bleibt bewusst unsichtbar — er steht als eine
   * ruhige Zahl in der Unterzeile, nicht als 200 Zeilen im Fenster.
   */
  const followupStand = standJeStufe.get('followups')
  const followupPortionsListe = useMemo(() => {
    if (!followupStand) return followupListe
    const rest = Math.max(0, followupStand.soll - followupStand.wert)
    return followupListe.slice(0, rest)
  }, [followupListe, followupStand])
  const followupRueckstand = Math.max(0, followupListe.length - followupPortionsListe.length)

  // Vollbild-Arbeitsmodus ist ein Handy-Werkzeug — am Desktop passiert die
  // Arbeit in der Liste im Zeilen-Fenster.
  const oeffneArbeitsmodus = useCallback((spur: Spur | 'alle', liste: Posten[]) => {
    const echte = liste.filter((p) => !p.nurZaehler)
    if (echte.length === 0) return
    setOffenKachelId(null)
    setArbeitsmodus({ spur, posten: echte })
  }, [])

  const schreibeDauer = useCallback(
    async (input: { spur: Spur; postenId: string; sekunden: number }) => {
      // Nur echte Arbeitszeit messen — 0 Sekunden heißt: direkt weggehakt,
      // ohne den Posten zu öffnen. Das würde den Median nur verfälschen.
      if (input.sekunden <= 0) return
      if (!supabase || !activeBrand?.id) return
      const { error } = await supabase.from('arbeits_dauern').insert({
        brand_id: activeBrand.id,
        spur: input.spur,
        posten_id: input.postenId,
        sekunden: input.sekunden,
      })
      if (error) console.warn('arbeits_dauern insert fehlgeschlagen:', error.message)
    },
    [activeBrand?.id],
  )

  const onArbeitsmodusErledigt = useCallback(
    (ergebnis: ArbeitsmodusErgebnis) => {
      void erledigePosten(ergebnis, {
        bump: metrics.bump,
        erstnachrichtGesendet: (id) => erstnachrichten.setzeStatus(id, 'gesendet'),
        followupErledigt: (id) => {
          const thread = linkedinThreads.items.find((t) => t.id === id)
          if (thread) return linkedinThreads.markDone(thread)
        },
        loomVerschickt: (id) => linkedinThreads.markLoomVerschickt(id),
        taskErledigt: (id) => tasks.toggle(id),
        schreibeDauer,
      })
    },
    [metrics.bump, erstnachrichten, linkedinThreads, tasks, schreibeDauer],
  )

  const aktiveAgenten = useMemo(() => runs.filter((r) => r.status === 'running').map((r) => r.agent), [runs])
  const loomLaeuft = aktiveAgenten.includes('loom-skript')

  // Sales-Bibliothek (generierte Loom-Skripte) — geladen, sobald Looms
  // sichtbar werden, und neu geladen, wenn ein loom-skript-Lauf fertig ist.
  const [library, setLibrary] = useState<SalesLibrary | null>(null)
  const [loomFehler, setLoomFehler] = useState<string | null>(null)
  const [loomAngefordert, setLoomAngefordert] = useState<Set<string>>(new Set())
  /** Nur die Lücke zwischen Klick und „Auftrag angenommen": auf der Live-Domain
      läuft der Start über die Runner-Brücke und braucht ein paar Sekunden. Den
      Rest meldet seit dem Runs-Spiegel das echte Signal (`loomLaeuft`). */
  const [loomStartet, setLoomStartet] = useState(false)

  const ladeLibrary = useCallback(async () => {
    try {
      setLibrary(await fetchSalesLibrary())
    } catch {
      // Runner/Spiegel nicht erreichbar — die Knöpfe zeigen den Zustand.
    }
  }, [])

  const loomsSichtbar = offenKachelId === 'looms' || arbeitsmodus?.spur === 'loom' || arbeitsmodus?.spur === 'alle'
  useEffect(() => {
    if (loomsSichtbar) void ladeLibrary()
  }, [loomsSichtbar, ladeLibrary])

  const loomLiefZuvor = useRef(false)
  useEffect(() => {
    if (loomLiefZuvor.current && !loomLaeuft) void ladeLibrary()
    loomLiefZuvor.current = loomLaeuft
  }, [loomLaeuft, ladeLibrary])

  /** Neuestes Loom-Skript zu diesem Posten aus der Bibliothek, sonst null. */
  const loomSkript = useCallback(
    (p: Posten) =>
      (library?.skripte ?? [])
        .filter(
          (s) =>
            s.kind === 'html' &&
            s.name.startsWith('Loom-Skript') &&
            s.name.toLowerCase().includes(`(${p.name.toLowerCase()})`),
        )
        .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())[0] ?? null,
    [library],
  )

  // Nach einem fertigen Lauf steht das Skript zwar in der Bibliothek, im
  // Datei-Spiegel aber erst beim nächsten Runner-Tick. Solange nachladen, bis
  // die URL da ist — sonst bliebe „wird gerade gespiegelt" stehen, bis Kevin den
  // Bereich verlässt und neu betritt. Lokal ist die URL sofort da: nie aktiv.
  const wartetAufSpiegel = useMemo(
    () =>
      loomsSichtbar &&
      loomListe.some((p) => {
        const s = loomSkript(p)
        return s !== null && salesFileUrl(s.rel) === null
      }),
    [loomsSichtbar, loomListe, loomSkript],
  )

  useEffect(() => {
    if (!wartetAufSpiegel) return
    const id = window.setInterval(() => void ladeLibrary(), 20_000)
    return () => window.clearInterval(id)
  }, [wartetAufSpiegel, ladeLibrary])

  const loomAktionen: LoomSkriptAktionen = useMemo(
    () => ({
      skriptUrl: (p) => {
        const treffer = loomSkript(p)
        return treffer ? salesFileUrl(treffer.rel) : null
      },
      skriptVorhanden: (p) => loomSkript(p) !== null,
      generiere: (p) => {
        setLoomFehler(null)
        setLoomAngefordert((prev) => new Set(prev).add(p.id))
        setLoomStartet(true)
        // profile_url (LinkedIn) ist keine analysierbare Firmen-Website —
        // dann recherchiert der Agent selbst.
        const website = p.website && !p.website.includes('linkedin.com') ? p.website : undefined
        void postRun('loom-skript', { name: p.name, ...(website ? { website } : {}) })
          .then(() => refreshRuns())
          .catch((e) => {
            setLoomFehler((e as Error).message)
            // sonst zeigt dieser Posten bei jedem späteren Lauf fälschlich „wird generiert"
            setLoomAngefordert((prev) => {
              const next = new Set(prev)
              next.delete(p.id)
              return next
            })
          })
          .finally(() => setLoomStartet(false))
      },
      laeuft: loomLaeuft || loomStartet,
      angefordert: (p) => loomAngefordert.has(p.id),
      verfuegbar: runner.state === 'online',
      fehler: loomFehler,
    }),
    [loomSkript, loomLaeuft, loomStartet, loomAngefordert, loomFehler, runner.state, refreshRuns],
  )

  const projektLink = useCallback(
    (p: Posten) => {
      // `kunde_liegt` traegt die Projekt-Id schon in der Posten-Id
      // (`liegt:<projektId>`, kundenarbeit.ts). Der Umweg ueber `tasks` fand
      // dafuer nie etwas — dort steht eine Aufgaben-Id, keine Projekt-Id.
      if (p.spur === 'kunde_liegt') {
        const projektId = zeilenId(p.id)
        return projektId ? `/projekte/${projektId}` : null
      }
      const task = tasks.items.find((t) => t.id === zeilenId(p.id))
      // Die Projekte leben im Cockpit; die alte /brand/…/deliver-Welt ist weg.
      return task?.project_id ? `/projekte/${task.project_id}` : null
    },
    [tasks.items],
  )

  const navigiere = useCallback(
    (route: string) => {
      setOffenKachelId(null)
      navigate(route)
    },
    [navigate],
  )

  /**
   * v2 (f): „→ morgen" hinter dem Wischen. Es gibt genau einen bestehenden
   * Verschiebe-Pfad, und der gilt für LinkedIn-Threads: `snooze` setzt
   * `snoozed_until` (dieselbe Stelle und dieselbe Tagesdistanz wie
   * LinkedinArea.tsx:347). Posten anderer Spuren haben keinen — dort erscheint
   * die Aktion gar nicht erst, statt einen zweiten Verschiebe-Begriff zu
   * erfinden.
   */
  const morgenAktion = useMemo(
    () => ({
      moeglich: (p: Posten) => p.id.startsWith('thread:'),
      verschiebe: (p: Posten) => {
        const threadId = p.id.slice('thread:'.length)
        if (!threadId) return
        void linkedinThreads.snooze(threadId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      },
    }),
    [linkedinThreads],
  )

  const liste = useCallback(
    (posten: Posten[]) => () => (
      <Arbeitsliste
        posten={posten}
        onErledigt={onArbeitsmodusErledigt}
        onZaehler={() => setOffenKachelId('vernetzungsanfragen')}
        morgen={morgenAktion}
        loom={loomAktionen}
        projektLink={projektLink}
        onNavigiere={navigiere}
      />
    ),
    [onArbeitsmodusErledigt, morgenAktion, loomAktionen, projektLink, navigiere],
  )

  /** Am Handy: „Arbeitsmodus starten" im Fenster-Fuß — am Desktop bewusst nicht. */
  const mobilArbeitsmodus = useCallback(
    (spur: Spur | 'alle', posten: Posten[]) =>
      isMobile && posten.length > 0
        ? { label: 'Arbeitsmodus starten', onClick: () => oeffneArbeitsmodus(spur, posten) }
        : undefined,
    [isMobile, oeffneArbeitsmodus],
  )

  /**
   * Solange die Quellen laden, steht auf jeder Zeile ein Platzhalter statt
   * einer Zahl. „0 offen" und „steht" sind sonst schlicht falsch — und
   * „alles erledigt" ist die teuerste falsche Zahl, die hier stehen kann.
   */
  const zahl = (text: string) => (flow.laedt ? '…' : text)

  /** Der Zeilen-Zustand aus dem Stufen-Stand — die erste offene ist „dran". */
  const zustandVon = (stufeId: StufenId): FlowZeileDef['zustand'] => {
    const index = staende.findIndex((s) => s.stufe.id === stufeId)
    const eintrag = staende[index]
    if (!eintrag || flow.laedt) return 'offen'
    if (eintrag.erledigt) return 'erledigt'
    return index === aktivIndex ? 'aktiv' : 'offen'
  }

  const zuerst = (liste: Posten[]): string | undefined =>
    liste[0] ? `zuerst: ${liste[0].firma ? `${liste[0].firma} — ` : ''}${liste[0].name}` : undefined

  const anfragenStand = standJeStufe.get('anfragen')
  const erstnachrichtStand = standJeStufe.get('erstnachrichten')
  const antwortenStand = standJeStufe.get('antworten')
  const loomsStand = standJeStufe.get('looms')

  /**
   * Wer geantwortet hat, aber nicht Kevins Zielgruppe ist (18.08.2026).
   * Nicht weggeworfen, sondern eine Klappe tiefer — die Zeile nennt die Zahl,
   * damit der Filter prüfbar bleibt. Ein Filter, dem man nicht auf die Finger
   * schauen kann, wird zu Recht nicht geglaubt.
   */
  const ausgeblendetListe = useMemo(
    () => antwortPostenAusgeblendet(linkedinThreads.items, jetzt),
    [linkedinThreads.items, jetzt],
  )

  const antwortenAelteste = flowLive.antworten?.aeltesteStunden ?? null
  const antwortenAbgestanden = antwortenAelteste !== null && antwortenAelteste >= 24

  /**
   * WER am längsten wartet, nicht nur wie lange (19.08.2026).
   *
   * „älteste 219 Tage" war Kevins Frage: „Welcher von denen ist jetzt 219 Tage
   * alt?" Eine Zahl ohne Namen zwingt zum Aufklappen und Suchen — und wirkt
   * dabei wie ein Alarm, obwohl dahinter meist ein Altfall steht. Mit dem Namen
   * ist die Zeile in einem Blick erledigt.
   */
  const antwortenAeltester = useMemo(() => {
    let aeltester: Posten | null = null
    let aeltesteZeit = Number.POSITIVE_INFINITY
    for (const p of antwortListe) {
      const t = p.timestamp ? new Date(p.timestamp).getTime() : Number.NaN
      if (!Number.isFinite(t) || t >= aeltesteZeit) continue
      aeltesteZeit = t
      aeltester = p
    }
    return aeltester
  }, [antwortListe])

  /** Die sechs Zeilen des Rituals — Reihenfolge ist `TAGES_FLOW`, nicht Meinung. */
  const flowZeilen: FlowZeileDef[] = TAGES_FLOW.map((stufe, index): FlowZeileDef => {
    const nummer = index + 1
    const basis = { nummer, zustand: zustandVon(stufe.id), streak: serieFuer(stufe), titel: stufe.langLabel }

    switch (stufe.id) {
      case 'anfragen':
        return {
          ...basis,
          id: 'vernetzungsanfragen',
          kennzahl: `${anfragenStand?.wert ?? 0} von ${anfragenStand?.soll ?? 0}`,
          unterzeile: 'Zähler — das Ritual läuft direkt auf LinkedIn.',
          inhalt: () => (
            <AnfragenZaehler
              heute={anfragenStand?.wert ?? 0}
              limit={anfragenStand?.soll ?? 0}
              onPlus={() => metrics.bump('li_anfragen', 1)}
              onMinus={() => {
                if ((anfragenStand?.wert ?? 0) > 0) metrics.bump('li_anfragen', -1)
              }}
            />
          ),
        }
      case 'erstnachrichten':
        return {
          ...basis,
          id: 'erstnachrichten',
          kennzahl: erstnachrichten.tableMissing
            ? 'Migration 0060 ausstehend'
            : zahl(`${erstnachrichtStand?.wert ?? 0} von ${erstnachrichtStand?.soll ?? 0}`),
          unterzeile: zuerst(erstnachrichtListe) ?? 'Wer angenommen hat, bekommt seine Nachricht.',
          inhalt: liste(erstnachrichtListe),
          fensterAktion: mobilArbeitsmodus('erstnachricht', erstnachrichtListe),
        }
      case 'antworten':
        return {
          ...basis,
          id: 'antworten',
          kennzahl: linkedinThreads.tableMissing
            ? 'Migration 0058 ausstehend'
            : zahl(
                (antwortenStand?.wert ?? 0) === 0
                  ? 'Niemand wartet'
                  : `${antwortenStand?.wert} warten · am längsten ${
                      antwortenAeltester ? antwortenAeltester.name : 'unbekannt'
                    }${
                      antwortenAelteste === null
                        ? ''
                        : antwortenAelteste < 48
                          ? ` (${Math.max(1, Math.round(antwortenAelteste))} h)`
                          : ` (${Math.round(antwortenAelteste / 24)} Tage)`
                    }`,
              ),
          kennzahlFarbe: !flow.laedt && antwortenAbgestanden ? 'var(--ck-warn)' : undefined,
          unterzeile:
            ausgeblendetListe.length > 0
              ? `${zuerst(antwortListe) ?? 'Reaktionszeit zählt'} · ${ausgeblendetListe.length} ausgeblendet`
              : (zuerst(antwortListe) ?? 'Reaktionszeit zählt — nicht die Menge.'),
          inhalt: () => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {liste(antwortListe)()}
              {ausgeblendetListe.length > 0 ? (
                <details>
                  <summary
                    style={{ fontSize: 12, color: 'var(--ck-text-3)', cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}
                  >
                    {ausgeblendetListe.length} weitere haben geantwortet — nicht deine Zielgruppe oder von vor der Makler-Akquise
                  </summary>
                  <div style={{ marginTop: 8 }}>{liste(ausgeblendetListe)()}</div>
                </details>
              ) : null}
            </div>
          ),
          fensterAktion: mobilArbeitsmodus('antwort', antwortListe),
        }
      case 'followups':
        return {
          ...basis,
          id: 'followups',
          kennzahl: linkedinThreads.tableMissing
            ? 'Migration 0058 ausstehend'
            : zahl(`${followupStand?.wert ?? 0} von ${followupStand?.soll ?? 0}`),
          unterzeile:
            followupRueckstand > 0
              ? `Portion für heute — ${followupRueckstand} weitere warten im Rückstand.`
              : (zuerst(followupPortionsListe) ?? 'Chats ohne Antwort — die heutige Portion.'),
          inhalt: () => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {liste(followupPortionsListe)()}
              {followupRueckstand > 0 ? (
                <p style={{ fontSize: 12, color: 'var(--ck-text-3)', margin: 0 }}>
                  {followupRueckstand} weitere sind fällig, aber nicht Teil der heutigen Portion — sie
                  kommen morgen in 20er-Schritten dran. Der Berg schrumpft, ohne dich zu erschlagen.
                </p>
              ) : null}
            </div>
          ),
          fensterAktion: mobilArbeitsmodus('followup', followupPortionsListe),
        }
      case 'reaktivierung':
        return {
          ...basis,
          id: 'inmails',
          kennzahl: zahl(
            `${reaktivierungsStand?.wert ?? 0} von ${reaktivierungsStand?.soll ?? 0} · Pool ≈ ${inmailPool.pool}`,
          ),
          unterzeile: 'Nie angenommene Anfragen — die InMail-Welle.',
          inhalt: () => (
            <InmailPanel
              stand={inmailStand}
              abgeleitet={inmailPool}
              tagesration={reaktivierungsStand?.soll ?? 0}
              heuteGebucht={reaktivierungsStand?.wert ?? 0}
              onBuchen={(delta) => {
                if (delta === -1 && (reaktivierungsStand?.wert ?? 0) <= 0) return
                metrics.bump('inmails', delta)
              }}
              onSpeichern={(neu) => setzeInmailStand({ wert: neu, standVom: heuteIso })}
            />
          ),
        }
      case 'looms':
        return {
          ...basis,
          id: 'looms',
          kennzahl: linkedinThreads.tableMissing
            ? 'Migration 0061 ausstehend'
            : zahl(`${loomsStand?.wert ?? 0} von ${loomsStand?.soll ?? 0}`),
          unterzeile:
            loomListe.length > 0
              ? `${loomListe.length} zugesagt und offen — Stern = Ja zur Analyse.`
              : 'Zugesagte Analysen aufnehmen und rausschicken.',
          inhalt: liste(loomListe),
          fensterAktion: mobilArbeitsmodus('loom', loomListe),
        }
    }
  })

  /**
   * Die Wochenkontrolle (19.08.2026) — die Gegenprobe zu allen Filtern.
   *
   * Kevins Bauchschmerz: „Ich bin mir nicht sicher, ob die Leute, die in die
   * Liste rein müssen, auch wirklich reingekommen sind." Jede andere Zeile
   * zeigt, wer drin ist; diese zeigt, wer NICHT angeschrieben wurde und warum.
   * Bewusst „neben dem Ritual" und ohne Alarm-Optik: sie ist eine Prüfung für
   * den Freitag, kein Posten für heute.
   */
  const kontrolle = useMemo(
    () =>
      wochenkontrolle(
        netzwerk.items,
        linkedinThreads.items,
        erstnachrichten.items,
        jetzt,
      ),
    [netzwerk.items, linkedinThreads.items, erstnachrichten.items, jetzt],
  )

  /**
   * Der Projekte-Block — bewusst UNTER dem Ritual und bewusst leise: bei
   * Reichentrog wartet Kevin auf den Kollegen, da ist kein Handgriff. Eine
   * Alarm-Optik hier wäre Druck ohne Funktion (Kevins Wort vom 18.08.:
   * „zu präsent"). Die Kachel-IDs bleiben, damit /sales?kachel=… und das
   * Heute-Deck weiter treffen.
   */
  const projektZeilen: FlowZeileDef[] = [
    {
      id: 'kundenarbeit',
      titel: 'Projekte',
      zustand: 'ruhig',
      kennzahl: zahl(
        kundenarbeitPosten.length === 0
          ? 'Nichts offen'
          : `${kundenarbeitPosten.length} Aufgabe${kundenarbeitPosten.length === 1 ? '' : 'n'} offen`,
      ),
      unterzeile: zuerst(kundenarbeitPosten),
      inhalt: liste(kundenarbeitPosten),
      fensterAktion: mobilArbeitsmodus('kundenaufgabe', kundenarbeitPosten),
    },
    {
      id: 'liegt-zu-lange',
      titel: 'Liegt still',
      zustand: 'ruhig',
      kennzahl: zahl(
        liegend.length === 0
          ? 'Nichts liegt'
          : `${liegend.length} Projekt${liegend.length === 1 ? '' : 'e'} ohne Bewegung`,
      ),
      unterzeile: liegend.length > 0 ? 'Ansehen — nachfassen oder bewusst warten.' : undefined,
      inhalt: liste(kundeLiegtListe),
      fensterAktion: mobilArbeitsmodus('kunde_liegt', kundeLiegtListe),
    },
    {
      id: 'wochenkontrolle',
      titel: 'Wochenkontrolle',
      zustand: 'ruhig',
      kennzahl: zahl(
        kontrolle.alle.length === 0
          ? 'Keine Annahmen'
          : `${kontrolle.alle.length} angenommen · ${kontrolle.angeschrieben.length} angeschrieben` +
              (kontrolle.aussortiert.length > 0 ? ` · ${kontrolle.aussortiert.length} aussortiert` : ''),
      ),
      unterzeile:
        kontrolle.aussortiert.length > 0
          ? 'Prüfen, ob unter den Aussortierten ein Makler steht.'
          : 'Sieben Tage: wer angenommen hat und wer angeschrieben wurde.',
      inhalt: () => <WochenkontrolleTafel kontrolle={kontrolle} />,
    },
  ]

  /* ── Das Sales-Canvas ─────────────────────────────────────────────────
   *
   * Der Funnel als Karten: je Karte „wie viele stecken hier" plus „wie viele
   * heute". Die Rechnung liegt in `lib/funnelKarten.ts`; hier wird nur
   * verdrahtet, welche Namensliste sich hinter welcher Karte öffnet.
   */

  /** Follow-up-Stufe je Thread — sie entscheidet, welcher der drei Texte gilt. */
  const stufeJeThread = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of linkedinThreads.items) m.set(t.id, t.followup_stage)
    return m
  }, [linkedinThreads.items])

  /**
   * Die heutige Portion, nach Stufe getrennt.
   *
   * **Die Drossel bleibt eine.** Aufgeteilt wird `followupPortionsListe`, nicht
   * der ganze Rückstand: Die drei Karten sind drei Texte für ein Pensum, nicht
   * dreimal 20 Follow-ups. Wer hier `followupListe` einsetzt, hebelt die
   * Tagesportion aus und legt Kevin wieder 177 Namen hin.
   */
  const followupPortionJeStufe = useMemo(() => {
    const m = new Map<number, Posten[]>([
      [0, []],
      [1, []],
      [2, []],
    ])
    for (const p of followupPortionsListe) {
      const stufe = stufeJeThread.get(zeilenId(p.id))
      // Eine andere Stufe kann hier nicht stehen (`isDue` lässt nur 0–2 fällig
      // werden). Falls doch je eine kaputte Zahl in der Zeile steht, landet der
      // Posten auf der ersten Karte — lieber der falsche Text als ein Lead, der
      // aus allen drei Fenstern verschwindet.
      m.get(stufe === 1 || stufe === 2 ? stufe : 0)!.push(p)
    }
    return m
  }, [followupPortionsListe, stufeJeThread])

  /**
   * Welche Arbeitsliste liegt hinter welcher Karte?
   *
   * Nur die fünf Karten, für die es eine Posten-Quelle gibt. Die Stationen aus
   * 0078 (Instagram, PDF, Postkarte, Anruf) haben noch keine — sie zeigen
   * ihren Bestand und bleiben vorerst unklickbar. Wer sie sehen will, findet
   * sie mit Namen und CSV-Export in der Pipeline unter /linkedin.
   */
  const listeJeKarte = useMemo(() => {
    const m = new Map<FunnelKartenId, Posten[]>()
    m.set('erstnachricht_faellig', erstnachrichtListe)
    m.set('antwort_da', antwortListe)
    m.set('loom_offen', loomListe)
    m.set('followup_0', followupPortionJeStufe.get(0) ?? [])
    m.set('followup_1', followupPortionJeStufe.get(1) ?? [])
    m.set('followup_2', followupPortionJeStufe.get(2) ?? [])
    return m
  }, [erstnachrichtListe, antwortListe, loomListe, followupPortionJeStufe])

  /**
   * Vier Karten öffnen ein Fenster, das es schon gibt — samt Anfragen-Zähler,
   * ausgeblendeten Antworten und „Arbeitsmodus starten" am Handy. Die alten
   * Kachel-Kennungen bleiben damit gültig, und `/sales?kachel=antworten` aus
   * dem Heute-Deck trifft weiter.
   */
  const ALT_KACHEL: Partial<Record<FunnelKartenId, string>> = {
    anfrage_offen: 'vernetzungsanfragen',
    erstnachricht_faellig: 'erstnachrichten',
    antwort_da: 'antworten',
    loom_offen: 'looms',
  }

  /**
   * Die alten Flow-Balken sind seit dem Canvas eine Rückfrage, kein Ausgangspunkt:
   * Sie zeigen dasselbe Tagespensum, das oben schon an den Karten steht. Sie
   * bleiben trotzdem — die InMail-Welle und der Anfragen-Zähler wohnen dort,
   * und die Serien („n Werktage in Folge") gibt es auf den Karten nicht.
   *
   * Der Zustand liegt in `ui_settings` (0068), damit er das Löschen-und-neu-
   * Hinzufügen der PWA überlebt. **Nie ungeprüft übernehmen:** Der Wert kommt
   * aus einer Key-Value-Tabelle und war dort schon alles Mögliche. `=== true`
   * statt Truthiness — sonst klappte ein versehentliches `"nein"` die Balken auf.
   */
  const { wert: balkenRoh, setzen: setzeBalken } = useUiSetting<boolean>('salesBalkenOffen', false)
  const balkenOffen = balkenRoh === true

  /** Wie viele Menschen stehen überhaupt in Kevins Kosmos — inklusive der Aussortierten. */
  const leadZahl = leadsQuery.leads.length
  const tagesFortschritt = flowFortschritt(staende)

  const rohKarten = useMemo(
    () => funnelKarten({ leads: funnelLeads, staende, jetzt }),
    [funnelLeads, staende, jetzt],
  )

  /**
   * „eine Abfrage, eine Zahl": Wo eine Liste hinter der Karte liegt, IST die
   * Zahl auf dem Badge deren Länge — nicht eine zweite Rechnung daneben. Ohne
   * das stünde auf der Follow-up-Karte „63 dran" und im Fenster lägen vier
   * Namen, weil die Tagesportion dazwischen drosselt.
   */
  const karten = useMemo(
    () =>
      rohKarten.map((k) => {
        const l = listeJeKarte.get(k.id)
        return l ? { ...k, heuteFaellig: l.length } : k
      }),
    [rohKarten, listeJeKarte],
  )

  /** Die Fenster der drei Follow-up-Karten — Text oben, Namen darunter. */
  const followupKacheln: KachelDef[] = karten
    .filter((k) => k.stufenId === 'followups')
    .map((k): KachelDef => {
      const posten = listeJeKarte.get(k.id) ?? []
      return {
        id: k.id,
        titel: k.titel,
        kennzahl: zahl(`${posten.length} heute · ${k.bestand} in dieser Stufe`),
        inhalt: () => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {k.vorlage ? <VorlagenKopf text={k.vorlage} /> : null}
            {liste(posten)()}
          </div>
        ),
        fensterAktion: mobilArbeitsmodus('followup', posten),
      }
    })

  const alleZeilen = [...flowZeilen, ...projektZeilen]
  const offenKachel =
    alleZeilen.find((k) => k.id === offenKachelId) ??
    followupKacheln.find((k) => k.id === offenKachelId) ??
    null

  /**
   * Die Ansage trägt nur, wenn sie mehr sagt als die Kennzahl. Ohne genug
   * Messwerte in `arbeits_dauern` liefert `tagesansage` genau „185 offen" —
   * dieselbe Zeichenkette, die schon groß darüber steht.
   */
  const ansage = geordnet.length ? tagesansage(geordnet, dauern, jetzt) : undefined
  const frische = vorZeit(postfachStand)

  const oeffneKachel = useCallback(
    /** `von` ist die `layoutId` des Auslösers — ohne sie wächst das Fenster aus dem Nichts. */
    (id: string, von?: string) => {
      // Der Anfragen-Zähler ist am Handy ein Vollbild mit einem Knopf —
      // genau dafür war das Vollbild gedacht, nirgendwo sonst.
      if (id === 'vernetzungsanfragen' && isMobile) {
        setAnfragenVollbild(true)
        return
      }
      setOffenVon(von ?? null)
      setOffenKachelId(id)
    },
    [isMobile],
  )

  // Sprung aus dem Heute-Deck: `/sales?kachel=antworten` öffnet direkt das
  // zuständige Fenster. Der Parameter wird danach entfernt, sonst öffnete sich
  // die Zeile nach jedem Schließen wieder. `kachel=jetzt-dran` (alte Links aus
  // Heute-Deck und /morgen) heisst seit dem Umbau: die erste offene Zeile.
  const [suchParams, setSuchParams] = useSearchParams()
  const kachelParam = suchParams.get('kachel')
  const modusParam = suchParams.get('modus')
  useEffect(() => {
    if (!kachelParam && !modusParam) return

    // O3 Zug 7: `?modus=arbeit` kommt vom „Loslegen" auf /morgen. Am Handy
    // öffnet es direkt den Arbeitsmodus statt des Zeilen-Fensters — der Weg vom
    // Push zum ersten Posten soll zwei Tipps lang sein, nicht drei.
    //
    // Der Effekt darf NICHT feuern, solange die Posten noch laden: sonst stünde
    // „Alles abgearbeitet" vor einer Liste, die gleich kommt. Dann lieber den
    // Parameter stehen lassen und beim nächsten Durchlauf erneut prüfen.
    if (modusParam === 'arbeit' && isMobile) {
      // O18: nicht nur "nicht leer", sondern "fertig geladen". Die Quellen
      // kommen nacheinander an; bei 209 Posten stand sonst "1 / 2" im
      // Arbeitsmodus, weil der Effekt nach der ersten Antwort feuerte.
      if (postenLaedt || geordnet.length === 0) return
      oeffneArbeitsmodus('alle', geordnet)
    } else if (kachelParam === 'jetzt-dran') {
      // Alte Links: „Jetzt dran" gibt es nicht mehr als Kachel — dran ist die
      // erste offene Zeile des Rituals. Solange der Flow lädt: warten.
      if (flow.laedt) return
      const ziel = aktivIndex >= 0 ? flowZeilen[aktivIndex] : null
      // Ohne Auslöser im Bild gibt es nichts, woraus das Fenster wachsen könnte.
      if (ziel) oeffneKachel(ziel.id)
    } else if (kachelParam && alleZeilen.some((k) => k.id === kachelParam)) {
      oeffneKachel(kachelParam)
    }

    const next = new URLSearchParams(suchParams)
    next.delete('kachel')
    next.delete('modus')
    setSuchParams(next, { replace: true })
    // Die Zeilen werden bei jedem Render neu gebaut — die Abhängigkeit ist
    // bewusst nur der Parameter (plus das, was über „noch nicht geladen"
    // entscheidet), sonst liefe der Effekt endlos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kachelParam, modusParam, isMobile, geordnet.length, postenLaedt, flow.laedt, aktivIndex])


  return (
    <MotionConfig reducedMotion="user">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
        {/* Kopf: Tagesansage + Daten-Frische — eine Zeile, keine Kachel. */}
        {(ansage && ansage !== `${geordnet.length} offen`) || frische ? (
          <div
            className="ck-label"
            style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}
          >
            <span>{!postenLaedt && ansage && ansage !== `${geordnet.length} offen` ? ansage : ''}</span>
            {frische ? <span title="Letzter Postfach-Sync">Postfach-Stand: {frische}</span> : null}
          </div>
        ) : null}

        {/* Die eine Zeile über dem Funnel: wie groß ist der Kosmos, und wie
            weit ist der Tag. Bewusst keine Kachel — sie steht über allem und
            konkurriert nicht mit den Karten darunter. */}
        <div
          className="ck-zahl"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            fontSize: 13,
            color: 'var(--ck-text-2)',
            paddingInline: 4,
          }}
        >
          <span>
            {leadsQuery.loading ? '…' : leadZahl.toLocaleString('de-DE')} Leads im Kosmos
          </span>
          <span style={{ color: flow.laedt ? 'var(--ck-text-3)' : undefined }}>
            {flow.laedt
              ? 'Tag lädt …'
              : `Tag ${tagesFortschritt.erledigt} von ${tagesFortschritt.gesamt}`}
          </span>
        </div>

        {/* Das Canvas: der Funnel als Karten. Bestand rechts, Tagespensum
            klein darunter — die Balken darunter zeigen dasselbe Pensum noch
            einmal, bis Z4 sie einklappt. */}
        {leadsQuery.tableMissing ? null : leadsQuery.loading ? (
          <div style={{ fontSize: 12, color: 'var(--ck-text-3)', padding: '10px 4px' }}>Bestand lädt …</div>
        ) : (
          <FunnelCanvas
            karten={karten}
            onOeffnen={(k) => oeffneKachel(ALT_KACHEL[k.id] ?? k.id, `canvas-${k.id}`)}
            // Öffenbar ist, wofür es eine Arbeitsliste oder ein bestehendes
            // Fenster gibt. Eine Karte, die auf Klick nichts zeigt, ist
            // schlimmer als eine, die gar nicht erst klickbar aussieht.
            oeffenbar={(k) => listeJeKarte.has(k.id) || ALT_KACHEL[k.id] !== undefined}
            // Eigener Namensraum: Die Flow-Balken darunter tragen `kachel-…`
            // für dieselbe Sache. Gleiche Kennung zweimal im Bild heisst
            // Geister-Morph, sobald die Balken aufgeklappt sind.
            layoutIdFuer={(k) => `canvas-${k.id}`}
          />
        )}

        {/* Das Tagespensum steht jetzt an den Karten. Die Balken bleiben als
            Rückfrage erreichbar — mit Serien, Anfragen-Zähler und InMail-Welle,
            die es auf den Karten nicht gibt. Standardmäßig zu. */}
        <button
          type="button"
          onClick={() => setzeBalken(!balkenOffen)}
          aria-expanded={balkenOffen}
          className="ck-label"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            minHeight: 40,
            marginTop: 10,
            padding: '6px 4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span aria-hidden="true">{balkenOffen ? '▾' : '▸'}</span>
          <span>Tagespensum</span>
          <span className="ck-zahl" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
            {flow.laedt ? '' : `${tagesFortschritt.erledigt} von ${tagesFortschritt.gesamt} Stufen stehen`}
          </span>
        </button>
        {balkenOffen
          ? flowZeilen.map((z) => (
              <FlowZeile key={z.id} zeile={z} onOeffnen={() => oeffneKachel(z.id, `kachel-${z.id}`)} />
            ))
          : null}

        <div className="ck-label" style={{ marginTop: 10 }}>
          Neben dem Ritual
        </div>
        {projektZeilen.map((z) => (
          <FlowZeile key={z.id} zeile={z} onOeffnen={() => oeffneKachel(z.id, `kachel-${z.id}`)} />
        ))}
      </div>

      <AnimatePresence>
        {offenKachel ? (
          <KachelFenster
            kachel={offenKachel}
            layoutId={offenVon ?? undefined}
            onClose={() => {
              setOffenKachelId(null)
              setOffenVon(null)
            }}
          />
        ) : null}
      </AnimatePresence>

      {anfragenVollbild ? (
        <AnfragenZaehler
          vollbild
          heute={anfragenStand?.wert ?? 0}
          limit={anfragenStand?.soll ?? 0}
          onPlus={() => metrics.bump('li_anfragen', 1)}
          onMinus={() => {
            if ((anfragenStand?.wert ?? 0) > 0) metrics.bump('li_anfragen', -1)
          }}
          onClose={() => setAnfragenVollbild(false)}
        />
      ) : null}

      {arbeitsmodus ? (
        <Arbeitsmodus
          posten={arbeitsmodus.posten}
          onErledigt={onArbeitsmodusErledigt}
          onClose={() => setArbeitsmodus(null)}
          loom={loomAktionen}
        />
      ) : null}
    </MotionConfig>
  )
}
