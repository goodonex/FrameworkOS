import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useContacts } from '../../hooks/useContacts'
import { useUrielBus } from '../../store/urielBus'
import { useLinkedinThreads } from '../../hooks/useLinkedinThreads'
import type { UrielTiefe } from '../lib/urielAgent'
import { useErstnachrichten } from '../../hooks/useErstnachrichten'
import { bucketOf, type FollowupBucket } from '../lib/linkedinFollowups'
import { useActiveBrand } from '../lib/activeBrand'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { METRIC_FIELDS, METRIK_LABEL, berechneStand, pruefeBuchung } from '../lib/metrikFelder'
import { mondayOf, toIsoDate } from '../lib/metricsDates'
import {
  anfragenSum,
  nachrichtenSum,
  sumField,
  termineVereinbartTotal,
  weekVitals,
} from '../lib/metricsAggregate'
import { currentSoll, formatEuro, monthKeyOf, monthTargetFor } from '../lib/goals'
import { useMonthGoal } from '../lib/useMonthGoal'
import { useUrielVoice } from '../lib/useUrielVoice'
import {
  URIEL_MODELS,
  URIEL_VOICE_SAMPLE,
  fetchAccountVoices,
  loadVoiceSettings,
  saveVoiceSettings,
  type AccountVoice,
  type UrielVoiceSettings,
} from '../lib/urielVoiceSettings'
import { runUrielTurn, type ToolResult, type UrielAction, type UrielMessage } from '../lib/urielAgent'
import {
  createThread,
  deleteThread,
  loadThread,
  loadThreads,
  saveThreadContent,
  type UrielThread,
} from '../lib/urielThreads'
import { addMemory, loadMemory, removeMemory, type UrielFact } from '../lib/urielMemory'
import type { ViewMode } from '../graph/nebulaLayout'

/** Wo die Wahl „schnell/gruendlich" liegt — lokal, sie gehoert an dieses Geraet. */
const TIEFE_KEY = 'ck.uriel.tiefe'

const AREA_PATH: Record<string, string> = {
  cockpit: '/cockpit',
  sales: '/sales',
  crm: '/sales', // Alias — alte Sprachbefehle "öffne CRM" bleiben gültig
  projekte: '/projekte',
  ads: '/ads',
  content: '/content',
  agenten: '/agenten',
  tracking: '/tracking',
}
const VIEW_LABEL: Record<ViewMode, string> = {
  rings: 'Ringe',
  nebula: 'Nebula',
  leads: 'Leads',
  workflows: 'Agenten',
}

interface DisplayTurn {
  role: 'user' | 'uriel'
  text: string
  actions?: UrielAction[]
}

/**
 * UrielDock — die Oberfläche, über die Kevin mit Uriel spricht (Text + Stimme).
 * Führt die Agenten-Schleife (urielAgent) aus und stellt die Werkzeuge bereit:
 * UI-Steuerung (Graph/Navigation/Brand) + Datenlesen (KPIs/CRM) aus dem bereits
 * geladenen, eingeloggten Cockpit-State. Konversation ist bewusst flüchtig (v1).
 */
