import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../components/Toast'
import { useActiveBrand } from '../lib/activeBrand'
import { RunnerHinweis } from '../components/RunnerHinweis'
import { getSeenWeeks, markWeekSeen, syncSocialBatchesFromRunner } from '../lib/socialApi'
import { loadSocialBatchHtml, loadSocialBatchList, type SocialBatchMeta } from '../lib/socialBatchStore'
import { postRun } from '../lib/runnerApi'
import { runnerDirekt } from '../lib/runnerBridge'
import { useContentManifest } from '../lib/useContentManifest'
import { LinkedinPosts } from '../components/content/LinkedinPosts'
import { ContentCard } from '../components/content/ContentCard'
import { ContentDetailPanel } from '../components/content/ContentDetailPanel'

/**
 * Content-Area (Cockpit /content): die wöchentlichen Content-Batches der
 * Content-Engine als „Nachricht" statt E-Mail. Quelle = Supabase (social_batches,
 * 0056) → funktioniert live/mobil über HTTPS. Ist das Cockpit lokal geöffnet und
 * der Runner erreichbar, werden frische Wochen vorher vom Filesystem gespiegelt.
 * Die self-contained Wochen-HTML wird per srcdoc gerendert (kein Mixed Content).
 */
const DATE_FMT = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })

/** Bestehende Wochen-Batch-Ansicht (Supabase, live/mobil) — unverändert. */
function WeeksView() {
  const { activeSlug } = useActiveBrand()
  const [list, setList] = useState<SocialBatchMeta[] | null>(null)
  const [activeWeek, setActiveWeek] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [seenTick, setSeenTick] = useState(0)
  const htmlCache = useRef<Map<string, string>>(new Map())
  // O9: `social_batches.posted` hat bis heute keinen Schreiber — das Badge war
  // damit nie wahr. Die belastbare Auskunft steht in content.json: eine Woche
  // gilt als gepostet, wenn alle ihre Posts es sind. Keine zweite Wahrheit,
  // nur die richtige gelesen.
  const { manifest, markierePostGepostet } = useContentManifest(activeSlug)
  const direkt = runnerDirekt()

  const wochenStand = useMemo(() => {
    const stand = new Map<string, { gesamt: number; gepostet: number }>()
    for (const p of manifest?.posts ?? []) {
      if (!p.week) continue
      const cur = stand.get(p.week) ?? { gesamt: 0, gepostet: 0 }
      cur.gesamt++
      if (p.status === 'posted') cur.gepostet++
      stand.set(p.week, cur)
    }
    return stand
  }, [manifest])

  const istGepostet = (w: SocialBatchMeta) => {
    const s = wochenStand.get(w.week)
    return w.posted || (s != null && s.gesamt > 0 && s.gepostet === s.gesamt)
  }

  const refreshList = useCallback(async () => {
    const rows = await loadSocialBatchList(activeSlug)
    setList(rows)
    return rows
  }, [activeSlug])

  const openWeek = useCallback(
    async (week: string) => {
      setActiveWeek(week)
      markWeekSeen(week)
      setSeenTick((t) => t + 1)
      const cached = htmlCache.current.get(week)
      if (cached != null) {
        setHtml(cached)
        return
      }
      setHtmlLoading(true)
      setHtml(null)
      const h = await loadSocialBatchHtml(activeSlug, week)
      htmlCache.current.set(week, h ?? '')
      setHtml(h ?? '')
      setHtmlLoading(false)
    },
    [activeSlug],
  )

  useEffect(() => {
    let alive = true
    htmlCache.current.clear()
    setList(null)
    ;(async () => {
      // Erst schnell aus Supabase zeigen …
      let rows = await refreshList()
      // … dann lokal frische Wochen spiegeln (no-op ohne Runner) und neu laden.
      setSyncing(true)
      const synced = await syncSocialBatchesFromRunner(activeSlug).catch(() => 0)
      if (!alive) return
      setSyncing(false)
      if (synced > 0) rows = await refreshList()
      if (!alive) return
      if (rows[0]) void openWeek(rows[0].week)
    })()
    return () => {
      alive = false
    }
  }, [activeSlug, refreshList, openWeek])

  const seen = useMemo(() => getSeenWeeks(), [seenTick, list])
  const active = useMemo(() => list?.find((w) => w.week === activeWeek) ?? null, [list, activeWeek])

  const openInTab = () => {
    if (!html) return
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  if (!list) return <p className="ck-label">Lade…</p>

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Content · Wochen-Batches</div>
        <div className="ck-label" style={{ marginTop: 2 }}>
          {list.length > 0
            ? `${list.length} Woche${list.length === 1 ? '' : 'n'} · vom Montags-Lauf geliefert`
            : 'Noch kein Batch — der Montags-Lauf legt hier die Woche als klickbares Paket ab'}
          {syncing ? ' · spiegle lokal…' : ''}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Sobald der Montags-Lauf eine Woche gebaut hat, taucht sie hier als Nachricht auf —
            sichten, auswählen, selbst posten.
          </p>
          <p className="ck-label" style={{ marginTop: 8, color: 'var(--ck-text-3)' }}>
            Bestehende Wochen erscheinen, sobald das Cockpit einmal lokal mit laufendem Runner
            geöffnet wird (spiegelt die Pakete nach Supabase).
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 16, alignItems: 'start' }}>
          {/* Liste = „Posteingang" */}
          <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {list.map((w) => {
              const isNew = !seen.has(w.week)
              const isActive = w.week === activeWeek
              return (
                <button
                  key={w.week}
                  onClick={() => void openWeek(w.week)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '11px 13px',
                    background: isActive ? 'var(--ck-border)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--ck-border)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 7,
                        height: 7,
                        flexShrink: 0,
                        borderRadius: 99,
                        background: isNew ? 'var(--ck-accent)' : 'transparent',
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: isNew ? 600 : 500 }}>{w.week}</span>
                    {istGepostet(w) ? (
                      <span className="ck-label" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ck-accent)' }}>
                        gepostet
                      </span>
                    ) : isNew ? (
                      <span className="ck-label" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ck-accent)' }}>
                        neu
                      </span>
                    ) : null}
                  </span>
                  <span className="ck-label" style={{ display: 'block', marginLeft: 14, marginTop: 3 }}>
                    {w.postsCount > 0 ? `${w.postsCount} Posts · ` : ''}
                    {w.generatedAt ? DATE_FMT.format(new Date(w.generatedAt)) : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Vorschau der self-contained Wochen-HTML (srcdoc) */}
          <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {active ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderBottom: '1px solid var(--ck-border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{active.title || `Woche ${active.week}`}</span>
                  <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    {istGepostet(active) || !wochenStand.has(active.week) ? null : (
                      <button
                        className="ck-btn"
                        style={{ fontSize: 11.5, opacity: direkt ? 1 : 0.45 }}
                        disabled={!direkt}
                        title={
                          direkt
                            ? 'Setzt alle Posts dieser Woche in content.json auf „Gepostet"'
                            : 'Am Rechner markieren — content.json liegt im Vault und nur der Runner schreibt sie'
                        }
                        onClick={() => void markierePostGepostet({ week: active.week })}
                      >
                        Als gepostet markieren
                      </button>
                    )}
                    <button className="ck-btn" style={{ fontSize: 11.5 }} onClick={openInTab} disabled={!html}>
                      In neuem Tab ↗
                    </button>
                  </span>
                </div>
                {htmlLoading ? (
                  <p className="ck-label" style={{ padding: 16 }}>Lade Vorschau…</p>
                ) : html ? (
                  <iframe
                    key={active.week}
                    srcDoc={html}
                    title={active.title || active.week}
                    // Eigener, self-generierter Content → allow-scripts für die
                    // Galerie-Interaktion (Lightbox/Navigation) ist unbedenklich.
                    sandbox="allow-same-origin allow-scripts allow-popups"
                    style={{ width: '100%', height: '72vh', border: 'none', background: '#fff', display: 'block' }}
                  />
                ) : (
                  <p className="ck-label" style={{ padding: 16 }}>Für diese Woche liegt kein Inhalt vor.</p>
                )}
              </>
            ) : (
              <p className="ck-label" style={{ padding: 16 }}>Woche links wählen.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Content-Area (Cockpit /content): Umschalter zwischen der neuen Post-Ebene
 * (Datei-Manifest via Runner, lokal-first, nach /ads-Vorbild) und der bestehenden
 * Wochen-Batch-Ansicht (Supabase, live/mobil). Default = Posts.
 */
/**
 * Content mit Kanal-Tabs (Phase 2, Zug C1 · D10).
 *
 * LinkedIn ist text-first und bekommt eine eigene Ansicht; Instagram bleibt
 * slide-first genau so, wie es war — inklusive seiner Posts/Wochen-Umschaltung.
 * Die Kanaele stehen oben, weil die Frage „welcher Kanal" vor der Frage
 * „welche Ebene" kommt.
 */
export function SocialArea() {
  const [kanal, setKanal] = useState<'linkedin' | 'instagram'>('linkedin')
  const [view, setView] = useState<'posts' | 'weeks'>('posts')
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          className={`ck-btn${kanal === 'linkedin' ? ' ck-btn--primary' : ''}`}
          onClick={() => setKanal('linkedin')}
        >
          LinkedIn
        </button>
        <button
          className={`ck-btn${kanal === 'instagram' ? ' ck-btn--primary' : ''}`}
          onClick={() => setKanal('instagram')}
        >
          Instagram
        </button>
      </div>

      {kanal === 'linkedin' ? (
        <LinkedinKanal />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <button
              className={`ck-btn${view === 'posts' ? ' ck-btn--primary' : ''}`}
              onClick={() => setView('posts')}
            >
              Posts
            </button>
            <button
              className={`ck-btn${view === 'weeks' ? ' ck-btn--primary' : ''}`}
              onClick={() => setView('weeks')}
            >
              Wochen
            </button>
          </div>
          {view === 'posts' ? <ContentPostsView /> : <WeeksView />}
        </>
      )}
    </div>
  )
}

/** Der LinkedIn-Kanal: dieselbe Manifest-Quelle, auf `channel` gefiltert. */
function LinkedinKanal() {
  const { activeSlug } = useActiveBrand()
  const { manifest, loading, error, setCaption, markierePostGepostet } = useContentManifest(activeSlug)
  const direkt = runnerDirekt()
  const posts = (manifest?.posts ?? []).filter((p) => p.channel === 'linkedin')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>LinkedIn · Beiträge</div>
          <div className="ck-label" style={{ marginTop: 2 }}>
            {posts.length} Beitrag{posts.length === 1 ? '' : 'e'}
          </div>
        </div>
      </div>

      {error ? (
        <RunnerHinweis error={error} was="Die LinkedIn-Beiträge" hinweis="Die Wochen-Ansicht bleibt überall verfügbar." />
      ) : loading || !manifest ? (
        <p className="ck-label">Lade…</p>
      ) : (
        <LinkedinPosts
          posts={posts}
          onSetCaption={setCaption}
          onMarkiereGepostet={(postId) => void markierePostGepostet({ postId })}
          runnerDirekt={direkt}
        />
      )}
    </div>
  )
}

