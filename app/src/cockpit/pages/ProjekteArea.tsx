import { useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { ProjectPage } from '../../pages/deliver/ProjectPage'
import { DELIVER_STAGE_LABEL } from '../../pages/deliver/stageLabels'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import type { DeliverProject } from '../../types/db'
import { useActiveBrand } from '../lib/activeBrand'
import { useKundenPosteingang } from '../lib/useKundenPosteingang'

/**
 * Projekte/Kundenportal im Cockpit (REBUILD): Liste der Deliver-Projekte der
 * aktiven Brand + Anlegen; Detail rendert die bestehende ProjectPage (Einladen,
 * Dateien, Website-CMS) via slugOverride/projectIdOverride.
 */
function ProjekteList() {
  const navigate = useNavigate()
  const { show } = useToast()
  const { activeBrand } = useActiveBrand()
  const projects = useDeliverProjects(activeBrand?.slug)
  // „An diesem Projekt liegt etwas" — offene Kundennachrichten und eingereichte
  // Website-Änderungen, gezählt aus derselben Quelle wie /freigaben.
  const { jeProjekt } = useKundenPosteingang(activeBrand?.slug)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const brandBroken = !activeBrand || activeBrand.id.startsWith('local-fallback-')

  const create = async () => {
    if (brandBroken) {
      show('Keine Brand verbunden — Projekt kann nicht angelegt werden (Brands laden nicht).', 'error')
      return
    }
    setSaving(true)
    try {
      const projectName = name.trim() || 'Neues Projekt'
      const row = await projects.create({ name: projectName, client_stage: 'onboarding' })
      setName('')
      setCreating(false)
      navigate(`/projekte/${row.id}`)
    } catch (e) {
      show(`Anlegen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Projekte & Kundenportale</div>
          <div className="ck-label" style={{ marginTop: 2 }}>
            Ein Projekt je Kunde — Einladung, geteilte Dateien, Website-CMS.
          </div>
        </div>
        {creating ? (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input
              className="ck-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create()
                if (e.key === 'Escape') setCreating(false)
              }}
              placeholder="Projektname / Kunde…"
              autoFocus
              style={{ fontSize: 12, width: 200 }}
            />
            <button className="ck-btn ck-btn--primary" disabled={saving} onClick={() => void create()}>
              {saving ? '…' : 'Anlegen'}
            </button>
          </span>
        ) : (
          <button className="ck-btn ck-btn--primary" onClick={() => setCreating(true)}>
            + Neues Projekt
          </button>
        )}
      </div>

      {brandBroken ? (
        <div
          className="ck-panel"
          style={{ padding: '10px 14px', marginBottom: 12, border: '1px solid var(--ck-warn)', color: 'var(--ck-warn)', fontSize: 12.5 }}
        >
          ⚠ Keine Brand verbunden — die Brand-Daten laden nicht aus Supabase. Deshalb funktionieren
          Projekte, E-Mail und Tracking-Speicherung gerade nicht. (Details siehe Cockpit-Banner /
          Browser-Konsole.)
        </div>
      ) : null}

      {projects.error ? (
        <div
          className="ck-panel"
          style={{ padding: '10px 14px', marginBottom: 12, border: '1px solid var(--ck-warn)', color: 'var(--ck-warn)', fontSize: 12.5 }}
        >
          Projekt-Fehler: {projects.error}
        </div>
      ) : null}

      {projects.loading ? (
        <p className="ck-label">Lade…</p>
      ) : projects.items.length === 0 ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Noch keine Projekte. Leg für einen Kunden eines an — danach kannst du ihn einladen,
            Dateien teilen und Website-Inhalte freigeben.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 12,
          }}
        >
          {projects.items.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              offenePost={jeProjekt.get(p.id) ?? 0}
              onOpen={() => navigate(`/projekte/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjectCard({
  project: p,
  onOpen,
  offenePost = 0,
}: {
  project: DeliverProject
  onOpen: () => void
  /** Offene Kundennachrichten + eingereichte Website-Änderungen dieses Projekts. */
  offenePost?: number
}) {
  const items = p.deliverables ?? []
  const total = items.length
  const done = items.filter((d) => d.status === 'fertig').length
  const stageIdx = Math.max(0, DELIVER_STAGE_ORDER.indexOf(p.client_stage))
  // Fortschritt: Deliverables, sonst Stage-Position als Näherung.
  const pct =
    total > 0
      ? Math.round((done / total) * 100)
      : Math.round((stageIdx / (DELIVER_STAGE_ORDER.length - 1)) * 100)
  const complete = pct >= 100

  return (
    <button
      onClick={onOpen}
      className="ck-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        textAlign: 'left',
        cursor: 'pointer',
        border: '1px solid var(--ck-border)',
        background: 'transparent',
        color: 'inherit',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.name}
          </span>
          <span
            className="ck-label"
            style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {p.client_name || 'Kein Kunde'}
            {p.client_email ? ` · ${p.client_email}` : ''}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {offenePost > 0 ? (
            <span
              className="ck-label"
              title={`${offenePost} offene${offenePost === 1 ? 'r' : ''} Posten vom Kunden — in /freigaben`}
              style={{
                padding: '3px 9px',
                borderRadius: 99,
                border: '1px solid var(--ck-accent)',
                background: 'var(--ck-accent-dim)',
                color: 'var(--ck-accent)',
              }}
            >
              {offenePost} neu
            </span>
          ) : null}
          <span
            className="ck-label"
            style={{
              padding: '3px 9px',
              borderRadius: 99,
              border: `1px solid ${complete ? 'var(--ck-accent)' : 'var(--ck-border)'}`,
              color: complete ? 'var(--ck-accent)' : undefined,
            }}
          >
            {DELIVER_STAGE_LABEL[p.client_stage] ?? p.client_stage}
          </span>
        </span>
      </div>

      {/* Stage-Stepper: 5 Punkte, bis zur aktuellen Phase gefüllt */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {DELIVER_STAGE_ORDER.map((stage, i) => (
          <span
            key={stage}
            title={DELIVER_STAGE_LABEL[stage] ?? stage}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= stageIdx ? 'var(--ck-accent)' : 'var(--ck-border)',
              opacity: i <= stageIdx ? 1 : 0.6,
            }}
          />
        ))}
      </div>

      {/* Fortschrittsbalken + Zähler */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span className="ck-label">
            {total > 0 ? `${done}/${total} Elemente fertig` : 'Noch keine Deliverables'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: complete ? 'var(--ck-accent)' : 'var(--ck-text-1)' }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--ck-border)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: complete ? 'var(--ck-accent)' : 'var(--ck-idle)',
              transition: 'width 300ms ease',
            }}
          />
        </div>
      </div>
    </button>
  )
}

function ProjektDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const { activeBrand, loading, error } = useActiveBrand()
  const navigate = useNavigate()

  // Kaltstart auf /projekte/:id (Lesezeichen, Reload, Weiche aus der alten
  // Brand-Welt): Die Brands laden asynchron, und `loading` steht dabei schon
  // auf false, während `activeBrand` noch null ist. Ohne dieses Warten
  // bekommt die ProjectPage `slug === undefined`, hält das für „kein Projekt"
  // und wirft auf die Cockpit-Home — das Lesezeichen führte ins Leere.
  if (!activeBrand) {
    return (
      <div className="ck-panel" style={{ padding: '12px 16px' }}>
        <p className="ck-label" style={{ margin: 0 }}>
          {error
            ? `Marke lädt nicht: ${error}`
            : loading
              ? 'Lade Projekt…'
              : 'Keine Marke verbunden — das Projekt kann nicht geladen werden.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <button
        className="ck-btn"
        onClick={() => navigate('/projekte')}
        style={{ marginBottom: 12, fontSize: 12 }}
      >
        ← Alle Projekte
      </button>
      <ProjectPage
        slugOverride={activeBrand?.slug}
        projectIdOverride={projectId}
        embeddedInTabs
      />
    </div>
  )
}

export function ProjekteArea() {
  return (
    <Routes>
      <Route index element={<ProjekteList />} />
      <Route path=":projectId" element={<ProjektDetail />} />
    </Routes>
  )
}
