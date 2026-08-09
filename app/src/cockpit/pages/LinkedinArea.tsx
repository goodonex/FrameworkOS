import { useEffect, useMemo, useState } from 'react'
import { useContacts } from '../../hooks/useContacts'
import { useLinkedinThreads } from '../../hooks/useLinkedinThreads'
import type { LinkedinThread } from '../../types/db'
import { HeuteTabs } from '../components/HeuteTabs'
import { ErstnachrichtenListe } from '../components/ErstnachrichtenListe'
import { useActiveBrand } from '../lib/activeBrand'
import { buildLinkedinFollowupInput } from '../lib/approvalDrafts'
import { bucketOf, coverage, FOLLOWUP_THRESHOLDS_DAYS, istWeckbar } from '../lib/linkedinFollowups'
import { RUNNER_BASE_URL, useRunnerStatus } from '../lib/useRunnerStatus'
import { beauftrageRunner, runnerDirekt } from '../lib/runnerBridge'

const DAY_MS = 24 * 60 * 60 * 1000

function agoLabel(iso: string | null, now: number): string {
  if (!iso) return 'noch nie'
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'gerade eben'
  const mins = Math.round(ms / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.round(hours / 24)
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`
}

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  const ms = now - new Date(iso).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / DAY_MS) : null
}

/** thread_key ist die einzige persistierte Kennung — Link wird daraus abgeleitet, keine eigene Spalte. */
function threadUrl(threadKey: string): string {
  const id = threadKey.replace(/^urn:li:messagingThread:/, '')
  return id ? `https://www.linkedin.com/messaging/thread/${id}/` : ''
}

function ThreadCard({
  thread,
  now,
  entwurfMoeglich,
  onSnoozeTomorrow,
  onMarkDone,
  onGenerateDraft,
  onLoomVerschickt,
}: {
  thread: LinkedinThread
  now: number
  entwurfMoeglich: boolean
  onSnoozeTomorrow: (t: LinkedinThread) => void
  onMarkDone: (t: LinkedinThread) => void
  onGenerateDraft: (t: LinkedinThread) => void
  onLoomVerschickt: (t: LinkedinThread) => void
}) {
  const days = daysSince(thread.last_message_at, now)
  // Der Stern ist die Zusage zur Loom-Analyse; erledigt ist sie erst, wenn das
  // Video raus ist. 'entfaellt' zaehlt als abgeschlossen — nichts mehr zu tun.
  const loomOffen =
    thread.starred && thread.loom_status !== 'verschickt' && thread.loom_status !== 'entfaellt'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderBottom: '1px solid var(--ck-border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          {/* D3: `unread` gehört dem Voyager-Sync. Wir zeigen den Stand nur an
              und schreiben ihn NIE zurück — sonst überschreibt der nächste Sync
              die Anzeige oder, schlimmer, wir verfälschen seinen Stand. */}
          {thread.unread ? (
            <span
              title="Ungelesen im LinkedIn-Postfach"
              aria-label="ungelesen"
              style={{
                width: 7,
                height: 7,
                flexShrink: 0,
                borderRadius: 99,
                background: 'var(--ck-accent)',
                alignSelf: 'center',
              }}
            />
          ) : null}
          {thread.starred ? (
            <span title="Stern: Ja zur Loom-Analyse" style={{ color: 'var(--ck-accent)', fontSize: 12 }}>
              ★
            </span>
          ) : null}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ck-text-1)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {thread.name || 'Unbekannt'}
          </span>
          {thread.company ? (
            <span
              style={{
                fontSize: 11,
                color: 'var(--ck-text-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {thread.company}
            </span>
          ) : null}
        </div>
        <span className="ck-label" style={{ flexShrink: 0, fontSize: 9 }}>
          Stufe {thread.followup_stage} · {days == null ? '—' : `vor ${days} Tag${days === 1 ? '' : 'en'}`}
        </span>
      </div>
      {thread.preview ? (
        <div style={{ fontSize: 12, color: 'var(--ck-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {thread.preview}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          className="ck-btn ck-btn--primary"
          style={{ fontSize: 10, opacity: entwurfMoeglich ? 1 : 0.45 }}
          disabled={!entwurfMoeglich}
          title={
            entwurfMoeglich
              ? undefined
              : 'Der Runner ist offline — Entwürfe kann gerade niemand erzeugen.'
          }
          onClick={() => onGenerateDraft(thread)}
        >
          Entwurf erzeugen
        </button>
        {loomOffen ? (
          <button
            type="button"
            className="ck-btn"
            style={{ fontSize: 10, color: 'var(--ck-accent)', borderColor: 'var(--ck-accent)' }}
            title="Loom ist aufgenommen und verschickt — nimmt den Posten aus der Loom-Spur"
            onClick={() => onLoomVerschickt(thread)}
          >
            Loom verschickt ✓
          </button>
        ) : null}
        <button type="button" className="ck-btn" style={{ fontSize: 10 }} onClick={() => onSnoozeTomorrow(thread)}>
          → morgen
        </button>
        <button type="button" className="ck-btn" style={{ fontSize: 10 }} onClick={() => onMarkDone(thread)}>
          Erledigt
        </button>
        {threadUrl(thread.thread_key) ? (
          <a
            href={threadUrl(thread.thread_key)}
            target="_blank"
            rel="noreferrer"
            className="ck-btn"
            style={{ fontSize: 10, marginLeft: 'auto', textDecoration: 'none' }}
          >
            Öffnen ↗
          </a>
        ) : null}
      </div>
    </div>
  )
}

const RUHT_DATUM_FMT = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })

/**
 * Der Weg zurück aus dem Schlaf (Zug 2 / D2). Vorher gab es nur den Zähler
 * „Ruht: n" in der Abdeckung — was einmal auf „→ morgen" ging, war unsichtbar,
 * bis der Wecker von allein klingelte.
 *
 * Eingeklappt, weil das kein Tagesgeschäft ist; die Zahl steht trotzdem immer
 * in der Überschrift. Terminale Threads (archiviert/gewonnen/verloren) fehlen
 * hier bewusst — siehe `istWeckbar`.
 */
function RuhtSection({
  threads,
  now,
  onWake,
}: {
  threads: LinkedinThread[]
  now: number
  onWake: (t: LinkedinThread) => void
}) {
  const [offen, setOffen] = useState(false)
  if (threads.length === 0) return null

  return (
    <section className="ck-panel" style={{ overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        className="ck-label"
        style={{
          display: 'block',
          width: '100%',
          minHeight: 44,
          textAlign: 'left',
          padding: '12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ck-text-2)',
        }}
      >
        {offen ? '▾' : '▸'} Ruht · {threads.length}
        <span style={{ color: 'var(--ck-text-3)' }}> · schlafen gelegt, kommen von allein zurück</span>
      </button>
      {offen
        ? threads.map((t) => {
            const bis = t.snoozed_until ? RUHT_DATUM_FMT.format(new Date(t.snoozed_until)) : null
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 44,
                  padding: '8px 12px',
                  borderTop: '1px solid var(--ck-border)',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    color: 'var(--ck-text-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.name || 'Unbekannt'}
                </span>
                <span className="ck-label" style={{ flexShrink: 0, fontSize: 10 }}>
                  {/* `RUHT_DATUM_FMT` liefert „10.08." schon MIT Schlusspunkt —
                      ein eigener machte daraus „bis 10.08..". */}
                  {bis ? `bis ${bis}` : agoLabel(t.last_message_at, now)}
                </span>
                <button
                  type="button"
                  className="ck-btn"
                  style={{ flexShrink: 0, fontSize: 10, minHeight: 36 }}
                  onClick={() => onWake(t)}
                >
                  Aufwecken
                </button>
              </div>
            )
          })
        : null}
    </section>
  )
}

const SICHTBAR_PRO_ABSCHNITT = 15

/**
 * Ein Bucket als Abschnitt. Zeigt anfangs nur die ersten Karten — bei über
 * hundert Threads wäre die Seite sonst eine Wand statt einer Arbeitsliste.
 * Die Gesamtzahl steht immer in der Überschrift, es wird nichts verschwiegen.
 */
function ThreadSection({
  titel,
  hinweis,
  threads,
  leerText,
  now,
  entwurfMoeglich,
  onSnoozeTomorrow,
  onMarkDone,
  onGenerateDraft,
  onLoomVerschickt,
}: {
  titel: string
  hinweis?: string
  threads: LinkedinThread[]
  leerText?: string
  now: number
  entwurfMoeglich: boolean
  onSnoozeTomorrow: (t: LinkedinThread) => void
  onMarkDone: (t: LinkedinThread) => void
  onGenerateDraft: (t: LinkedinThread) => void
  onLoomVerschickt: (t: LinkedinThread) => void
}) {
  const [alleZeigen, setAlleZeigen] = useState(false)
  if (threads.length === 0 && !leerText) return null
  const sichtbar = alleZeigen ? threads : threads.slice(0, SICHTBAR_PRO_ABSCHNITT)
  const rest = threads.length - sichtbar.length

  return (
    <section className="ck-panel" style={{ overflow: 'hidden' }}>
      <div className="ck-label" style={{ padding: '10px 12px 8px' }}>
        {titel} · {threads.length}
        {hinweis ? <span style={{ color: 'var(--ck-text-3)' }}> · {hinweis}</span> : null}
      </div>
      {threads.length === 0 ? (
        <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--ck-text-3)' }}>{leerText}</div>
      ) : (
        <>
          {sichtbar.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              now={now}
              entwurfMoeglich={entwurfMoeglich}
              onSnoozeTomorrow={onSnoozeTomorrow}
              onMarkDone={onMarkDone}
              onGenerateDraft={onGenerateDraft}
              onLoomVerschickt={onLoomVerschickt}
            />
          ))}
          {rest > 0 ? (
            <button
              type="button"
              onClick={() => setAlleZeigen(true)}
              className="ck-label"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ck-accent)',
              }}
            >
              ▸ {rest} weitere anzeigen
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}

/** /linkedin — vierter Heute-Tab (Wargame Zug 7, docs/wargames/linkedin-followups.md). */
export function LinkedinArea({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const { activeBrand } = useActiveBrand()
  const slug = activeBrand?.slug
  const threadsQuery = useLinkedinThreads(slug)
  const contacts = useContacts(slug)
  const { state: runnerState } = useRunnerStatus()
  // Beide Wege brauchen einen LEBENDEN Runner: lokal den direkten Aufruf, sonst
  // den Auftrag über Supabase (0059), den der Runner abholen muss. `direkt`
  // entscheidet nur, WELCHER Weg — ob überhaupt einer trägt, sagt `runnerState`.
  const direkt = runnerDirekt()
  const [ansicht, setAnsicht] = useState<'erst' | 'followup'>('erst')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  // Überlebt den Reload, damit der Unvollständigkeits-Hinweis nicht nur direkt
  // nach dem Sync sichtbar ist. Kein DB-Feld nötig — die Aussage gilt pro Gerät.
  const [lastSyncPartial, setLastSyncPartial] = useState<boolean>(() => {
    try {
      return localStorage.getItem('linkedin.lastSyncPartial') === '1'
    } catch {
      return false
    }
  })
  // Eine Uhr, die im Minutentakt tickt, statt Date.now() bei jedem Render:
  // sonst wechselt der Wert in jedem Durchlauf und die useMemos darunter
  // rechnen jedes Mal neu, obwohl sich an den Daten nichts geändert hat.
  const [nowDate, setNowDate] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNowDate(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const now = nowDate.getTime()

  const lastSyncedAt = useMemo(() => {
    let max: string | null = null
    for (const t of threadsQuery.items) {
      if (!max || t.last_synced_at > max) max = t.last_synced_at
    }
    return max
  }, [threadsQuery.items])

  const staleMs = lastSyncedAt ? now - new Date(lastSyncedAt).getTime() : null
  const isStale = staleMs != null && staleMs > 24 * 60 * 60 * 1000
  const isOffline = runnerState === 'offline'

  const buckets = useMemo(() => {
    const faellig: LinkedinThread[] = []
    const duBistDran: LinkedinThread[] = []
    const abschluss: LinkedinThread[] = []
    const verwaist: LinkedinThread[] = []
    const pruefen: LinkedinThread[] = []
    const ruht: LinkedinThread[] = []
    for (const t of threadsQuery.items) {
      // Weckbar wird VOR dem Bucket geprüft: `bucketOf` wirft Gesnoozte und
      // Terminale in denselben Topf „ruht", nur die ersten dürfen geweckt werden.
      if (istWeckbar(t, nowDate)) ruht.push(t)
      const b = bucketOf(t, nowDate)
      if (b === 'faellig') faellig.push(t)
      else if (b === 'du_bist_dran') duBistDran.push(t)
      else if (b === 'abschluss') abschluss.push(t)
      else if (b === 'verwaist') verwaist.push(t)
      else if (b === 'pruefen') pruefen.push(t)
    }
    // Ältestes zuerst — was am längsten liegt, ist am dringendsten.
    const byAge = (a: LinkedinThread, b: LinkedinThread) =>
      (a.last_message_at ?? '').localeCompare(b.last_message_at ?? '')
    // Sterne (Loom zugesagt) nach vorn, danach nach Alter.
    const bySternDannAlter = (a: LinkedinThread, b: LinkedinThread) =>
      Number(b.starred) - Number(a.starred) || byAge(a, b)
    return {
      faellig: faellig.sort(byAge),
      duBistDran: duBistDran.sort(bySternDannAlter),
      abschluss: abschluss.sort(byAge),
      verwaist: verwaist.sort(byAge),
      pruefen,
      // Wer als Nächstes aufwacht, steht oben.
      ruht: ruht.sort((a, b) => (a.snoozed_until ?? '').localeCompare(b.snoozed_until ?? '')),
    }
  }, [threadsQuery.items, nowDate])

  const cov = useMemo(
    () => coverage(threadsQuery.items, contacts.items, nowDate),
    [threadsQuery.items, contacts.items, nowDate],
  )

  const runSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      let data: Record<string, unknown> = {}
      let fehler: string | null = null
      if (direkt) {
        const res = await fetch(`${RUNNER_BASE_URL}/linkedin/sync`, { method: 'POST' })
        data = await res.json().catch(() => ({}))
        if (!res.ok) fehler = (data?.error as string) ?? `Sync fehlgeschlagen (HTTP ${res.status})`
      } else {
        const r = await beauftrageRunner<Record<string, unknown>>('linkedin_sync', {}, activeBrand?.id)
        if (r.status === 'error') fehler = r.error ?? 'Sync fehlgeschlagen'
        else data = r.result ?? {}
      }
      if (fehler) {
        setSyncMessage(fehler)
      } else {
        const ads = data.skippedAds ? ` · ${data.skippedAds} Anzeige(n) gefiltert` : ''
        setSyncMessage(
          `${data.inserted ?? 0} neu · ${data.updated ?? 0} aktualisiert · ${data.unmatched ?? 0} ohne Kontakt${ads}`,
        )
        setLastSyncPartial(Boolean(data.partial))
        try {
          localStorage.setItem('linkedin.lastSyncPartial', data.partial ? '1' : '0')
        } catch {
          /* ohne localStorage gilt der Hinweis nur für diese Session */
        }
        await threadsQuery.reload()
      }
    } catch {
      setSyncMessage('Runner nicht erreichbar — läuft Chrome (chrome-sync) und der Runner lokal?')
    } finally {
      setSyncing(false)
    }
  }

  const generateDraft = async (thread: LinkedinThread) => {
    try {
      const eingabe = buildLinkedinFollowupInput([thread], nowDate)
      if (direkt) {
        await fetch(`${RUNNER_BASE_URL}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'linkedin-followup-entwuerfe', input: eingabe }),
        })
      } else {
        setSyncMessage(`Entwurf für ${thread.name} beauftragt — der Runner holt ihn gleich ab …`)
        const r = await beauftrageRunner('agent_run', { agent: 'linkedin-followup-entwuerfe', input: eingabe }, activeBrand?.id)
        if (r.status === 'error') { setSyncMessage(r.error ?? 'Entwurf fehlgeschlagen'); return }
      }
      setSyncMessage(`Entwurf für ${thread.name} angefordert — siehe /freigaben.`)
    } catch {
      setSyncMessage('Runner nicht erreichbar — Entwurf konnte nicht angefordert werden.')
    }
  }

  const snoozeTomorrow = (thread: LinkedinThread) => {
    void threadsQuery.snooze(thread.id, new Date(now + DAY_MS).toISOString())
  }

  let badgeColor = 'var(--ck-text-3)'
  let badgeText = `Zuletzt synchronisiert ${agoLabel(lastSyncedAt, now)}`
  if (isOffline) {
    badgeColor = '#ef4444'
    badgeText = `Chrome/Runner offline — Stand vom ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('de-DE') : 'nie'}`
  } else if (isStale) {
    badgeColor = 'var(--ck-warn)'
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {eingebettet ? null : <HeuteTabs />}

      <div style={{ display: 'flex', gap: 6 }}>
        {([['erst', 'Erstnachrichten'], ['followup', 'Follow-ups']] as const).map(([wert, label]) => (
          <button
            key={wert}
            type="button"
            onClick={() => setAnsicht(wert)}
            className="ck-btn"
            style={{
              fontSize: 11,
              minHeight: 36,
              paddingInline: 14,
              borderColor: ansicht === wert ? 'var(--ck-accent)' : undefined,
              color: ansicht === wert ? 'var(--ck-accent)' : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {ansicht === 'erst' ? <ErstnachrichtenListe brandSlug={slug} /> : null}

      <div style={{ display: ansicht === 'followup' ? 'flex' : 'none', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)', margin: 0 }}>LinkedIn</h1>
          <span className="ck-label" style={{ color: badgeColor, fontSize: 10 }}>
            {badgeText}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing}
          className="ck-btn ck-btn--primary"
          style={{ fontSize: 10 }}
          title={direkt ? 'Postfach neu einlesen' : 'Läuft als Auftrag über deinen Runner — dauert ein paar Sekunden länger'}
        >
          {syncing ? 'Synchronisiert …' : 'Jetzt synchronisieren'}
        </button>
      </div>

      {ansicht === 'followup' && syncMessage ? (
        <div style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>{syncMessage}</div>
      ) : null}

      {ansicht === 'followup' && threadsQuery.error ? (
        <div style={{ fontSize: 11, color: 'var(--ck-warn)' }}>{threadsQuery.error}</div>
      ) : null}

      {ansicht !== 'followup' ? null : threadsQuery.tableMissing ? (
        <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}>
          Noch keine Daten — Migration 0058 muss zuerst gepusht werden (supabase db push).
        </div>
      ) : threadsQuery.loading ? (
        <div style={{ fontSize: 12, color: 'var(--ck-text-3)', padding: 12 }}>Lädt …</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="ck-panel" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
              <div className="ck-label" style={{ fontSize: 9 }}>Du bist dran</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: buckets.duBistDran.length ? 'var(--ck-warn)' : 'var(--ck-text-1)' }}>
                {buckets.duBistDran.length}
              </div>
            </div>
            <div className="ck-panel" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
              <div className="ck-label" style={{ fontSize: 9 }}>Fällig</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ck-text-1)' }}>{buckets.faellig.length}</div>
            </div>
            <div className="ck-panel" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
              <div className="ck-label" style={{ fontSize: 9 }}>Altlasten</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: buckets.verwaist.length ? 'var(--ck-warn)' : 'var(--ck-text-1)' }}>
                {buckets.verwaist.length}
              </div>
            </div>
            <div className="ck-panel" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
              <div className="ck-label" style={{ fontSize: 9 }}>★ Loom zugesagt</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ck-accent)' }}>
                {threadsQuery.items.filter((t) => t.starred).length}
              </div>
            </div>
          </div>

          {/* RECON-1: der letzte Sync hat eine volle Seite (20 Konversationen)
              geliefert — solange Blättern ungeklärt ist, darf die Seite das nicht
              als Gesamtzahl ausgeben. Hängt bewusst am Sync-Ergebnis und nicht an
              der Zeilenzahl, denn gefilterte Anzeigen verfälschen die. */}
          {lastSyncPartial ? (
            <div style={{ fontSize: 11, color: 'var(--ck-warn)' }}>
              Der letzte Sync hat eine volle Seite von LinkedIn geladen — möglicherweise
              unvollständig, ältere Threads fehlen eventuell.
            </div>
          ) : null}

          <ThreadSection
            titel="Du bist dran"
            hinweis="Lead hat geantwortet · Sterne zuerst"
            entwurfMoeglich={!isOffline}
            threads={buckets.duBistDran}
            now={now}
            onSnoozeTomorrow={snoozeTomorrow}
            onMarkDone={(th) => void threadsQuery.markDone(th)}
            onGenerateDraft={(th) => void generateDraft(th)}
            onLoomVerschickt={(th) => void threadsQuery.markLoomVerschickt(th.id)}
          />

          <ThreadSection
            titel="Fällig heute"
            hinweis="älteste zuerst"
            entwurfMoeglich={!isOffline}
            threads={buckets.faellig}
            leerText="Keine fälligen Follow-ups."
            now={now}
            onSnoozeTomorrow={snoozeTomorrow}
            onMarkDone={(th) => void threadsQuery.markDone(th)}
            onGenerateDraft={(th) => void generateDraft(th)}
            onLoomVerschickt={(th) => void threadsQuery.markLoomVerschickt(th.id)}
          />

          <ThreadSection
            titel="Abschluss fällig"
            hinweis="letzte Nachricht, danach wird archiviert"
            entwurfMoeglich={!isOffline}
            threads={buckets.abschluss}
            now={now}
            onSnoozeTomorrow={snoozeTomorrow}
            onMarkDone={(th) => void threadsQuery.markDone(th)}
            onGenerateDraft={(th) => void generateDraft(th)}
            onLoomVerschickt={(th) => void threadsQuery.markLoomVerschickt(th.id)}
          />

          <ThreadSection
            titel="Altlasten"
            hinweis="über 30 Tage liegen geblieben, nie nachgefasst — wiederbeleben oder schließen"
            entwurfMoeglich={!isOffline}
            threads={buckets.verwaist}
            now={now}
            onSnoozeTomorrow={snoozeTomorrow}
            onMarkDone={(th) => void threadsQuery.markDone(th)}
            onGenerateDraft={(th) => void generateDraft(th)}
            onLoomVerschickt={(th) => void threadsQuery.markLoomVerschickt(th.id)}
          />

          <RuhtSection
            threads={buckets.ruht}
            now={now}
            onWake={(th) => void threadsQuery.wake(th.id)}
          />

          <section className="ck-panel" style={{ padding: 12 }}>
            <div className="ck-label" style={{ marginBottom: 8 }}>Abdeckung</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 12 }}>
              <div>Fällig: {cov.faellig}</div>
              <div>Du bist dran: {cov.du_bist_dran}</div>
              <div>Wartet: {cov.wartet}</div>
              <div>Prüfen: {cov.pruefen}</div>
              <div>Abschluss: {cov.abschluss}</div>
              <div>Ruht: {cov.ruht}</div>
              <div style={{ color: cov.nie_angeschrieben > 0 ? 'var(--ck-warn)' : undefined }}>
                Nie angeschrieben: {cov.nie_angeschrieben}
              </div>
              <div>Ohne Kontakt: {cov.ohne_kontakt}</div>
              <div style={{ color: cov.verwaist > 0 ? 'var(--ck-warn)' : undefined }}>Verwaist: {cov.verwaist}</div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--ck-text-3)', marginTop: 8 }}>
              Follow-up-Schwellen: {FOLLOWUP_THRESHOLDS_DAYS.join(' / ')} Tage (Stufe 0/1/2)
            </div>
          </section>

          {buckets.pruefen.length > 0 ? (
            <section className="ck-panel" style={{ overflow: 'hidden' }}>
              <div className="ck-label" style={{ padding: '10px 12px 8px' }}>Prüfen · {buckets.pruefen.length}</div>
              {buckets.pruefen.map((t) => (
                <div
                  key={t.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--ck-border)' }}
                >
                  {t.unread ? (
                    <span
                      title="Ungelesen im LinkedIn-Postfach"
                      aria-label="ungelesen"
                      style={{ width: 7, height: 7, flexShrink: 0, borderRadius: 99, background: 'var(--ck-accent)' }}
                    />
                  ) : null}
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ck-text-1)' }}>{t.name || 'Unbekannt'}</span>
                  {threadUrl(t.thread_key) ? (
                    <a href={threadUrl(t.thread_key)} target="_blank" rel="noreferrer" className="ck-btn" style={{ fontSize: 10, textDecoration: 'none' }}>
                      Im Postfach öffnen ↗
                    </a>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
