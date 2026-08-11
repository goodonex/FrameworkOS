/**
 * Drift-Wache für die Auslieferung (11.08.2026).
 *
 * `immutable` ist ein Versprechen: „diese Datei ändert sich nie wieder".
 * Es gilt nur, solange der Dateiname den Inhalts-Hash trägt — dann heisst eine
 * neue Fassung auch anders. Fiele das Hashing weg (Build-Umbau, anderes
 * Bundling), lieferte `immutable` ein Jahr lang die alte Datei aus, und zwar
 * am Handy, wo Kevin es am spätesten merkt. Genau dieselbe Falle, vor der
 * `public/sw.js` in seinem Kopfkommentar warnt.
 *
 * Diese Wache prüft deshalb beides zusammen: die Regel in `netlify.toml` UND
 * dass der Build sie noch verdient.
 *
 * Start: npx tsx scripts/verify-caching.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const toml = readFileSync(join(wurzel, 'netlify.toml'), 'utf8')

/** Der Header-Block zu einem Pfad-Muster. */
function blockFuer(muster: string): string {
  const start = toml.indexOf(`for = "${muster}"`)
  if (start < 0) return ''
  const naechster = toml.indexOf('[[headers]]', start)
  return toml.slice(start, naechster < 0 ? undefined : naechster)
}

// --- 1. Die gehashten Dateien dürfen lange liegen ------------------------
const assets = blockFuer('/assets/*')
check('netlify.toml hat einen Header-Block für /assets/*', assets.length > 0)
check('/assets/* ist immutable', /immutable/.test(assets))
check('/assets/* hat ein Jahr', /max-age=31536000/.test(assets))

// --- 2. Was seinen Namen behält, darf es NICHT --------------------------
/**
 * Der teuerste denkbare Fehler hier: `immutable` auf `/*`. Dann liesse sich
 * kein Bild in `public/` je wieder austauschen — das Foto des Homescreens
 * bliebe ein Jahr, egal was deployt wird.
 */
check(
  'kein immutable auf einem Muster, das public/ mitnimmt',
  !/for = "\/\*"[\s\S]{0,200}?immutable/.test(toml),
  'public/-Dateien behalten ihren Namen über Deploys hinweg.',
)
const index = blockFuer('/index.html')
check('die Einstiegsseite bleibt frisch', /max-age=0/.test(index) && !/immutable/.test(index))
const sw = blockFuer('/sw.js')
check(
  'der Service Worker wird nicht gecacht',
  /max-age=0/.test(sw),
  'Ein gecachter Worker kann sich nicht selbst ersetzen. ACHTUNG: diese Wache ' +
    'prueft die ABSICHT in netlify.toml — live setzt sich Netlify bei /sw.js ' +
    'darueber hinweg (zweimal nachgemessen, siehe Kommentar dort).',
)
check('der Service Worker ist nicht immutable', !/immutable/.test(sw))

// --- 3. Der Build verdient das Versprechen noch -------------------------
const dist = join(wurzel, 'app/dist/assets')
if (existsSync(dist)) {
  const dateien = readdirSync(dist).filter((n) => !n.startsWith('.'))
  check('der Build hat Dateien unter /assets', dateien.length > 0)
  /** Vite haengt den Inhalts-Hash vor die Endung: `index-CbXs3Ivr.js`. */
  const ohneHash = dateien.filter((n) => !/-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(n))
  check(
    'jede ausgelieferte Datei unter /assets traegt einen Inhalts-Hash',
    ohneHash.length === 0,
    ohneHash.length
      ? `Ohne Hash: ${ohneHash.join(', ')} — mit immutable waeren sie ein Jahr eingefroren.`
      : '',
  )
} else {
  // Kein Build da (frischer Checkout) — dann ist hier nichts zu pruefen, aber
  // das Schweigen soll sichtbar sein statt als grüner Haken durchzugehen.
  console.log('  (app/dist fehlt — Hash-Prüfung übersprungen, erst nach einem Build aussagekräftig)')
}

console.log(`\nverify-caching: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
