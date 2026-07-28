import { Navigate, useLocation, useParams } from 'react-router-dom'
import { storeBrandSlug } from './activeBrand'

/**
 * Brücke alte Welt → Cockpit (Phase 4): /brand/:slug/sales/* → /sales/*.
 * Übernimmt den Slug aus der URL als aktive Cockpit-Brand, damit interne
 * Links aus SalesMode (die weiter auf /brand/… zeigen) korrekt landen.
 */
export function LegacySalesRedirect() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()

  if (slug) storeBrandSlug(slug)

  const marker = '/sales'
  const idx = location.pathname.indexOf(marker)
  const rest = idx >= 0 ? location.pathname.slice(idx + marker.length) : ''

  // /pipeline, /heute und leer waren/sind die Default-Ansicht der alten Welt —
  // seit der Sales-Sektion (Juli 2026) ist /sales selbst das Dashboard, Pipeline
  // lebt unter /sales/pipeline → explizit dorthin normalisieren.
  const normalized = rest === '/pipeline' || rest === '/heute' || rest === '' ? '/pipeline' : rest

  return <Navigate to={`/sales${normalized}${location.search}`} replace />
}
