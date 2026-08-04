/**
 * Pfad-Abbildung der abgerissenen Brand-Oberfläche auf die Cockpit-Welt
 * (Etappe 4, Schritt 2). Bewusst frei von React und Supabase, damit
 * `scripts/verify-legacy-redirects.ts` das ohne Browser prüfen kann.
 */

/**
 * `/brand/:slug/deliver/*` → Projekte-Bereich.
 *
 * `completed` und `moon` waren Listen-Ansichten der alten Deliver-Welt, keine
 * Projekt-IDs — die dürfen nicht als `/projekte/completed` enden.
 */
export function deliverRedirectZiel(pathname: string): string {
  const marker = '/deliver'
  const idx = pathname.indexOf(marker)
  const rest = idx >= 0 ? pathname.slice(idx + marker.length) : ''
  const first = rest.split('/').filter(Boolean)[0] ?? ''

  const istListe = first === '' || first === 'completed' || first === 'moon'
  return istListe ? '/projekte' : `/projekte/${first}`
}
