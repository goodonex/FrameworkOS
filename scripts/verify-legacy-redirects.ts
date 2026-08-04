/**
 * Verifikation für Etappe 4, Schritt 2: Die alte Brand-Oberfläche ist
 * abgerissen — alte Lesezeichen müssen trotzdem weich landen.
 * Start: npx tsx scripts/verify-legacy-redirects.ts
 *
 * Prüft zwei Dinge getrennt:
 *   1. Welche Route greift (react-router-Ranking, echte Pfade aus App.tsx).
 *   2. Wohin die Deliver-Weiche zeigt (reine Funktion).
 */
// react-router-dom liegt in app/node_modules — dieses Skript läuft aus dem Repo-Root.
import { matchRoutes } from '../app/node_modules/react-router-dom/dist/index.mjs'
import { deliverRedirectZiel } from '../app/src/cockpit/lib/legacyRouteMap'

let fehler = 0
function pruefe(label: string, ist: unknown, soll: unknown) {
  const ok = ist === soll
  if (!ok) fehler++
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n    ist:  ${String(ist)}\n    soll: ${String(soll)}`}`)
}

// --- 1. Routen-Ranking -------------------------------------------------------
// Muss exakt der Reihenfolge in App.tsx entsprechen. Der Test hier fängt den
// Fall ab, der beim Bauen fast danebengegangen wäre: `deliver/completed` darf
// NICHT als Projekt-ID durchgehen und `/brand/:slug/*` darf die spezielleren
// Weichen nicht schlucken.
const routen = [
  { path: '/brand/:slug/sales/*', id: 'sales' },
  { path: '/brand/:slug/deliver/*', id: 'deliver' },
  { path: '/brand/:slug/*', id: 'brand' },
  { path: '/brand/:slug', id: 'brand-index' },
  { path: '/projekte/*', id: 'projekte' },
  { path: '/cockpit', id: 'cockpit' },
]

function greift(pfad: string): string {
  const m = matchRoutes(routen, pfad)
  return m?.[m.length - 1]?.route.id ?? '(keine)'
}

pruefe('/brand/wertavio                      → Weiche brand-index', greift('/brand/wertavio'), 'brand-index')
pruefe('/brand/wertavio/foundation           → Weiche brand', greift('/brand/wertavio/foundation'), 'brand')
pruefe('/brand/wertavio/promo/ads            → Weiche brand', greift('/brand/wertavio/promo/ads'), 'brand')
pruefe('/brand/wertavio/dashboard            → Weiche brand', greift('/brand/wertavio/dashboard'), 'brand')
pruefe('/brand/wertavio/deliver              → Weiche deliver', greift('/brand/wertavio/deliver'), 'deliver')
pruefe('/brand/wertavio/deliver/abc-123      → Weiche deliver', greift('/brand/wertavio/deliver/abc-123'), 'deliver')
pruefe('/brand/wertavio/deliver/completed    → Weiche deliver', greift('/brand/wertavio/deliver/completed'), 'deliver')
pruefe('/brand/wertavio/sales/pipeline       → Weiche sales', greift('/brand/wertavio/sales/pipeline'), 'sales')
pruefe('/projekte/abc-123                    → Cockpit-Projekte', greift('/projekte/abc-123'), 'projekte')

// --- 2. Ziel der Deliver-Weiche ---------------------------------------------
pruefe('deliver/:id     → Projekt-Detail', deliverRedirectZiel('/brand/wertavio/deliver/abc-123'), '/projekte/abc-123')
pruefe('deliver         → Projekt-Liste', deliverRedirectZiel('/brand/wertavio/deliver'), '/projekte')
pruefe('deliver/        → Projekt-Liste', deliverRedirectZiel('/brand/wertavio/deliver/'), '/projekte')
pruefe('deliver/completed → Projekt-Liste (KEINE ID!)', deliverRedirectZiel('/brand/wertavio/deliver/completed'), '/projekte')
pruefe('deliver/moon    → Projekt-Liste (KEINE ID!)', deliverRedirectZiel('/brand/wertavio/deliver/moon'), '/projekte')
pruefe(
  'deliver/:id?area=… → Detail ohne Unterpfad',
  deliverRedirectZiel('/brand/wertavio/deliver/abc-123/dateien'),
  '/projekte/abc-123',
)

console.log(fehler === 0 ? '\nAlle Weichen stehen richtig.' : `\n${fehler} Fehler.`)
process.exit(fehler === 0 ? 0 : 1)
