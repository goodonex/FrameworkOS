import { Navigate, useLocation } from 'react-router-dom'
import { deliverRedirectZiel } from './legacyRouteMap'

/**
 * Brücke alte Brand-Oberfläche → Cockpit (Etappe 4, Schritt 2).
 *
 * Die `/brand/:slug/*`-Welt (BrandPage + Scroll-Flow + Deliver-Kette) ist
 * abgerissen. Alte Lesezeichen und Deep-Links aus E-Mails sollen trotzdem weich
 * landen statt auf einer leeren Seite:
 *
 *   /brand/:slug/deliver/:projectId → /projekte/:projectId
 *   /brand/:slug/deliver(/…)        → /projekte
 *   /brand/:slug(/…)                → /cockpit
 *
 * Der Slug aus der URL wird als aktive Cockpit-Brand übernommen — sonst landet
 * ein Lesezeichen aus Brand A im Projekt von Brand B.
 */

/** `/brand/:slug/deliver/*` → Projekte-Bereich (Detail, wenn eine ID dranhängt). */
export function LegacyDeliverRedirect() {
  const location = useLocation()

  return <Navigate to={`${deliverRedirectZiel(location.pathname)}${location.search}`} replace />
}

/** Alles übrige unter `/brand/:slug` → Cockpit-Home. */
export function LegacyBrandRedirect() {
  // Der Slug wird bewusst ignoriert — es gibt nur noch eine Brand.
  return <Navigate to="/cockpit" replace />
}
