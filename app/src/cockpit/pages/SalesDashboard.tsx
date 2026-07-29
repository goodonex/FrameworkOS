import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useContacts } from '../../hooks/useContacts'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useErstnachrichten } from '../../hooks/useErstnachrichten'
import { useLinkedinThreads } from '../../hooks/useLinkedinThreads'
import { useTasks } from '../../hooks/useTasks'
import { supabase } from '../../lib/supabase'
import { Arbeitsmodus, type ArbeitsmodusErgebnis } from '../components/Arbeitsmodus'
import { ConversionPanel } from '../components/ConversionPanel'
import { WerkzeugePanel } from '../components/WerkzeugePanel'
import { useActiveBrand } from '../lib/activeBrand'
import {
  antwortPosten,
  erstnachrichtPosten,
  followupPosten,
  loomPosten,
} from '../lib/arbeitsmodusQuellen'
import { erledigePosten } from '../lib/arbeitsmodusTracking'
import { kundeLiegtPosten, kundenaufgabenPosten, liegendeProjekte } from '../lib/kundenarbeit'
import { bucketOf } from '../lib/linkedinFollowups'
import { funnelKpis, sumField } from '../lib/metricsAggregate'
import { ordnePosten, tagesstand, type Posten, type PostenQuellen, type Spur } from '../lib/prioritaet'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useRunnerData } from '../lib/useRunnerData'

/**
 * Sales-Dashboard als Kacheln (Wargame docs/wargames/sales-arbeitsmodus.md,
 * Zug 5). Ersetzt das alte Formular-Dashboard komplett: jede Kachel zeigt
 * Titel · eine Kennzahl · eine empfohlene Handlung, in der Reihenfolge aus
 * Zug 1. Klick auf die Kachel vergrößert sie zum Arbeitsfenster (lokaler
 * State, kein Routing); „Arbeitsmodus starten" öffnet den Vollbild-Modus
 * (Zug 3) für die jeweilige Spur.
 */

const SPUR_LABEL: Record<Spur, string> = {
  kundenaufgabe: 'Kundenaufgabe',
  kunde_liegt: 'Projekt liegt',
  antwort: 'Antwort',
  loom: 'Loom',
  erstnachricht: 'Erstnachricht',
  followup: 'Follow-up',
  anfrage: 'Anfrage',
  inmail: 'InMail',
}

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

interface KachelDef {
  id: string
  titel: string
  kennzahl: string
  kennzahlFarbe?: string
  handlungLabel: string
  handlungDeaktiviert?: boolean
  onHandlung: () => void
  erweitert?: () => React.ReactNode
}

function KachelCard({ kachel, onOeffnen }: { kachel: KachelDef; onOeffnen: () => void }) {
  return (
    <motion.div
      layoutId={`kachel-${kachel.id}`}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onClick={onOeffnen}
      className="ck-panel"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        minHeight: 128,
      }}
    >
      <div className="ck-label">{kachel.titel}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: kachel.kennzahlFarbe ?? 'var(--ck-text-1)', flex: 1 }}>
        {kachel.kennzahl}
      </div>
      <button
        type="button"
        className="ck-btn ck-btn--primary"
        disabled={kachel.handlungDeaktiviert}
        style={{ minHeight: 40 }}
        onClick={(e) => {
          e.stopPropagation()
          kachel.onHandlung()
        }}
      >
        {kachel.handlungLabel}
      </button>
    </motion.div>
  )
}

