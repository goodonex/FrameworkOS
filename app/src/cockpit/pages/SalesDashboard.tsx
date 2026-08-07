import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useArbeitsDauern } from '../../hooks/useArbeitsDauern'
import { usePosten } from '../../hooks/usePosten'
import { useIsMobile } from '../../hooks/useViewport'
import { supabase } from '../../lib/supabase'
import { AnfragenZaehler } from '../components/AnfragenZaehler'
import { Arbeitsliste, type LoomSkriptAktionen } from '../components/Arbeitsliste'
import { Arbeitsmodus, type ArbeitsmodusErgebnis } from '../components/Arbeitsmodus'
import { ConversionPanel } from '../components/ConversionPanel'
import { WerkzeugePanel } from '../components/WerkzeugePanel'
import { useActiveBrand } from '../lib/activeBrand'
import { zeilenId } from '../lib/arbeitsmodusQuellen'
import { erledigePosten } from '../lib/arbeitsmodusTracking'
import { bucketOf } from '../lib/linkedinFollowups'
import { funnelKpis, sumField } from '../lib/metricsAggregate'
import { tagesstand, type Posten, type Spur } from '../lib/prioritaet'
import { tagesansage } from '../lib/tagesansage'
import { postRun } from '../lib/runnerApi'
import { fetchSalesLibrary, salesFileUrl, type SalesLibrary } from '../lib/salesLibraryApi'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useRunnerData } from '../lib/useRunnerData'

