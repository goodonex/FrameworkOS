import { Navigate, useLocation } from 'react-router-dom'

/**
 * Brücke alte Welt → Cockpit (Phase 4): /brand/:slug/sales/* → /sales/*.
 * Der Slug aus der URL wird seit dem 09.08.2026 verworfen — es gibt nur noch
 * eine Brand (siehe activeBrand.tsx), also gibt es auch nichts umzuschalten.
 */
export function LegacySalesRedirect() {
  const location = useLocation()

  const marker = '/sales'
  const idx = location.pathname.indexOf(marker)
  const rest = idx >= 0 ? location.pathname.slice(idx + marker.length) : ''

  // /pipeline, /heute und leer waren/sind die Default-Ansicht der alten Welt —
  // seit der Sales-Sektion (Juli 2026) ist /sales selbst das Dashboard, Pipeline
  // lebt unter /sales/pipeline → explizit dorthin normalisieren.
  const normalized = rest === '/pipeline' || rest === '/heute' || rest === '' ? '/pipeline' : rest

  return <Navigate to={`/sales${normalized}${location.search}`} replace />
}