function KachelFenster({ kachel, onClose }: { kachel: KachelDef; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
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
          width: 'min(560px, 92vw)',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          borderColor: 'var(--ck-border-strong)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="ck-label">{kachel.titel}</div>
        <div style={{ fontSize: 26, fontWeight: 600, color: kachel.kennzahlFarbe ?? 'var(--ck-text-1)' }}>
          {kachel.kennzahl}
        </div>
        {kachel.erweitert ? kachel.erweitert() : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            disabled={kachel.handlungDeaktiviert}
            style={{ minHeight: 48, flex: '1 1 auto' }}
            onClick={kachel.onHandlung}
          >
            {kachel.handlungLabel}
          </button>
          <button type="button" className="ck-btn" style={{ minHeight: 48 }} onClick={onClose}>
            Schließen
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function SalesDashboard() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug
  const metrics = useDailyMetrics()
  const contacts = useContacts(slug)
  const projekte = useDeliverProjects(slug)
  const tasks = useTasks(slug)
  const linkedinThreads = useLinkedinThreads(slug)
  const erstnachrichten = useErstnachrichten(slug)
  const { runner, runs, refresh: refreshRuns } = useRunnerData()

  const [offenKachelId, setOffenKachelId] = useState<string | null>(null)
  const [arbeitsmodusSpur, setArbeitsmodusSpur] = useState<Spur | 'alle' | null>(null)

  // Minutentakt statt Date.now() bei jedem Render (Muster aus LinkedinArea) —
  // sonst rechnen die useMemos unten bei jedem Tastendruck neu.
  const [jetzt, setJetzt] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setJetzt(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const kundenaufgabePosten = useMemo(
    () => kundenaufgabenPosten(tasks.items, projekte.items, contacts.items),
    [tasks.items, projekte.items, contacts.items],
  )
  const liegend = useMemo(
    () => liegendeProjekte(projekte.items, tasks.items, contacts.items, jetzt),
    [projekte.items, tasks.items, contacts.items, jetzt],
  )
  const kundeLiegtListe = useMemo(
    () => kundeLiegtPosten(projekte.items, tasks.items, contacts.items, jetzt),
    [projekte.items, tasks.items, contacts.items, jetzt],
  )
  const antwortListe = useMemo(() => antwortPosten(linkedinThreads.items, jetzt), [linkedinThreads.items, jetzt])
  const loomListe = useMemo(() => loomPosten(linkedinThreads.items), [linkedinThreads.items])
  const followupListe = useMemo(() => followupPosten(linkedinThreads.items, jetzt), [linkedinThreads.items, jetzt])
  const erstnachrichtListe = useMemo(() => erstnachrichtPosten(erstnachrichten.items), [erstnachrichten.items])

  const verwaistAnzahl = useMemo(
    () => linkedinThreads.items.filter((t) => bucketOf(t, jetzt) === 'verwaist').length,
    [linkedinThreads.items, jetzt],
  )
  const loomStarredGesamt = useMemo(() => linkedinThreads.items.filter((t) => t.starred).length, [linkedinThreads.items])
  const loomVerschicktGesamt = useMemo(
    () => linkedinThreads.items.filter((t) => t.starred && t.loom_status === 'verschickt').length,
    [linkedinThreads.items],
  )

  const quellen: PostenQuellen = useMemo(
    () => ({
      kundenaufgabe: kundenaufgabePosten,
      kunde_liegt: kundeLiegtListe,
      antwort: antwortListe,
      loom: loomListe,
      erstnachricht: erstnachrichtListe,
      followup: followupListe,
      anfrage: [],
      inmail: [],
    }),
    [kundenaufgabePosten, kundeLiegtListe, antwortListe, loomListe, erstnachrichtListe, followupListe],
  )

  const geordnet = useMemo(() => ordnePosten(quellen, jetzt), [quellen, jetzt])

  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])
  const funnel = useMemo(() => funnelKpis(metrics.monthRows, monthRevenue), [metrics.monthRows, monthRevenue])
  const tag = useMemo(() => tagesstand(metrics.today), [metrics.today])

  const arbeitsmodusPosten = useMemo<Posten[]>(() => {
    if (arbeitsmodusSpur === null) return []
    if (arbeitsmodusSpur === 'alle') return geordnet
    return geordnet.filter((p) => p.spur === arbeitsmodusSpur)
  }, [arbeitsmodusSpur, geordnet])

  const oeffneArbeitsmodus = useCallback((spur: Spur | 'alle', liste: Posten[]) => {
    if (liste.length === 0) return // Trigger: leere Liste → Modus nicht öffnen
    setArbeitsmodusSpur(spur)
  }, [])

  const schreibeDauer = useCallback(
    async (input: { spur: Spur; postenId: string; sekunden: number }) => {
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

  // Rang-1-Aufgabe → welches Projekt braucht Kevins Klick zuerst.
  const ersteKundenaufgabe = kundenaufgabePosten[0]
  const ersteKundenaufgabeTask = ersteKundenaufgabe
    ? tasks.items.find((t) => `task:${t.id}` === ersteKundenaufgabe.id)
    : undefined

  const kacheln: KachelDef[] = [
    {
      id: 'jetzt-dran',
      titel: 'Jetzt dran',
      kennzahl: geordnet.length
        ? `${geordnet.length} offen · zuerst: ${SPUR_LABEL[geordnet[0].spur]} ${geordnet[0].name}`
        : 'Alles abgearbeitet',
      handlungLabel: geordnet.length ? 'Arbeitsmodus starten' : 'Nichts offen',
      handlungDeaktiviert: geordnet.length === 0,
      onHandlung: () => oeffneArbeitsmodus('alle', geordnet),
    },
    {
      id: 'kundenarbeit',
      titel: 'Kundenarbeit',
      kennzahl: `${kundenaufgabePosten.length} offen`,
      handlungLabel: ersteKundenaufgabeTask?.project_id ? 'Ins Projekt' : 'Keine offen',
      handlungDeaktiviert: !ersteKundenaufgabeTask?.project_id,
      onHandlung: () => {
        if (ersteKundenaufgabeTask?.project_id && slug) {
          navigate(`/brand/${slug}/deliver/${ersteKundenaufgabeTask.project_id}`)
        }
      },
      erweitert: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {kundenaufgabePosten.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>Keine offenen Kundenaufgaben.</span>
          ) : (
            kundenaufgabePosten.slice(0, 8).map((p) => (
              <div key={p.id} style={{ fontSize: 13, color: 'var(--ck-text-2)' }}>
                {p.firma ? `${p.firma} — ` : ''}
                {p.name}
              </div>
            ))
          )}
        </div>
      ),
    },
    {
      id: 'liegt-zu-lange',
      titel: 'Liegt zu lange',
      kennzahl: liegend.length ? `${liegend.length} Projekt${liegend.length === 1 ? '' : 'e'} > 14 Tage` : 'Keins liegt',
      kennzahlFarbe: liegend.length ? 'var(--ck-warn)' : undefined,
      handlungLabel: liegend.length ? 'Follow-up entwerfen' : 'Nichts offen',
      handlungDeaktiviert: liegend.length === 0,
      onHandlung: () => oeffneArbeitsmodus('kunde_liegt', kundeLiegtListe),
      erweitert: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {liegend.map(({ projekt, tage }) => (
            <div key={projekt.id} style={{ fontSize: 13, color: 'var(--ck-text-2)' }}>
              {projekt.name} — seit {tage} Tagen
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'antworten',
      titel: 'Antworten',
      kennzahl: linkedinThreads.tableMissing
        ? 'Migration 0058 ausstehend'
        : `${antwortListe.length} warten · ${antwortListe.filter((p) => p.starred).length} mit Stern`,
      handlungLabel: antwortListe.length ? 'Arbeitsmodus starten' : 'Nichts offen',
      handlungDeaktiviert: antwortListe.length === 0,
      onHandlung: () => oeffneArbeitsmodus('antwort', antwortListe),
    },
    {
      id: 'looms',
      titel: 'Looms',
      kennzahl: linkedinThreads.tableMissing
        ? 'Migration 0061 ausstehend'
        : `${loomVerschicktGesamt} von ${loomStarredGesamt}`,
      handlungLabel: loomListe.length ? 'Arbeitsmodus starten' : 'Nichts offen',
      handlungDeaktiviert: loomListe.length === 0,
      onHandlung: () => oeffneArbeitsmodus('loom', loomListe),
    },
    {
      id: 'erstnachrichten',
      titel: 'Erstnachrichten',
      kennzahl: erstnachrichten.tableMissing ? 'Migration 0060 ausstehend' : `${erstnachrichtListe.length} offen`,
      handlungLabel: erstnachrichtListe.length ? 'Arbeitsmodus starten' : 'Nichts offen',
      handlungDeaktiviert: erstnachrichtListe.length === 0,
      onHandlung: () => oeffneArbeitsmodus('erstnachricht', erstnachrichtListe),
    },
    {
      id: 'followups',
      titel: 'Follow-ups',
      kennzahl: linkedinThreads.tableMissing
        ? 'Migration 0058 ausstehend'
        : `${followupListe.length} fällig · ${verwaistAnzahl} Altlasten`,
      handlungLabel: followupListe.length ? 'Arbeitsmodus starten' : 'Nichts offen',
      handlungDeaktiviert: followupListe.length === 0,
      onHandlung: () => oeffneArbeitsmodus('followup', followupListe),
    },
    {
      id: 'vernetzungsanfragen',
      titel: 'Vernetzungsanfragen',
      kennzahl: `${tag.anfragenHeute} von ${tag.anfragenLimit}`,
      handlungLabel: 'Nichts offen',
      handlungDeaktiviert: true,
      onHandlung: () => oeffneArbeitsmodus('anfrage', []),
      erweitert: () => (
        <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>
          Kevins Tagesritual direkt auf LinkedIn — kein Auto-Tracking in der App, nur der Zähler oben.
        </span>
      ),
    },
    {
      id: 'quoten',
      titel: 'Quoten',
      kennzahl: quotenFarbeUndText(funnel.conv).text,
      kennzahlFarbe: quotenFarbeUndText(funnel.conv).farbe,
      handlungLabel: 'Zu /tracking',
      onHandlung: () => navigate('/tracking'),
      erweitert: () => <ConversionPanel kpis={funnel} />,
    },
    {
      id: 'inmails',
      titel: 'InMails',
      kennzahl: `${tag.inmailCredits} Credits übrig`,
      handlungLabel: 'Details',
      onHandlung: () => setOffenKachelId('inmails'),
      erweitert: () => (
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
      handlungLabel: 'Öffnen',
      onHandlung: () => setOffenKachelId('werkzeuge'),
      erweitert: () => (
        <WerkzeugePanel runnerState={runner.state} activeAgents={aktiveAgenten} onRan={() => void refreshRuns()} />
      ),
    },
  ]

  const offenKachel = kacheln.find((k) => k.id === offenKachelId) ?? null

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {kacheln.map((k) => (
          <KachelCard key={k.id} kachel={k} onOeffnen={() => setOffenKachelId(k.id)} />
        ))}
      </div>

      <AnimatePresence>
        {offenKachel ? <KachelFenster kachel={offenKachel} onClose={() => setOffenKachelId(null)} /> : null}
      </AnimatePresence>

      {arbeitsmodusSpur ? (
        <Arbeitsmodus
          posten={arbeitsmodusPosten}
          onErledigt={onArbeitsmodusErledigt}
          onClose={() => setArbeitsmodusSpur(null)}
        />
      ) : null}
    </MotionConfig>
  )
}
