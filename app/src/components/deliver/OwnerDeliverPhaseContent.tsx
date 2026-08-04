import { getPhaseState, type PhaseKey } from '../../lib/phaseMapping'
import type { DeliverProject } from '../../types/db'
import { PortalBrandingView } from '../portal/PortalBrandingView'
import { PortalLeadGenDashboard } from '../portal/PortalLeadGenDashboard'
import { PortalWebsiteView } from '../portal/PortalWebsiteView'
import { ProjectLeadsPanel } from './ProjectLeadsPanel'
import { ProjectMessagesPanel } from './ProjectMessagesPanel'

interface OwnerDeliverPhaseContentProps {
  phase: PhaseKey
  project: DeliverProject
  slug: string
  accentColor?: string
  senderName: string
  renderDeliverablesEditor: (area: 'branding' | 'website') => React.ReactNode
}

export function OwnerDeliverPhaseContent({
  phase,
  project,
  slug,
  accentColor = 'var(--ck-accent)',
  senderName,
  renderDeliverablesEditor,
}: OwnerDeliverPhaseContentProps) {
  const state = getPhaseState(phase, project.internal_stage)
  if (state !== 'active') return null

  switch (phase) {
    case 'branding':
      return (
        <div className="flex flex-col gap-4">
          <PortalBrandingView project={project} accentColor={accentColor} />
          {renderDeliverablesEditor('branding')}
        </div>
      )
    case 'website':
      return (
        <div className="flex flex-col gap-4">
          <PortalWebsiteView project={project} accentColor={accentColor} />
          {renderDeliverablesEditor('website')}
        </div>
      )
    case 'leadgen':
      return (
        <PortalLeadGenDashboard
          projectId={project.id}
          accentColor={accentColor}
          stageDurations={project.stage_durations}
          visible
          embedded
        />
      )
    case 'scaling':
      return (
        <div className="flex flex-col gap-4">
          <ProjectLeadsPanel slug={slug} project={project} />
          <ProjectMessagesPanel projectId={project.id} senderName={senderName} />
        </div>
      )
    default:
      return null
  }
}

export function OwnerClientPreviewPhaseContent({
  phase,
  project,
  accentColor = 'var(--ck-accent)',
}: {
  phase: PhaseKey
  project: DeliverProject
  accentColor?: string
}) {
  const state = getPhaseState(phase, project.client_stage)
  if (state !== 'active') return null

  switch (phase) {
    case 'branding':
      return <PortalBrandingView project={project} accentColor={accentColor} clientReadyOnly />
    case 'website':
      return <PortalWebsiteView project={project} accentColor={accentColor} clientReadyOnly />
    case 'leadgen':
      return (
        <PortalLeadGenDashboard
          projectId={project.id}
          accentColor={accentColor}
          stageDurations={project.stage_durations}
          visible
          embedded
        />
      )
    case 'scaling':
      return null
    default:
      return null
  }
}
