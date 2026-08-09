import { Link } from 'react-router-dom'
import { deliverablesForArea } from '../../lib/deliverableCatalog'
import { getPhaseState, type PhaseKey } from '../../lib/phaseMapping'
import type { DeliverProject } from '../../types/db'
import type { AbnahmeArt } from '../../lib/abnahme'
import { PortalBrandingView } from '../portal/PortalBrandingView'
import { PortalLeadDashboard } from '../portal/PortalLeadDashboard'
import { PortalLeadGenDashboard } from '../portal/PortalLeadGenDashboard'
import { PortalWebsiteView } from '../portal/PortalWebsiteView'

interface PortalPhaseContentProps {
  phase: PhaseKey
  project: DeliverProject
  accentColor: string
  leadCount: number
  /** O11: nur im Kundenportal gesetzt — Freigabe/Änderungswunsch als Nachricht. */
  onAbnahme?: (deliverableId: string, art: AbnahmeArt, text: string) => Promise<boolean>
}

export function PortalPhaseContent({
  phase,
  project,
  accentColor,
  leadCount,
  onAbnahme,
}: PortalPhaseContentProps) {
  const state = getPhaseState(phase, project.client_stage)
  if (state !== 'active') return null

  switch (phase) {
    case 'branding':
      return (
        <PortalBrandingView
          project={project}
          accentColor={accentColor}
          clientReadyOnly
          onAbnahme={onAbnahme}
        />
      )
    case 'website':
      return (
        <PortalWebsiteView
          project={project}
          accentColor={accentColor}
          clientReadyOnly
          onAbnahme={onAbnahme}
        />
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
          <Link
            to={`/portal/${project.id}/crm`}
            className="portal-btn portal-btn-primary inline-flex items-center justify-center gap-2"
            style={{ background: accentColor, textDecoration: 'none', alignSelf: 'flex-start' }}
          >
            → Zu meinen Leads
            {leadCount > 0 ? (
              <span className="font-mono" style={{ fontSize: 11, opacity: 0.9 }}>
                ({leadCount})
              </span>
            ) : null}
          </Link>
          <PortalLeadDashboard
            projectId={project.id}
            accentColor={accentColor}
            variant="crm"
            embedded
          />
        </div>
      )
    default:
      return null
  }
}

export function portalPhaseReadyCount(project: DeliverProject, phase: PhaseKey): number {
  if (phase === 'branding') {
    return deliverablesForArea(project.deliverables, 'branding').filter((d) => d.status === 'fertig')
      .length
  }
  if (phase === 'website') {
    return deliverablesForArea(project.deliverables, 'website').filter((d) => d.status === 'fertig')
      .length
  }
  return 0
}
