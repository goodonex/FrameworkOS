import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AdCard } from '../components/ads/AdCard'
import { AdDetailPanel } from '../components/ads/AdDetailPanel'
import { RunnerHinweis } from '../components/RunnerHinweis'
import type { AdsOverviewEntry, DerivedMetrics, Kunde } from '../lib/adsApi'
import {
  ACTIVE_STATUSES,
  AD_STATUS_LABEL,
  deriveMetrics,
  EUR,
  EUR2,
  fetchAdsOverview,
  fetchKunden,
  kundenFileUrl,
  latestVersion,
  NUM,
  sumMetrics,
} from '../lib/adsApi'
import { useAdManifest } from '../lib/useAdManifest'

/**
 * Ads-Area (Ablage + Review): Kunden aus Kunden/cockpit-kunden.json,
 * Ad-Creatives + Checklisten aus <Kundenordner>/05_leadgen/ads.json (via Runner).
 * Bewusst ohne Supabase und ohne Copy-Editor — Copy-Änderungen macht Claude
 * auf den Dateien im Kundenordner.
 */
export function AdsArea() {
  return (
    <Routes>
      <Route index element={<AdsDashboard />} />
      <Route path=":kunde" element={<KundePage />} />
      <Route path=":kunde/:adId" element={<KundePage />} />
    </Routes>
  )
}

/** Eine Ad-Zeile im Dashboard, angereichert mit Kunde + abgeleiteten Metriken. */
interface DashboardRow {
  kunde: Kunde
  adId: string
  title: string
  angle?: string
  status: string
  version: number
  preview: string | null
  metrics: DerivedMetrics
}

function buildRows(entries: AdsOverviewEntry[]): DashboardRow[] {
  const rows: DashboardRow[] = []
  for (const { kunde, manifest } of entries) {
    for (const ad of manifest.ads) {
      const ver = latestVersion(ad)
      rows.push({
        kunde,
        adId: ad.id,
        title: ad.title,
        angle: ad.angle,
        status: ad.status,
        version: ver?.v ?? 1,
        preview: ver?.preview ? kundenFileUrl(kunde, ver.preview) : null,
        metrics: deriveMetrics(ver?.metrics),
      })
    }
  }
  return rows
}

