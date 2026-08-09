import {
  areaProgress,
  deliverablesForArea,
} from '../../lib/deliverableCatalog'
import { getDeliverableUrl } from '../../lib/portalNavigation'
import type { DeliverProject } from '../../types/db'
import type { AbnahmeArt } from '../../lib/abnahme'
import { PortalDeliverableCard } from './PortalDeliverableCard'

interface PortalWebsiteViewProps {
  project: DeliverProject
  accentColor: string
  clientReadyOnly?: boolean
  /** O11: nur im Kundenportal gesetzt — reicht die Abnahme an den Sendepfad durch. */
  onAbnahme?: (deliverableId: string, art: AbnahmeArt, text: string) => Promise<boolean>
}

export function PortalWebsiteView({
  project,
  accentColor,
  clientReadyOnly = false,
  onAbnahme,
}: PortalWebsiteViewProps) {
  const allItems = deliverablesForArea(project.deliverables, 'website')
  const items = clientReadyOnly ? allItems.filter((d) => d.status === 'fertig') : allItems
  const { ready, total } = areaProgress(items)
  const liveUrl = getDeliverableUrl(project, 'website_live_url')
  const devItem = items.find((d) => d.type === 'website_development')

  return (
    <div className="portal-area-view">
      <header className="portal-area-view__head">
        <div>
          <h2 className="portal-area-view__title">Website</h2>
          <p className="portal-area-view__meta">
            {ready} von {total} Elemente · {devItem?.progress ?? 0}% Entwicklung
          </p>
        </div>
      </header>

      {liveUrl ? (
        <div className="portal-website-hero">
          <iframe
            title="Live Website"
            src={liveUrl}
            className="portal-website-hero__frame"
            sandbox="allow-scripts allow-same-origin"
          />
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-website-hero__open"
            style={{ background: accentColor }}
          >
            Live-Website öffnen ↗
          </a>
        </div>
      ) : (
        <div className="portal-website-hero portal-website-hero--build">
          <div className="portal-website-hero__build-label">In Entwicklung</div>
          <div className="portal-website-hero__build-bar">
            <div
              style={{
                width: `${devItem?.progress ?? 0}%`,
                background: accentColor,
              }}
            />
          </div>
          <span>{devItem?.progress ?? 0}% fertig</span>
        </div>
      )}

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