export function UrielDock() {
  const open = useUrielBus((s) => s.open)
  const setOpen = useUrielBus((s) => s.setOpen)
  const setPhase = useUrielBus((s) => s.setPhase)
  const [turns, setTurns] = useState<DisplayTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speakReplies, setSpeakReplies] = useState(() => {
    try { return localStorage.getItem('uriel.speakReplies') === '1' } catch { return false }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [vset, setVset] = useState<UrielVoiceSettings>(loadVoiceSettings)
  const [accountVoices, setAccountVoices] = useState<AccountVoice[]>([])
  const [voicesHint, setVoicesHint] = useState<string | null>(null)
  const voicesLoadedRef = useRef(false)
  const historyRef = useRef<UrielMessage[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const turnsRef = useRef<DisplayTurn[]>([])
  turnsRef.current = turns

  // Persistente Chats (Phase C) — Threads + „remember"-Gedächtnis, localStorage.
  const [threads, setThreads] = useState<UrielThread[]>(() => loadThreads())
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    const t = loadThreads()
    return t[0]?.id ?? createThread().id
  })
  const [showThreads, setShowThreads] = useState(false)
  const [memory, setMemory] = useState<UrielFact[]>(() => loadMemory())

  // Aktiven Thread laden (Inhalt + History) — bei Wechsel und beim Mount.
  useEffect(() => {
    const t = loadThread(activeThreadId)
    setTurns(t?.turns ?? [])
    historyRef.current = t?.messages ?? []
    setThreads(loadThreads())
  }, [activeThreadId])

  const newChat = useCallback(() => {
    const nt = createThread()
    setActiveThreadId(nt.id)
    setShowThreads(false)
  }, [])

  const removeThread = useCallback(
    (id: string) => {
      deleteThread(id)
      const rest = loadThreads()
      setThreads(rest)
      if (id === activeThreadId) setActiveThreadId(rest[0]?.id ?? createThread().id)
    },
    [activeThreadId],
  )

  const navigate = useNavigate()
  const location = useLocation()
  const { activeBrand, activeSlug, brands } = useActiveBrand()
  const metrics = useDailyMetrics()
  const contacts = useContacts(activeSlug)
  // Dasselbe Postfach, das /linkedin zeigt — Uriel liest es, schreibt nie.
  const linkedinThreads = useLinkedinThreads(activeSlug)
  /**
   * Schnell oder gruendlich (11.08.2026). Standard bleibt schnell — das ist der
   * Normalfall (Zahl buchen, navigieren). Die Wahl haelt lokal, damit Kevin sie
   * nicht bei jedem Oeffnen neu treffen muss.
   */
  const [tiefe, setTiefe] = useState<UrielTiefe>(() => {
    try {
      return localStorage.getItem(TIEFE_KEY) === 'gruendlich' ? 'gruendlich' : 'schnell'
    } catch {
      return 'schnell'
    }
  })
  const setzeTiefe = useCallback((t: UrielTiefe) => {
    setTiefe(t)
    try {
      localStorage.setItem(TIEFE_KEY, t)
    } catch {
      /* ohne Speicher gilt die Wahl nur fuer diese Sitzung */
    }
  }, [])
  // Die Frage „an wen muss ich noch eine Erstnachricht schicken" beantwortet
  // NICHT das Postfach, sondern diese Liste. Genau daran ist Uriel gescheitert.
  const erstnachrichten = useErstnachrichten(activeSlug)
  const monatsziel = useMonthGoal(activeBrand?.id, monthKeyOf())
  const requestGraph = useUrielBus((s) => s.requestGraph)
  const voice = useUrielVoice()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [turns, busy])

  // Phase an die Aura melden: hört zu > arbeitet/spricht > ruhig.
  useEffect(() => {
    if (!open) return
    setPhase(
      voice.listening ? 'listening' : busy || voice.speaking ? 'working' : 'idle',
    )
  }, [open, busy, voice.listening, voice.speaking, setPhase])

  // Konto-Stimmen laden, sobald die Einstellungen erstmals geöffnet werden.
  useEffect(() => {
    if (!showSettings || voicesLoadedRef.current) return
    voicesLoadedRef.current = true
    void fetchAccountVoices().then(({ voices, error }) => {
      setAccountVoices(voices)
      setVoicesHint(error)
      // Aktuelle Stimme nicht im Konto? → auf die erste nutzbare umstellen (verhindert 402).
      if (voices.length && !voices.some((v) => v.id === vset.voiceId)) {
        const next = { ...loadVoiceSettings(), voiceId: voices[0].id }
        saveVoiceSettings(next)
        setVset(next)
      }
    })
  }, [showSettings, vset.voiceId])

  const ensureCockpit = useCallback(() => {
    if (location.pathname !== '/cockpit') navigate('/cockpit')
  }, [location.pathname, navigate])

  /** Werkzeug-Ausführung — frisch pro Zug, sieht damit aktuelle Daten. */
  const execute = useCallback(
    async (name: string, input: Record<string, unknown>): Promise<ToolResult> => {
      switch (name) {
        case 'remember': {
          const fact = String(input.fact ?? '').trim()
          if (fact) setMemory(addMemory(fact))
          return { ok: true, summary: fact ? `gemerkt: ${fact}` : 'nichts zu merken', data: { done: true } }
        }
        case 'log_metric': {
          // Das einzige schreibende Werkzeug am Tracking. Drei Regeln:
          // (1) Feldname kommt aus METRIC_FIELDS — nichts Erfundenes durchlassen.
          // (2) Addieren, nie überschreiben (bumpOn) — Uriel kennt den Tagesstand
          //     nicht und würde sonst stillschweigend Gezähltes wegwerfen.
          // (3) Der neue Stand wird HIER gerechnet, nicht aus `metrics` gelesen:
          //     bumpOn ist optimistisch + gebündelt, der Hook-State in diesem
          //     Closure ist noch der alte. Kevin bekommt sonst den Stand von vorher
          //     zurück — und genau der soll den Vertipper aufdecken.
          if (metrics.tableMissing) {
            return { ok: false, summary: 'Tracking-Tabelle fehlt', data: { error: 'table_missing' } }
          }
          const heute = toIsoDate(new Date())
          const geprueft = pruefeBuchung({
            feld: input.feld,
            wert: input.wert,
            datum: input.datum,
            heute,
            windowStart: metrics.windowStart,
          })
          if (!geprueft.ok) {
            return {
              ok: false,
              summary: geprueft.text,
              data:
                geprueft.fehler === 'unknown_field'
                  ? { error: geprueft.fehler, erlaubt: [...METRIC_FIELDS] }
                  : { error: geprueft.fehler },
            }
          }

          const { feld, datum, wert } = geprueft
          const stand = berechneStand({
            vorher: metrics.rowFor(datum)[feld] ?? 0,
            wert,
            wochenstandVorher: sumField(metrics.weekRows, feld),
            inDieserWoche:
              toIsoDate(mondayOf(new Date(`${datum}T12:00:00`))) === toIsoDate(mondayOf(new Date())),
          })
          metrics.bumpOn(datum, feld, wert)

          const label = METRIK_LABEL[feld]
          const tagWort = datum === heute ? 'heute' : datum
          return {
            ok: true,
            summary: `${label}: ${tagWort} ${stand.tagesstand}, Woche ${stand.wochenstand}`,
            data: {
              feld,
              label,
              datum,
              veraendert_um: wert,
              vorher: stand.vorher,
              tagesstand: stand.tagesstand,
              wochenstand: stand.wochenstand,
              hinweis: stand.begrenzt
                ? 'Auf 0 begrenzt — es war weniger eingetragen, als abgezogen werden sollte.'
                : undefined,
            },
          }
        }
        case 'set_graph_view': {
          const view = input.view as ViewMode
          ensureCockpit()
          requestGraph({ view })
          return { ok: true, summary: `Ansicht → ${VIEW_LABEL[view] ?? view}`, data: { done: true } }
        }
        case 'search_graph': {
          const query = String(input.query ?? '')
          ensureCockpit()
          requestGraph({ query })
          return { ok: true, summary: query ? `Graph-Suche „${query}"` : 'Graph-Suche zurückgesetzt', data: { done: true } }
        }
        case 'navigate': {
          const area = String(input.area ?? '')
          const path = AREA_PATH[area]
          if (!path) return { ok: false, summary: `Unbekannter Bereich: ${area}`, data: { error: 'unknown_area' } }
          navigate(path)
          return { ok: true, summary: `Navigiert → ${area}`, data: { done: true } }
        }
        case 'open_contact': {
          const id = String(input.contact_id ?? '')
          if (!id) return { ok: false, summary: 'Keine contact_id', data: { error: 'missing_id' } }
          navigate(`/sales/${id}`)
          return { ok: true, summary: 'Kontakt geöffnet', data: { done: true } }
        }
        case 'get_today_kpis': {
          const t = metrics.today
          const data = {
            datum: t.datum,
            brand: activeBrand?.name ?? activeSlug,
            anfragen: anfragenSum(t),
            nachrichten: nachrichtenSum(t),
            looms: t.looms,
            termine_vereinbart: termineVereinbartTotal(t),
            abschluesse: t.abschluesse,
            umsatz: t.umsatz,
          }
          return { ok: true, summary: 'Heutige KPIs gelesen', data }
        }
        case 'get_week_vitals': {
          const vitals = weekVitals(metrics.weekRows, metrics.windowRows).map((v) => ({
            kategorie: v.label,
            aktuell: v.current,
            ziel: v.target,
          }))
          return { ok: true, summary: 'Wochen-Vitals gelesen', data: { brand: activeBrand?.name ?? activeSlug, vitals } }
        }
        case 'get_month_revenue': {
          const monthKey = monthKeyOf()
          // Gesetztes Ziel aus month_goals — sonst meldete der Assistent ab
          // September den 40.000-€-Default als Monatsziel.
          const target = monthTargetFor(monthKey, monatsziel.total)
          const monthRevenue = sumField(metrics.monthRows, 'umsatz')
          const data = {
            brand: activeBrand?.name ?? activeSlug,
            monat: target?.label ?? monthKey,
            umsatz: monthRevenue,
            monatsziel: target?.total ?? null,
            soll_bis_heute: target ? currentSoll(target.curve) : null,
            umsatz_formatiert: formatEuro(monthRevenue),
          }
          return { ok: true, summary: 'Monatsumsatz gelesen', data }
        }
        case 'get_linkedin_postfach': {
          const jetzt = new Date()
          const eimer: Record<FollowupBucket, number> = {
            faellig: 0, du_bist_dran: 0, wartet: 0, pruefen: 0, abschluss: 0, ruht: 0,
          }
          for (const t of linkedinThreads.items) eimer[bucketOf(t, jetzt)] += 1
          const zuletzt = linkedinThreads.items
            .map((t) => t.last_synced_at)
            .filter(Boolean)
            .sort()
            .at(-1)
          return {
            ok: true,
            summary: `${linkedinThreads.items.length} Unterhaltungen · ${eimer.du_bist_dran} warten auf dich`,
            data: {
              gesamt: linkedinThreads.items.length,
              eimer,
              ungelesen: linkedinThreads.items.filter((t) => t.unread).length,
              mit_stern: linkedinThreads.items.filter((t) => t.starred).length,
              zuletzt_synchronisiert: zuletzt ?? null,
              /**
               * Die Zahl, nach der Kevin wirklich gefragt hat. Sie steht mit in
               * derselben Antwort, damit Uriel sie nicht aus einem Eimer
               * herleiten muss — genau das ging schief.
               */
              erstnachrichten_offen: erstnachrichten.items.filter((e) => e.status === 'offen').length,
              hinweis_erstnachrichten:
                'erstnachrichten_offen ist die Antwort auf „an wen muss ich noch eine Erstnachricht schicken". ' +
                'Die Eimer des Postfachs sind es NICHT — dort wurde ueberall schon geschrieben. ' +
                'Herkunft: vorbereitete Texte aus dem letzten linkedin-leads-Lauf, noch nicht verschickt. ' +
                'Wer erst danach angenommen hat oder Off-ICP war, fehlt darin.',
              // Der Grund, warum Uriel vorher geraten hat: die Grenze muss mit.
              nicht_enthalten: 'Wer eine offene Vernetzungsanfrage angenommen hat — das spiegelt der Sync nicht.',
            },
          }
        }

        case 'search_linkedin': {
          const q = String(input.query ?? '').toLowerCase().trim()
          if (!q) return { ok: false, summary: 'Leere Suche', data: { error: 'empty_query' } }
          const jetzt = new Date()
          const treffer = linkedinThreads.items
            .filter((t) => `${t.name} ${t.company}`.toLowerCase().includes(q))
            .slice(0, 6)
            .map((t) => ({
              name: t.name,
              firma: t.company || null,
              eimer: bucketOf(t, jetzt),
              zuletzt_von: t.last_from,
              zuletzt_am: t.last_message_at,
              entwurf_liegt_bereit: Boolean(t.entwurf),
              stern: t.starred,
            }))
          return {
            ok: true,
            summary: `${treffer.length} Unterhaltung(en) für „${q}"`,
            data: { treffer },
          }
        }

        case 'search_contacts': {
          const q = String(input.query ?? '').toLowerCase().trim()
          if (!q) return { ok: false, summary: 'Leere Suche', data: { error: 'empty_query' } }
          const hits = contacts.items
            .filter((c) => {
              const hay = [c.name, c.company, c.first_name, c.last_name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
              return hay.includes(q)
            })
            .slice(0, 6)
            .map((c) => ({
              id: c.id,
              name: c.name,
              firma: c.company ?? null,
              stage: c.pipeline_stage,
              potenzial: c.potenzial_betrag ?? null,
            }))
          return {
            ok: true,
            summary: `${hits.length} Kontakt(e) für „${q}"`,
            data: { treffer: hits },
          }
        }
        default:
          return { ok: false, summary: `Unbekanntes Werkzeug: ${name}`, data: { error: 'unknown_tool' } }
      }
    },
    [ensureCockpit, requestGraph, navigate, brands, metrics, contacts, linkedinThreads, erstnachrichten, activeBrand, activeSlug],
  )

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim()
      if (!msg || busy) return
      voice.unlock() // Audio bei dieser Geste freischalten, damit Uriel danach sprechen darf
      setDraft('')
      setError(null)
      setBusy(true)
      const withUser: DisplayTurn[] = [...turnsRef.current, { role: 'user', text: msg }]
      setTurns(withUser)
      try {
        const result = await runUrielTurn(historyRef.current, msg, execute, {
          brandName: activeBrand?.name,
          brandSlug: activeSlug,
          date: new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
          area: location.pathname.replace('/', '') || 'cockpit',
          memory: memory.map((f) => f.text),
        }, tiefe)
        historyRef.current = result.messages
        const finalText = result.finalText || '(keine Antwort)'
        const withUriel: DisplayTurn[] = [
          ...withUser,
          { role: 'uriel', text: finalText, actions: result.actions },
        ]
        setTurns(withUriel)
        setThreads(saveThreadContent(activeThreadId, result.messages, withUriel))
        setMemory(loadMemory()) // falls Uriel im Zug via remember etwas gemerkt hat
        if (speakReplies) voice.speak(finalText)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [busy, execute, activeBrand, activeSlug, location.pathname, speakReplies, voice, memory, activeThreadId],
  )

  const onMic = useCallback(() => {
    voice.unlock() // Geste → Audio freischalten
    if (voice.listening) {
      voice.stopListening()
      return
    }
    voice.startListening(
      (interim) => setDraft(interim), // live mitlaufender Text
      (finalText) => { setDraft(''); void send(finalText) }, // fertiger Satz → senden
    )
  }, [voice, send])

  const updateVset = useCallback((patch: Partial<UrielVoiceSettings>) => {
    setVset((prev) => {
      const next = { ...prev, ...patch }
      saveVoiceSettings(next) // sofort persistieren → speak() liest es frisch
      return next
    })
  }, [])

  const toggleSpeak = useCallback(() => {
    voice.unlock()
    setSpeakReplies((v) => {
      const next = !v
      try { localStorage.setItem('uriel.speakReplies', next ? '1' : '0') } catch { /* egal */ }
      return next
    })
    voice.cancelSpeak()
  }, [voice])

  const testVoice = useCallback(() => {
    voice.unlock()
    void voice.speak(URIEL_VOICE_SAMPLE)
  }, [voice])

  // Beim Umstellen der Stimme/des Modus sofort eine Hörprobe — Kevin will hören,
  // wie es klingt, ohne erst einen Prompt einzugeben. Synchron speichern, DANN
  // sprechen, damit speak() die neue Einstellung aus localStorage liest.
  const applyAndPreview = useCallback(
    (patch: Partial<UrielVoiceSettings>) => {
      const next = { ...loadVoiceSettings(), ...patch }
      saveVoiceSettings(next)
      setVset(next)
      voice.unlock()
      void voice.speak(URIEL_VOICE_SAMPLE)
    },
    [voice],
  )

  return (
    <>
      {open ? (
        <div
          className="ck-root ck-uriel-panel"
          role="dialog"
          aria-label="Uriel"
          style={{
            width: 'min(440px, calc(100vw - 40px))',
            height: 'min(560px, calc(100vh - 120px))',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--ck-panel)',
            border: '1px solid var(--ck-border-strong)',
            borderRadius: 'var(--ck-radius-innen)',
            overflow: 'hidden',
            boxShadow: 'var(--ck-schatten-panel)',
          }}
        >
          {/* Kopf */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--ck-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--ck-accent)', fontSize: 15 }}>✦</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em' }}>URIEL</div>
                <div
                  className="ck-label"
                  style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {threads.find((t) => t.id === activeThreadId)?.title ?? 'Neuer Chat'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="ck-btn"
                style={{ padding: '3px 8px' }}
                onClick={newChat}
                aria-label="Neuer Chat"
                title="Neuer Chat"
              >
                ＋
              </button>
              <button
                className="ck-btn"
                style={{ padding: '3px 8px', color: showThreads ? 'var(--ck-accent)' : undefined }}
                onClick={() => setShowThreads((s) => !s)}
                aria-label="Chats & Gedächtnis"
                title="Chats & Gedächtnis"
              >
                ☰
              </button>
              <button
                className="ck-btn"
                style={{ padding: '3px 8px', color: showSettings ? 'var(--ck-accent)' : undefined }}
                onClick={() => setShowSettings((s) => !s)}
                aria-label="Stimm-Einstellungen"
                title="Stimme wählen & abstimmen"
              >
                ⚙
              </button>
              <button
                className="ck-btn"
                style={{ padding: '3px 8px', color: speakReplies ? 'var(--ck-accent)' : undefined }}
                onClick={toggleSpeak}
                aria-label={speakReplies ? 'Vorlesen aus' : 'Antworten vorlesen'}
                title={speakReplies ? 'Vorlesen aus' : 'Antworten vorlesen'}
              >
                {speakReplies ? '🔊' : '🔇'}
              </button>
              <button className="ck-btn" style={{ padding: '3px 8px' }} onClick={() => setOpen(false)} aria-label="Uriel schließen">✕</button>
            </div>
          </div>

          {showThreads ? (
            <div style={{ borderBottom: '1px solid var(--ck-border)', background: 'var(--ck-panel-2)', maxHeight: 260, overflowY: 'auto' }}>
              <div style={{ padding: '8px 14px' }}>
                <div className="ck-label" style={{ marginBottom: 4 }}>Chats</div>
                {threads.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>Noch keine Chats.</div>
                ) : (
                  threads.map((t) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveThreadId(t.id)
                          setShowThreads(false)
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: t.id === activeThreadId ? 'var(--ck-accent)' : 'var(--ck-text-1)',
                          fontSize: 12.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.id === activeThreadId ? '● ' : ''}
                        {t.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeThread(t.id)}
                        aria-label="Chat löschen"
                        style={{ background: 'none', border: 'none', color: 'var(--ck-text-3)', cursor: 'pointer', fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--ck-border)' }}>
                <div className="ck-label" style={{ marginBottom: 4 }}>🧠 Gedächtnis · {memory.length}</div>
                {memory.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ck-text-3)' }}>
                    Uriel merkt sich hier still Fakten über dich.
                  </div>
                ) : (
                  memory.map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
                      <span style={{ flex: 1, fontSize: 11.5, color: 'var(--ck-text-2)', lineHeight: 1.4 }}>{f.text}</span>
                      <button
                        type="button"
                        onClick={() => setMemory(removeMemory(f.id))}
                        aria-label="Vergessen"
                        style={{ background: 'none', border: 'none', color: 'var(--ck-text-3)', cursor: 'pointer', fontSize: 11 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {showSettings ? (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ck-border)', background: 'var(--ck-panel-2)', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div>
                <label className="ck-label" htmlFor="uriel-voice">Stimme (aus deinem ElevenLabs-Konto)</label>
                <select
                  id="uriel-voice"
                  className="ck-select"
                  style={{ width: '100%', marginTop: 3 }}
                  value={vset.voiceId}
                  onChange={(e) => applyAndPreview({ voiceId: e.target.value })}
                  disabled={accountVoices.length === 0}
                >
                  {accountVoices.length === 0 ? (
                    <option>{voicesHint ? 'Keine Stimmen geladen' : 'lädt …'}</option>
                  ) : (
                    accountVoices.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}{v.category ? ` (${v.category})` : ''}</option>
                    ))
                  )}
                </select>
                {voicesHint ? (
                  <p className="ck-label" style={{ color: 'var(--ck-warn)', marginTop: 4, lineHeight: 1.4 }}>{voicesHint}</p>
                ) : null}
              </div>
              <div>
                <label className="ck-label" htmlFor="uriel-model">Modus</label>
                <select
                  id="uriel-model"
                  className="ck-select"
                  style={{ width: '100%', marginTop: 3 }}
                  value={vset.modelId}
                  onChange={(e) => applyAndPreview({ modelId: e.target.value as UrielVoiceSettings['modelId'] })}
                >
                  {URIEL_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label} — {m.note}</option>
                  ))}
                </select>
              </div>
              <VsetSlider label="Tempo" value={vset.speed} min={0.7} max={1.2} step={0.05} onChange={(n) => updateVset({ speed: n })} />
              <VsetSlider label="Lebendigkeit (Betonung)" value={1 - vset.stability} min={0} max={1} step={0.05} onChange={(n) => updateVset({ stability: 1 - n })} />
              <VsetSlider label="Ausdruck" value={vset.style} min={0} max={1} step={0.05} onChange={(n) => updateVset({ style: n })} />
              <button className="ck-btn ck-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={testVoice}>
                ▶ Stimme testen
              </button>
            </div>
          ) : null}

          {/* Verlauf */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turns.length === 0 && !busy ? (
              <div style={{ fontSize: 12.5, color: 'var(--ck-text-3)', lineHeight: 1.7 }}>
                <p style={{ marginBottom: 8 }}>Sprich oder schreib mit Uriel. Beispiele:</p>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>„Zeig mir die Leads-Pipeline"</li>
                  <li>„Was sind meine Zahlen heute?"</li>
                  <li>„Such den Kontakt Reichentrog"</li>
                  <li>„Öffne das Tracking"</li>
                </ul>
              </div>
            ) : null}
            {turns.map((t, i) => (
              <div key={i} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                <div
                  style={{
                    background: t.role === 'user' ? 'var(--ck-accent-dim)' : 'var(--ck-panel-2)',
                    border: '1px solid var(--ck-border)',
                    borderRadius: 'var(--ck-radius-innen)',
                    padding: '7px 11px',
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                >
                  {t.role === 'uriel' ? (
                    <div className="ck-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{t.text}</ReactMarkdown></div>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{t.text}</span>
                  )}
                </div>
                {t.actions && t.actions.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {t.actions.map((a, j) => (
                      <span
                        key={j}
                        className="ck-label"
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--ck-border)',
                          color: a.ok ? 'var(--ck-text-2)' : 'var(--ck-warn)',
                        }}
                      >
                        {a.ok ? '✓' : '✕'} {a.summary}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px' }}>
                <span className="ck-dot ck-dot--pulse" />
                <span className="ck-label">Uriel arbeitet…</span>
              </div>
            ) : null}
            {error ? <p className="ck-label" style={{ color: 'var(--ck-warn)' }}>{error}</p> : null}
            {voice.voiceError ? (
              <p className="ck-label" style={{ color: 'var(--ck-warn)' }}>
                Stimme: {voice.voiceError} — Browser-Fallback aktiv.
              </p>
            ) : null}
          </div>

          {/* Eingabe */}
          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--ck-border)' }}>
            {/* O12 (Entscheidung Kevin, 06.08.2026): „Sprache ist Desktop."
                Web Speech gibt es nur in Chrome; in Safari und auf dem iPhone
                bleibt `sttSupported` false. Der Knopf verschwand dort bisher
                kommentarlos — man sah nur, dass etwas fehlt, nicht warum.
                Jetzt steht er da, abgeschaltet, und sagt es. */}
            {voice.sttSupported ? (
              <button
                className="ck-btn"
                onClick={onMic}
                aria-label={voice.listening ? 'Aufnahme stoppen' : 'Sprechen'}
                title={voice.listening ? 'Aufnahme stoppen' : 'Sprechen'}
                style={{ color: voice.listening ? 'var(--ck-accent)' : undefined, minWidth: 40 }}
              >
                {voice.listening ? '● …' : '🎤'}
              </button>
            ) : (
              <button
                className="ck-btn"
                disabled
                aria-label="Sprechen — nur in Chrome am Rechner verfügbar"
                title="Sprache läuft über die Web-Speech-Schnittstelle und gibt es nur in Chrome am Rechner. Am iPhone und in Safari tippen."
                style={{ minWidth: 40, opacity: 0.45, cursor: 'not-allowed' }}
              >
                🎤
              </button>
            )}
            {/* Schnell oder gruendlich (11.08.). Schnell = Haiku, der Normalfall:
                Zahl buchen, navigieren, kurz antworten. Gruendlich schaltet in
                der Edge Function auf das groessere Modell — fuer die Fragen, bei
                denen ein schnelles Modell anfaengt zu raten statt nachzusehen.
                Sichtbar, nicht versteckt: Kevin soll sehen, mit wem er spricht. */}
            <button
              type="button"
              className={`ck-btn${tiefe === 'gruendlich' ? ' ck-btn--primary' : ''}`}
              onClick={() => setzeTiefe(tiefe === 'gruendlich' ? 'schnell' : 'gruendlich')}
              aria-pressed={tiefe === 'gruendlich'}
              title={
                tiefe === 'gruendlich'
                  ? 'Gründlich: grösseres Modell, mehr Zeit. Tippen schaltet zurück auf schnell.'
                  : 'Schnell: kurze Antworten, sofort. Tippen schaltet auf gründlich.'
              }
              style={{ minWidth: 40, flexShrink: 0, paddingInline: 12 }}
            >
              {tiefe === 'gruendlich' ? 'Gründlich' : 'Schnell'}
            </button>
            <textarea
              className="ck-input"
              style={{ flex: 1, resize: 'none', height: 60, lineHeight: 1.45 }}
              placeholder={tiefe === 'gruendlich' ? 'Uriel fragen — er lässt sich Zeit …' : 'Uriel fragen …'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(draft)
                }
              }}
              aria-label="Uriel-Eingabe"
            />
            <button className="ck-btn ck-btn--primary" disabled={busy || !draft.trim()} onClick={() => void send(draft)}>⏎</button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Uriel schließen' : 'Uriel öffnen'}
        className="ck-uriel-fab"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '1px solid var(--ck-accent)',
          background: open ? 'var(--ck-accent)' : 'var(--ck-panel)',
          color: open ? 'var(--ck-bg)' : 'var(--ck-accent)',
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: 'var(--ck-schatten-schwebend)',
        }}
      >
        ✦
      </button>
    </>
  )
}

function VsetSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <span className="ck-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', marginTop: 2, accentColor: 'var(--ck-accent)' }}
        aria-label={label}
      />
    </label>
  )
}