function AdsDashboard() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<AdsOverviewEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchAdsOverview()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const allRows = useMemo(() => (entries ? buildRows(entries) : []), [entries])
  const activeRows = useMemo(() => allRows.filter((r) => ACTIVE_STATUSES.includes(r.status as never)), [allRows])
  const hasActive = activeRows.length > 0
  const rows = showAll || !hasActive ? allRows : activeRows

  // Beste Performance zuerst: mit Daten oben (nach CPL aufsteigend), dann der Rest.
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.metrics.hasData !== b.metrics.hasData) return a.metrics.hasData ? -1 : 1
      if (a.metrics.cpl != null && b.metrics.cpl != null) return a.metrics.cpl - b.metrics.cpl
      return 0
    })
  }, [rows])

  const totals = useMemo(() => sumMetrics(rows.map((r) => r.metrics)), [rows])

  if (error) {
    return <RunnerHinweis error={error} was="Die Ads-Auswertung" />
  }
  if (!entries) return <p className="ck-label">Lade…</p>

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Ads · Performance</div>
          <div className="ck-label" style={{ marginTop: 2 }}>
            {hasActive
              ? `${activeRows.length} aktive Ads über ${entries.length} Kunden`
              : `Noch keine aktiven Ads — ${allRows.length} in Vorbereitung`}
          </div>
        </div>
        {hasActive ? (
          <button className="ck-btn" onClick={() => setShowAll((v) => !v)} style={{ fontSize: 12 }}>
            {showAll ? 'Nur aktive' : 'Alle anzeigen'}
          </button>
        ) : null}
      </div>

      {/* KPI-Kacheln */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Ad-Spend" value={totals.hasData ? EUR.format(totals.spend) : '—'} />
        <Kpi label="Leads" value={totals.hasData ? NUM.format(totals.leads) : '—'} />
        <Kpi label="Ø CPL" value={totals.cpl != null ? EUR2.format(totals.cpl) : '—'} accent />
        <Kpi label="Ø CTR" value={totals.ctr != null ? `${totals.ctr.toFixed(2).replace('.', ',')} %` : '—'} />
      </div>

      {!totals.hasData ? (
        <div className="ck-panel" style={{ padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--ck-text-2)' }}>
          Sobald die Kampagnen laufen, kommen hier die Meta-Zahlen rein (Spend, Leads, CPL, CTR) — pro
          Ad ins Manifest gepflegt oder per Claude eingetragen. Die Tabelle zeigt sie dann automatisch.
        </div>
      ) : null}

      {/* Tabelle */}
      <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ck-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5 }}>
              <th style={thStyle}>Kunde</th>
              <th style={thStyle}>Ad</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Spend</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Leads</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CPL</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CTR</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr
                key={`${r.kunde.slug}-${r.adId}`}
                onClick={() => navigate(`/ads/${r.kunde.slug}/${r.adId}`)}
                style={{ borderTop: '1px solid var(--ck-border)', cursor: 'pointer' }}
              >
                <td style={tdStyle}>{r.kunde.name}</td>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                  <span className="ck-label" style={{ display: 'block' }}>v{r.version}</span>
                </td>
                <td style={tdStyle}>
                  <StatusPill status={r.status} />
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.metrics.hasData ? EUR.format(r.metrics.spend) : '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.metrics.hasData ? NUM.format(r.metrics.leads) : '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                  {r.metrics.cpl != null ? EUR2.format(r.metrics.cpl) : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {r.metrics.ctr != null ? `${r.metrics.ctr.toFixed(2).replace('.', ',')} %` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kunden-Sprungmarken */}
      <div style={{ marginTop: 20 }}>
        <div className="ck-label" style={{ marginBottom: 8 }}>Kunden</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {entries.map(({ kunde }) => (
            <button key={kunde.slug} className="ck-btn" style={{ fontSize: 12 }} onClick={() => navigate(`/ads/${kunde.slug}`)}>
              {kunde.name} →
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const thStyle: CSSProperties = { padding: '9px 12px', fontWeight: 600 }
const tdStyle: CSSProperties = { padding: '9px 12px', verticalAlign: 'top' }

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="ck-panel" style={{ padding: '12px 14px' }}>
      <div className="ck-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: accent ? 'var(--ck-accent)' : undefined }}>{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const isLive = status === 'live'
  const isApproved = status === 'approved'
  const color = isLive || isApproved ? 'var(--ck-accent)' : status === 'review' ? 'var(--ck-warn)' : 'var(--ck-text-3)'
  return (
    <span className="ck-label" style={{ padding: '2px 8px', borderRadius: 99, border: `1px solid ${color}`, color }}>
      {AD_STATUS_LABEL[status as keyof typeof AD_STATUS_LABEL] ?? status}
    </span>
  )
}

function useKunden() {
  const [kunden, setKunden] = useState<Kunde[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchKunden()
      .then(setKunden)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  return { kunden, error }
}

function KundePage() {
  const navigate = useNavigate()
  const { kunde: slug, adId } = useParams<{ kunde: string; adId?: string }>()
  const { kunden, error: kundenError } = useKunden()
  const kunde = useMemo(() => kunden?.find((k) => k.slug === slug), [kunden, slug])
  const { manifest, loading, error, toggleCheck, addNote, setStatus } = useAdManifest(slug)

  const openAd = manifest?.ads.find((a) => a.id === adId)
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ad of manifest?.ads ?? []) counts.set(ad.status, (counts.get(ad.status) ?? 0) + 1)
    return [...counts.entries()]
  }, [manifest])

  if (kundenError || error) {
    return (
      <div className="ck-panel" style={{ padding: '10px 14px', border: '1px solid var(--ck-warn)', color: 'var(--ck-warn)', fontSize: 12.5, maxWidth: 820 }}>
        {kundenError ?? error}
      </div>
    )
  }
  if (!kunden || loading) return <p className="ck-label">Lade…</p>
  if (!kunde) {
    return (
      <div style={{ maxWidth: 820 }}>
        <p className="ck-label">Unbekannter Kunde: {slug}</p>
        <button className="ck-btn" onClick={() => navigate('/ads')}>← Alle Kunden</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <button className="ck-btn" onClick={() => navigate('/ads')} style={{ marginBottom: 12, fontSize: 12 }}>
        ← Alle Kunden
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{kunde.name}</div>
          <div className="ck-label" style={{ marginTop: 2 }}>
            {manifest?.ads.length ?? 0} Ads
            {statusCounts.map(([s, n]) => ` · ${n} ${AD_STATUS_LABEL[s as keyof typeof AD_STATUS_LABEL] ?? s}`).join('')}
          </div>
        </div>
      </div>

      <WebsiteTile kunde={kunde} />

      {manifest && manifest.overviewFiles.length > 0 ? (
        <div className="ck-panel" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="ck-label" style={{ marginRight: 4 }}>Kampagnen-Seiten:</span>
          {manifest.overviewFiles.map((f) => {
            const url = kundenFileUrl(kunde, f.path)
            return url ? (
              <a
                key={f.path}
                className="ck-btn"
                style={{ fontSize: 11.5, textDecoration: 'none' }}
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {f.label} ↗
              </a>
            ) : null
          })}
        </div>
      ) : null}

      {!manifest || manifest.ads.length === 0 ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Noch keine Ads im Manifest ({kunde.adsDir ?? '05_leadgen'}/ads.json).
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {manifest.ads.map((ad) => (
            <AdCard key={ad.id} kunde={kunde} ad={ad} onOpen={() => navigate(`/ads/${kunde.slug}/${ad.id}`)} />
          ))}
        </div>
      )}

      {openAd ? (
        <AdDetailPanel
          kunde={kunde}
          ad={openAd}
          onClose={() => navigate(`/ads/${kunde.slug}`)}
          onToggleCheck={toggleCheck}
          onAddNote={addNote}
          onSetStatus={setStatus}
        />
      ) : null}
    </div>
  )
}

function WebsiteTile({ kunde }: { kunde: Kunde }) {
  const [open, setOpen] = useState(false)
  const site = kunde.website
  if (!site?.live && !site?.dev) return null

  return (
    <div className="ck-panel" style={{ padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Website</span>
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {site.live ? (
            <a className="ck-btn" style={{ fontSize: 11.5, textDecoration: 'none' }} href={site.live} target="_blank" rel="noreferrer">
              Live öffnen ↗
            </a>
          ) : null}
          {site.dev ? (
            <a
              className="ck-btn"
              style={{ fontSize: 11.5, textDecoration: 'none' }}
              href={site.dev}
              target="_blank"
              rel="noreferrer"
              title="Nur erreichbar, wenn der Dev-Server läuft"
            >
              Dev öffnen ↗
            </a>
          ) : null}
          {site.live ? (
            <button className="ck-btn" style={{ fontSize: 11.5 }} onClick={() => setOpen((v) => !v)}>
              {open ? 'Preview zu' : 'Preview'}
            </button>
          ) : null}
        </span>
      </div>
      {open && site.live ? (
        <iframe
          src={site.live}
          title={`${kunde.name} Website`}
          style={{ width: '100%', height: 420, border: '1px solid var(--ck-border)', borderRadius: 8, marginTop: 10, background: '#fff' }}
        />
      ) : null}
    </div>
  )
}
