import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getPhaseState, type PhaseKey } from '../../lib/phaseMapping'
import { isPitchProject } from '../../lib/projectAreas'
import { usePortalLeads } from '../../hooks/useProjectLeads'
import { useProjectOutcomes } from '../../hooks/useProjectOutcomes'
import type { DeliverProject } from '../../types/db'
import { OutcomeHeader } from '../phase/OutcomeHeader'
import { PhaseDashboard } from '../phase/PhaseDashboard'
import { PortalFilesSection } from './PortalFilesSection'
import { PortalPhaseContent } from './PortalPhaseContent'
import { PortalWebsiteEditor } from './PortalWebsiteEditor'
import { PortalPhaseMessageButton } from './PortalPhaseMessageButton'
import { useProjectMessages } from '../../hooks/useProjectMessages'
import { baueAbnahme, type AbnahmeArt } from '../../lib/abnahme'

interface PortalShellProps {
  project: DeliverProject
  brandName?: string
  accentColor: string
  senderName: string
  preview?: boolean
  onSignOut?: () => void
}

export function PortalShell({
  project,
  brandName,
  accentColor,
  senderName,
  preview = false,
  onSignOut,
}: PortalShellProps) {
  const pitchMode = isPitchProject(project)
  const dashboardPhases: PhaseKey[] | undefined = pitchMode ? ['website'] : undefined
  const { leads } = usePortalLeads(project.id)
  const { outcomes, loading: outcomesLoading } = useProjectOutcomes(undefined, project.id)
  const { unreadCount, send } = useProjectMessages(project.id, 'client', senderName)

  const leadCount = leads.length

  /**
   * O11 / D6: Freigabe und Änderungswunsch gehen über den BESTEHENDEN
   * Sendepfad als `sender_role='client'` — kein neues Schema, keine neue
   * Tabelle, keine zweite Statuswahrheit. Der Präfix macht die Nachricht
   * maschinenlesbar (siehe lib/abnahme.ts); im Vorschau-Modus wird nichts
   * verschickt, sonst legt ein Klick im Preview echte Zeilen an.
   */
  const meldeAbnahme = async (deliverableId: string, art: AbnahmeArt, text: string) => {
    if (preview) return true
    const res = await send(baueAbnahme(art, deliverableId, text))
    return res.ok
  }

  const renderPhaseContent = (phase: PhaseKey) => (
    <PortalPhaseContent
      phase={phase}
      project={project}
      accentColor={accentColor}
      leadCount={leadCount}
      onAbnahme={meldeAbnahme}
    />
  )

  const renderPhaseFooter = (phase: PhaseKey) => {
    if (getPhaseState(phase, project.client_stage) !== 'active') return null
    return (
      <PortalPhaseMessageButton
        projectId={project.id}
        senderName={senderName}
        accentColor={accentColor}
        brandName={brandName}
      />
    )
  }

  const startedAt = useMemo(() => project.updated_at ?? null, [project.updated_at])

  return (
    <div
      className="portal-shell"
      style={{ '--portal-accent': accentColor } as CSSProperties}
    >
      {preview ? (
        <div className="portal-preview-banner">Vorschau-Modus</div>
      ) : null}

      <header className="portal-shell__header">
        <div className="portal-shell__header-inner">
          <div className="portal-shell__brand">
            {brandName ? <span className="portal-shell__brand-name">{brandName}</span> : null}
            <h1 className="portal-shell__project">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? (
              <span
                className="font-mono inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5"
                style={{
                  fontSize: 10,
                  background: accentColor,
                  color: 'var(--chip-text-on-accent)',
                }}
                title="Neue Nachrichten"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
            {!preview && onSignOut ? (
              <button type="button" className="portal-btn portal-btn-ghost" onClick={onSignOut}>
                Abmelden
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="portal-shell__main">
        <OutcomeHeader
          outcomes={outcomes}
          projectName={project.name}
          startedAt={startedAt}
          loading={outcomesLoading}
          accentColor={accentColor}
        />

        <PhaseDashboard
          currentStage={project.client_stage}
          deliverables={project.deliverables}
          stageDurations={project.stage_durations}
          accentColor={accentColor}
          leadCount={leadCount}
          readOnlyDeliverables
          phases={dashboardPhases}
          renderPhaseContent={renderPhaseContent}
          renderPhaseFooter={renderPhaseFooter}
        />

        <PortalWebsiteEditor projectId={project.id} />

        <div className="portal-card mt-6">
          <PortalFilesSection projectId={project.id} documents={project.client_documents} />
        </div>

        {project.booking_url ? (
          <div className="portal-shell__booking mt-4">
            <a
              href={project.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="portal-btn portal-btn-primary"
              style={{ background: accentColor }}
            >
              Call buchen
            </a>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export function PortalCrmShell({
  project,
  brandName,
  accentColor,
  preview = false,
  onSignOut,
}: PortalShellProps) {
  const { outcomes, loading: outcomesLoading } = useProjectOutcomes(undefined, project.id)
  const { leads } = usePortalLeads(project.id)

  return (
    <div
      className="portal-shell portal-shell--crm"
      style={{ '--portal-accent': accentColor } as CSSProperties}
    >
      {preview ? (
        <div className="portal-preview-banner">Vorschau-Modus</div>
      ) : null}

      <header className="portal-shell__header">
        <div className="portal-shell__header-inner">
          <div className="portal-shell__brand">
            {brandName ? <span className="portal-shell__brand-name">{brandName}</span> : null}
            <h1 className="portal-shell__project">Meine Leads</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/portal/${project.id}`}
              className="portal-btn portal-btn-ghost"
              style={{ textDecoration: 'none' }}
            >
              ← Portal
            </Link>
            {!preview && onSignOut ? (
              <button type="button" className="portal-btn portal-btn-ghost" onClick={onSignOut}>
                Abmelden
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="portal-shell__main">
        <OutcomeHeader
          outcomes={outcomes}
          loading={outcomesLoading}
          accentColor={accentColor}
        />
        <PortalPhaseContent
          phase="scaling"
          project={{ ...project, client_stage: 'execute' }}
          accentColor={accentColor}
          leadCount={leads.length}
        />
      </main>
    </div>
  )
}