/**
 * Sales-Dashboard als Kacheln. Jede Kachel ist komplett klickbar und
 * vergrößert sich per Layout-Morph zum Arbeitsfenster (framer-motion
 * layoutId). Im Fenster steht die eigentliche Arbeit: die Namensliste der
 * Spur (Arbeitsliste) — Name aufklappen → Text/Skript darunter, daneben
 * Haken, Kopieren (nur bei versandfertigem Text) bzw. Skript
 * öffnen/generieren bei Looms.
 *
 * Vollbild gibt es NUR am Handy: den Ein-Posten-Arbeitsmodus (aus dem
 * Fenster heraus) und den Ein-Knopf-Anfragen-Zähler. Am Desktop bleibt
 * alles im Fenster — Vollbild wäre dort verschenkter Platz.
 */

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`
}

/** Schwächste Stufe zuerst — genau die, an der es gerade hakt. */
function quotenFarbeUndText(conv: ReturnType<typeof funnelKpis>['conv']): { farbe: string; text: string } {
  const schlechteste = [...conv].sort((a, b) => {
    const ra = a.state === 'low' ? 0 : a.state === 'ok' ? 1 : a.state === 'great' ? 2 : 3
    const rb = b.state === 'low' ? 0 : b.state === 'ok' ? 1 : b.state === 'great' ? 2 : 3
    return ra - rb
  })[0]
  const farbe =
    schlechteste?.state === 'low'
      ? 'var(--ck-warn)'
      : schlechteste?.state === 'great'
        ? 'var(--ck-accent)'
        : 'var(--ck-text-1)'
  const text = conv.map((k) => `${pct(k.rate)}`).join(' · ')
  return { farbe, text }
}

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

export function KachelCard({ kachel, onOeffnen }: { kachel: KachelDef; onOeffnen: () => void }) {
  return (
    <motion.button
      type="button"
      layoutId={`kachel-${kachel.id}`}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onClick={onOeffnen}
      className="ck-panel"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        gap: 8,
        cursor: 'pointer',
        minHeight: 96,
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <div className="ck-label">{kachel.titel}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: kachel.kennzahlFarbe ?? 'var(--ck-text-1)' }}>
        {kachel.kennzahl}
      </div>
      {kachel.unterzeile ? (
        <div
          style={{
            fontSize: 12,
            color: 'var(--ck-text-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {kachel.unterzeile}
        </div>
      ) : null}
    </motion.button>
  )
}

export function KachelFenster({ kachel, onClose }: { kachel: KachelDef; onClose: () => void }) {
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
        layoutId={`kachel-${kachel.id}`}
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
          borderColor: 'var(--ck-border-strong)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div className="ck-label">{kachel.titel}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: kachel.kennzahlFarbe ?? 'var(--ck-text-1)', marginTop: 2 }}>
              {kachel.kennzahl}
            </div>
          </div>
          <button type="button" className="ck-btn" style={{ minHeight: 40, flexShrink: 0 }} onClick={onClose}>
            Schließen
          </button>
        </div>
        {kachel.inhalt ? kachel.inhalt() : null}
        {kachel.fensterAktion ? (
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: 48 }}
            onClick={kachel.fensterAktion.onClick}
          >
            {kachel.fensterAktion.label}
          </button>
        ) : null}
      </motion.div>
    </motion.div>
  )
}

export function SalesDashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug
  const metrics = useDailyMetrics()
  // Posten-Verdrahtung liegt seit Etappe 3 im gemeinsamen Hook — das Heute-Deck
  // liest exakt dieselbe Rangfolge.
  const { geordnet, quellen, liegend, jetzt, tasks, linkedinThreads, erstnachrichten } = usePosten(slug)
  const dauern = useArbeitsDauern(slug)
  const { runner, runs, refresh: refreshRuns } = useRunnerData()

  const [offenKachelId, setOffenKachelId] = useState<string | null>(null)
  /** Snapshot beim Öffnen — die Live-Listen schrumpfen beim Abhaken (optimistische
      Updates) und würden sonst unter dem laufenden Index wegrutschen: jeder
      zweite Posten würde übersprungen und nie angezeigt. */
  const [arbeitsmodus, setArbeitsmodus] = useState<{ spur: Spur | 'alle'; posten: Posten[] } | null>(null)
  const [anfragenVollbild, setAnfragenVollbild] = useState(false)

  const kundenaufgabePosten = quellen.kundenaufgabe ?? []
  const kundeLiegtListe = quellen.kunde_liegt ?? []
  const antwortListe = quellen.antwort ?? []
  const loomListe = quellen.loom ?? []
  const followupListe = quellen.followup ?? []
  const erstnachrichtListe = quellen.erstnachricht ?? []

  const verwaistAnzahl = useMemo(
    () => linkedinThreads.items.filter((t) => bucketOf(t, jetzt) === 'verwaist').length,
    [linkedinThreads.items, jetzt],
  )
  const loomStarredGesamt = useMemo(() => linkedinThreads.items.filter((t) => t.starred).length, [linkedinThreads.items])
  const loomVerschicktGesamt = useMemo(
    () => linkedinThreads.items.filter((t) => t.starred && t.loom_status === 'verschickt').length,
    [linkedinThreads.items],
  )

  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])
  const funnel = useMemo(() => funnelKpis(metrics.monthRows, monthRevenue), [metrics.monthRows, monthRevenue])
  const tag = useMemo(() => tagesstand(metrics.today), [metrics.today])

  // Vollbild-Arbeitsmodus ist ein Handy-Werkzeug — am Desktop passiert die
  // Arbeit in der Liste im Kachel-Fenster.
  const oeffneArbeitsmodus = useCallback((spur: Spur | 'alle', liste: Posten[]) => {
    if (liste.length === 0) return
    setOffenKachelId(null)
    setArbeitsmodus({ spur, posten: [...liste] })
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

  const loomsSichtbar =
    offenKachelId === 'looms' ||
    offenKachelId === 'jetzt-dran' ||
    arbeitsmodus?.spur === 'loom' ||
    arbeitsmodus?.spur === 'alle'
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

  const liste = useCallback(
    (posten: Posten[]) => () => (
      <Arbeitsliste
        posten={posten}
        onErledigt={onArbeitsmodusErledigt}
        loom={loomAktionen}
        projektLink={projektLink}
        onNavigiere={navigiere}
      />
    ),
    [onArbeitsmodusErledigt, loomAktionen, projektLink, navigiere],
  )

  /** Am Handy: „Arbeitsmodus starten" im Fenster-Fuß — am Desktop bewusst nicht. */
  const mobilArbeitsmodus = useCallback(
    (spur: Spur | 'alle', posten: Posten[]) =>
      isMobile && posten.length > 0
        ? { label: 'Arbeitsmodus starten', onClick: () => oeffneArbeitsmodus(spur, posten) }
        : undefined,
    [isMobile, oeffneArbeitsmodus],
  )

  const kacheln: KachelDef[] = [
    {
      id: 'jetzt-dran',
      titel: 'Jetzt dran',
      kennzahl: geordnet.length ? `${geordnet.length} offen` : 'Alles abgearbeitet',
      // Kevins Morgen-Frage, aus seinen eigenen Messdaten (arbeits_dauern):
      // „12 offen · ≈ 1 h 40 · um 13:25 durch".
      unterzeile: geordnet.length ? tagesansage(geordnet, dauern, jetzt) : undefined,
      inhalt: liste(geordnet),
      fensterAktion: mobilArbeitsmodus('alle', geordnet),
    },
    {
      id: 'kundenarbeit',
      titel: 'Kundenarbeit',
      kennzahl: `${kundenaufgabePosten.length} offen`,
      unterzeile: kundenaufgabePosten[0]
        ? `zuerst: ${kundenaufgabePosten[0].firma ? `${kundenaufgabePosten[0].firma} — ` : ''}${kundenaufgabePosten[0].name}`
        : undefined,
      inhalt: liste(kundenaufgabePosten),
      fensterAktion: mobilArbeitsmodus('kundenaufgabe', kundenaufgabePosten),
    },
    {
      id: 'liegt-zu-lange',
      titel: 'Liegt zu lange',
      kennzahl: liegend.length ? `${liegend.length} Projekt${liegend.length === 1 ? '' : 'e'} > 14 Tage` : 'Keins liegt',
      kennzahlFarbe: liegend.length ? 'var(--ck-warn)' : undefined,
      inhalt: liste(kundeLiegtListe),
      fensterAktion: mobilArbeitsmodus('kunde_liegt', kundeLiegtListe),
    },
    {
      id: 'antworten',
      titel: 'Antworten',
      kennzahl: linkedinThreads.tableMissing
        ? 'Migration 0058 ausstehend'
        : `${antwortListe.length} warten · ${antwortListe.filter((p) => p.starred).length} mit Stern`,
      inhalt: liste(antwortListe),
      fensterAktion: mobilArbeitsmodus('antwort', antwortListe),
    },
    {
      id: 'looms',
      titel: 'Looms',
      kennzahl: linkedinThreads.tableMissing
        ? 'Migration 0061 ausstehend'
        : `${loomVerschicktGesamt} von ${loomStarredGesamt} verschickt`,
      unterzeile: loomListe.length ? `${loomListe.length} offen — Skript generieren & aufnehmen` : undefined,
      inhalt: liste(loomListe),
      fensterAktion: mobilArbeitsmodus('loom', loomListe),
    },
    {
      id: 'erstnachrichten',
      titel: 'Erstnachrichten',
      kennzahl: erstnachrichten.tableMissing ? 'Migration 0060 ausstehend' : `${erstnachrichtListe.length} offen`,
      inhalt: liste(erstnachrichtListe),
      fensterAktion: mobilArbeitsmodus('erstnachricht', erstnachrichtListe),
    },
    {
      id: 'followups',
      titel: 'Follow-ups',
      kennzahl: linkedinThreads.tableMissing
        ? 'Migration 0058 ausstehend'
        : `${followupListe.length} fällig · ${verwaistAnzahl} Altlasten`,
      inhalt: liste(followupListe),
      fensterAktion: mobilArbeitsmodus('followup', followupListe),
    },
    {
      id: 'vernetzungsanfragen',
      titel: 'Vernetzungsanfragen',
      kennzahl: `${tag.anfragenHeute} von ${tag.anfragenLimit}`,
      unterzeile: 'Zähler — das Ritual läuft direkt auf LinkedIn',
      inhalt: () => (
        <AnfragenZaehler
          heute={tag.anfragenHeute}
          limit={tag.anfragenLimit}
          onPlus={() => metrics.bump('li_anfragen', 1)}
          onMinus={() => {
            if (tag.anfragenHeute > 0) metrics.bump('li_anfragen', -1)
          }}
        />
      ),
    },
    {
      id: 'quoten',
      titel: 'Quoten',
      kennzahl: quotenFarbeUndText(funnel.conv).text,
      kennzahlFarbe: quotenFarbeUndText(funnel.conv).farbe,
      inhalt: () => <ConversionPanel kpis={funnel} />,
      fensterAktion: { label: 'Zu /tracking', onClick: () => navigiere('/tracking') },
    },
    {
      id: 'inmails',
      titel: 'InMails',
      kennzahl: `${tag.inmailCredits} Credits übrig`,
      inhalt: () => (
        <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>
          Bestand, kein Tagesrhythmus (RECON-1 offen — Kevin liest den genauen Stand in LinkedIn nach).
          Reaktivierung offener Anfragen läuft über den Skill <code>linkedin-inmail</code>.
        </span>
      ),
    },
    {
      id: 'werkzeuge',
      titel: 'Werkzeuge',
      kennzahl:
        runner.state !== 'online' ? 'Runner offline' : aktiveAgenten.length ? `${aktiveAgenten.length} aktiv` : 'Bereit',
      kennzahlFarbe: runner.state !== 'online' ? 'var(--ck-warn)' : undefined,
      inhalt: () => (
        <WerkzeugePanel runnerState={runner.state} activeAgents={aktiveAgenten} onRan={() => void refreshRuns()} />
      ),
    },
  ]

  const offenKachel = kacheln.find((k) => k.id === offenKachelId) ?? null

  // Sprung aus dem Heute-Deck: `/sales?kachel=antworten` öffnet direkt das
  // zuständige Fenster. Der Parameter wird danach entfernt, sonst öffnete sich
  // die Kachel nach jedem Schließen wieder.
  const [suchParams, setSuchParams] = useSearchParams()
  const kachelParam = suchParams.get('kachel')
  const modusParam = suchParams.get('modus')
  useEffect(() => {
    if (!kachelParam && !modusParam) return

    // O3 Zug 7: `?modus=arbeit` kommt vom „Loslegen" auf /morgen. Am Handy
    // öffnet es direkt den Arbeitsmodus statt des Kachel-Fensters — der Weg vom
    // Push zum ersten Posten soll zwei Tipps lang sein, nicht drei.
    //
    // Der Effekt darf NICHT feuern, solange die Posten noch laden: sonst stünde
    // „Alles abgearbeitet" vor einer Liste, die gleich kommt. Dann lieber den
    // Parameter stehen lassen und beim nächsten Durchlauf erneut prüfen.
    if (modusParam === 'arbeit' && isMobile) {
      if (geordnet.length === 0) return
      oeffneArbeitsmodus('alle', geordnet)
    } else if (kachelParam && kacheln.some((k) => k.id === kachelParam)) {
      setOffenKachelId(kachelParam)
    }

    const next = new URLSearchParams(suchParams)
    next.delete('kachel')
    next.delete('modus')
    setSuchParams(next, { replace: true })
    // kacheln wird bei jedem Render neu gebaut — die Abhängigkeit ist bewusst
    // nur der Parameter (plus das, was über „noch nicht geladen" entscheidet),
    // sonst liefe der Effekt endlos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kachelParam, modusParam, isMobile, geordnet.length])

  const oeffneKachel = useCallback(
    (id: string) => {
      // Der Anfragen-Zähler ist am Handy ein Vollbild mit einem Knopf —
      // genau dafür war das Vollbild gedacht, nirgendwo sonst.
      if (id === 'vernetzungsanfragen' && isMobile) {
        setAnfragenVollbild(true)
        return
      }
      setOffenKachelId(id)
    },
    [isMobile],
  )

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {kacheln.map((k) => (
          <KachelCard key={k.id} kachel={k} onOeffnen={() => oeffneKachel(k.id)} />
        ))}
      </div>

      <AnimatePresence>
        {offenKachel ? <KachelFenster kachel={offenKachel} onClose={() => setOffenKachelId(null)} /> : null}
      </AnimatePresence>

      {anfragenVollbild ? (
        <AnfragenZaehler
          vollbild
          heute={tag.anfragenHeute}
          limit={tag.anfragenLimit}
          onPlus={() => metrics.bump('li_anfragen', 1)}
          onMinus={() => {
            if (tag.anfragenHeute > 0) metrics.bump('li_anfragen', -1)
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
