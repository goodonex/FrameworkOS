/**
 * Drift-Wache für Falle #1 (HANDOFF.md): `#app-ui-overlay` setzt global
 * `pointer-events: none`. Jede Vollbild-Oberfläche, die INNERHALB dieses
 * Overlays gerendert wird und nicht die CockpitShell ist, muss das
 * ausdrücklich wieder auf `auto` stellen — sonst ist auf ihr kein einziger
 * Knopf anklickbar.
 *
 * Das ist keine Theorie: genau das war am 10.08.2026 im Kundenportal der Fall.
 * Der Fehler war unauffällig, weil die Seite vollständig und richtig aussah —
 * sie reagierte nur auf nichts. Gefunden hat ihn Kevin am Telefon, nachgestellt
 * wurde er mit `document.elementFromPoint` auf „Zurück zum Cockpit": die
 * Trefferkette lief bis zum Overlay durch, ohne je auf `auto` zu stoßen.
 *
 * Diese Prüfung ist bewusst statisch (Dateitext statt Browser): sie soll im
 * selben Lauf wie die anderen 25 Skripte durchlaufen und keine Umgebung
 * brauchen.
 *
 * Start: npx tsx scripts/verify-pointer-events.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p: string) => readFileSync(join(wurzel, p), 'utf8')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

// --- Die Annahme selbst absichern ---------------------------------------
// Fällt `pointer-events: none` im Overlay weg, ist diese ganze Wache
// gegenstandslos — dann soll sie es sagen, statt still grün zu bleiben.
const app = lies('app/src/App.tsx')
check(
  'App.tsx: #app-ui-overlay setzt weiterhin pointer-events: none',
  /id="app-ui-overlay"[\s\S]{0,400}?pointerEvents: 'none'/.test(app),
  'Wenn das absichtlich entfallen ist, kann dieses Skript weg.',
)

// --- Jede Vollbild-Oberfläche im Overlay schaltet wieder ein -------------
/**
 * Je Eintrag: die Datei und der Ort, an dem `auto` stehen muss. Manche Seiten
 * setzen es im TSX (inline style), das Portal in seinem eigenen Stylesheet.
 */
const flaechen: Array<{ datei: string; muster: RegExp; was: string }> = [
  { datei: 'app/src/pages/LoginPage.tsx', muster: /pointerEvents: 'auto'/, was: 'Anmeldekarte' },
  { datei: 'app/src/pages/portal/PortalLoginPage.tsx', muster: /pointerEvents: 'auto'/, was: 'Portal-Login' },
  { datei: 'app/src/pages/portal/PortalSetupPage.tsx', muster: /pointerEvents: 'auto'/, was: 'Portal-Setup' },
  { datei: 'app/src/pages/portal/PortalRoute.tsx', muster: /pointerEvents: 'auto'/, was: 'Portal-Gate (Laden/Fehler)' },
  { datei: 'app/src/pages/portal/portal.css', muster: /\.portal-root\s*\{[\s\S]*?pointer-events:\s*auto/, was: '.portal-root — das Kundenportal selbst' },
  { datei: 'app/src/cockpit/CockpitShell.tsx', muster: /pointerEvents: 'auto'/, was: 'Cockpit-Shell' },
]

for (const f of flaechen) {
  check(
    `${f.was} (${f.datei}) schaltet pointer-events wieder ein`,
    f.muster.test(lies(f.datei)),
    'Ohne `pointer-events: auto` sieht die Seite normal aus und reagiert auf nichts.',
  )
}

// --- Der Verlauf des Portals bleibt billig ------------------------------
/**
 * Die erste Fassung malte den ganzflächigen Navy-Verlauf mit
 * `background-attachment: fixed` + 100vmax-Schlagschatten + `clip-path`
 * direkt auf `.portal-root` — auf dem höchsten Element der Seite und damit
 * auf iOS spürbar teuer. Er gehört auf eine eigene, feste Schicht.
 */
const portalCss = lies('app/src/pages/portal/portal.css')
/**
 * Kommentare raus, BEVOR gesucht wird — sonst schlägt die Prüfung auf der
 * Erklärung an, warum die drei Eigenschaften weg sind, und meldet einen
 * Fehler, den es nicht gibt. (Genau das ist im ersten Lauf passiert.)
 * Danach nur der Deklarations-Block von `.portal-root` selbst, bis zur
 * ersten schliessenden Klammer.
 */
const ohneKommentare = portalCss.replace(/\/\*[\s\S]*?\*\//g, '')
const wurzelStart = ohneKommentare.indexOf('.portal-root {')
const wurzelBlock = ohneKommentare.slice(wurzelStart, ohneKommentare.indexOf('}', wurzelStart))
check('.portal-root ohne background-attachment: fixed', !/background-attachment:\s*fixed/.test(wurzelBlock))
check('.portal-root ohne 100vmax-Schlagschatten', !/box-shadow:[^;]*vmax/.test(wurzelBlock))
check('.portal-root ohne clip-path', !/clip-path/.test(wurzelBlock))
check(
  'der Verlauf liegt auf einer eigenen festen Schicht',
  /\.portal-root::before\s*\{[\s\S]*?position:\s*fixed[\s\S]*?pointer-events:\s*none/.test(ohneKommentare),
)

console.log(`\nverify-pointer-events: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