/** Post-Ebene: Karten-Grid + Detail-Panel aus content.json (via Runner, lokal-first). */
function ContentPostsView() {
  const { activeSlug, activeBrand } = useActiveBrand()
  const { show } = useToast()
  const {
    manifest,
    loading,
    error,
    setStatus,
    toggleDone,
    setPlannedFor,
    setChannel,
    setFormat,
    addNote,
    markierePostGepostet,
  } = useContentManifest(activeSlug)
  const [openId, setOpenId] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  // content.json liegt im Vault; nur der Runner schreibt sie (D5). Am Handy
  // gibt es keinen Weg dorthin — der Knopf sagt das, statt still zu scheitern.
  const direkt = runnerDirekt()

  const brandName = activeBrand?.name ?? activeSlug
  const openPost = manifest?.posts.find((p) => p.id === openId) ?? null

  const buildBatch = async () => {
    setBuilding(true)
    try {
      await postRun('weekly-content')
      show('Content-Batch gestartet — Ergebnis erscheint unter /agenten.', 'success')
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409) {
        show('Läuft bereits — der Batch ist schon in Arbeit.', 'info')
      } else {
        show('Runner nicht erreichbar — Batch nur lokal startbar (npm run cockpit:full).', 'error')
      }
    } finally {
      setBuilding(false)
    }
  }

  // Nicht-gemappte Brand (Runner 400): freundlicher Phase-3-Leerzustand statt Fehlerbanner.
  const isUnknownBrand = !!error && /Unbekannter Brand/i.test(error)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Content · Posts</div>
          <div className="ck-label" style={{ marginTop: 2 }}>
            {manifest ? `${manifest.posts.length} Post${manifest.posts.length === 1 ? '' : 's'} · ${brandName}` : brandName}
          </div>
        </div>
        <button className="ck-btn ck-btn--primary" style={{ fontSize: 12 }} onClick={buildBatch} disabled={building}>
          {building ? 'Starte…' : 'Neue Beiträge bauen'}
        </button>
      </div>

      {isUnknownBrand ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Für <strong>{brandName}</strong> ist noch kein Content-Ordner angelegt.
          </p>
          <p className="ck-label" style={{ marginTop: 8, color: 'var(--ck-text-3)' }}>
            Die Post-Ebene ist aktuell für HERRMANN aktiv — weitere Brands folgen (Phase 3).
          </p>
        </div>
      ) : error ? (
        <RunnerHinweis
          error={error}
          was="Die Post-Ebene"
          hinweis="Die Wochen-Ansicht bleibt überall verfügbar."
        />
      ) : loading || !manifest ? (
        <p className="ck-label">Lade…</p>
      ) : manifest.posts.length === 0 ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Noch keine Posts im Manifest ({activeSlug}/content-engine/content.json).
          </p>
          <p className="ck-label" style={{ marginTop: 8, color: 'var(--ck-text-3)' }}>
            „Neue Beiträge bauen" startet den wöchentlichen Content-Batch.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {manifest.posts.map((post) => (
            <ContentCard key={post.id} post={post} onOpen={() => setOpenId(post.id)} />
          ))}
        </div>
      )}

      {openPost ? (
        <ContentDetailPanel
          post={openPost}
          onClose={() => setOpenId(null)}
          onSetStatus={setStatus}
          onToggleDone={toggleDone}
          onSetPlannedFor={setPlannedFor}
          onSetChannel={setChannel}
          onSetFormat={setFormat}
          onAddNote={addNote}
          onMarkiereGepostet={(postId) => void markierePostGepostet({ postId })}
          runnerDirekt={direkt}
        />
      ) : null}
    </div>
  )
}
