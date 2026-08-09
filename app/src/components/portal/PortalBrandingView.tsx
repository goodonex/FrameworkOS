import type { CSSProperties } from 'react'
import {
  areaProgress,
  deliverablesForArea,
} from '../../lib/deliverableCatalog'
import type { DeliverProject } from '../../types/db'
import type { AbnahmeArt } from '../../lib/abnahme'
import { PortalDeliverableCard } from './PortalDeliverableCard'

interface PortalBrandingViewProps {
  project: DeliverProject
  accentColor: string
  /** Client-Portal: nur fertige Deliverables anzeigen */
  clientReadyOnly?: boolean
  /** O11: nur im Kundenportal gesetzt — reicht die Abnahme an den Sendepfad durch. */
  onAbnahme?: (deliverableId: string, art: AbnahmeArt, text: string) => Promise<boolean>
}

export function PortalBrandingView({
  project,
  accentColor,
  clientReadyOnly = false,
  onAbnahme,
}: PortalBrandingViewProps) {
  const allItems = deliverablesForArea(project.deliverables, 'branding')
  const items = clientReadyOnly ? allItems.filter((d) => d.status === 'fertig') : allItems
  const { ready, total } = areaProgress(items)

  return (
    <div className="portal-area-view">
      <header className="portal-area-view__head">
        <div>
          <h2 className="portal-area-view__title">Branding</h2>
          <p className="portal-area-view__meta">
            {ready} von {total} Elementen fertig — dein Markenfundament
          </p>
        </div>
        <div className="portal-area-view__progress-ring" style={{ '--portal-accent': accentColor } as CSSProperties}>
          <svg viewBox="0 0 36 36">
            <path
              className="portal-area-view__ring-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="portal-area-view__ring-fill"
              stroke={accentColor}
              strokeDasharray={`${total > 0 ? (ready / total) * 100 : 0}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span>{total > 0 ? Math.round((ready / total) * 100) : 0}%</span>
        </div>
      </header>
      <div className="portal-deliverable-grid">
        {items.map((item) => (
          <PortalDeliverableCard
            key={item.id}
            item={item}
            clientStage={project.client_stage}
            accentColor={accentColor}
            onAbnahme={onAbnahme ? (art, text) => onAbnahme(item.id, art, text) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
