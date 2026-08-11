/**
 * Drift-Wache für den Zähl-Modus (11.08.2026).
 *
 * Der Zähl-Modus ist ein Eingabegerät für Zahlen, die später Kevins Quoten
 * tragen — er darf deshalb keine eigene Buchhaltung bekommen. Geprüft wird
 * genau das: dass die Felder echt sind, dass die Liste nur einmal existiert,
 * dass das einzige Tagesziel aus `prioritaet.ts` kommt (und nicht als Zahl
 * abgetippt wurde) und dass geschrieben ausschliesslich über `bump` wird.
 *
 * Start: npx tsx scripts/verify-zaehl-modus.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { METRIC_FIELDS } from '../app/src/cockpit/lib/metrikFelder'
import { ANFRAGEN_LIMIT_TAG } from '../app/src/cockpit/lib/prioritaet'
import { ZAEHL_FELDER, zaehlFeldFuer } from '../app/src/cockpit/lib/zaehlFelder'

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

// --- 1. Die Felder sind echt --------------------------------------------
for (const z of ZAEHL_FELDER) {
  check(
    `${z.field} ist ein echtes Metrikfeld`,
    (METRIC_FIELDS as readonly string[]).includes(z.field),
    'Ein Tippen auf ein Feld, das daily_metrics nicht hat, verschwindet spurlos.',
  )
  check(`${z.field} hat ein kurzes und ein langes Label`, z.label.length > 0 && z.langLabel.length > 0)
}
check('keine Dublette in der Liste', new Set(ZAEHL_FELDER.map((z) => z.field)).size === ZAEHL_FELDER.length)
check('die Liste ist nicht leer', ZAEHL_FELDER.length > 0)

// --- 2. Ziele werden nicht erfunden -------------------------------------
const mitZiel = ZAEHL_FELDER.filter((z) => z.tagesziel !== undefined)
check(
  'genau ein Feld trägt ein Tagesziel — nämlich das, für das es eines gibt',
  mitZiel.length === 1 && mitZiel[0].field === 'li_anfragen',
  'Für die übrigen Felder existiert im Code kein Tagesziel. Eines zu behaupten wäre erfunden.',
)
check(
  'das Ziel kommt aus ANFRAGEN_LIMIT_TAG, nicht aus einer abgetippten Zahl',
  mitZiel[0]?.tagesziel === ANFRAGEN_LIMIT_TAG,
)
const zaehlQuelle = lies('app/src/cockpit/lib/zaehlFelder.ts')
check('zaehlFelder.ts importiert das Limit, statt es zu wiederholen', /import\s*\{\s*ANFRAGEN_LIMIT_TAG/.test(zaehlQuelle))
check('keine nackte 30 in zaehlFelder.ts', !/tagesziel:\s*\d+/.test(zaehlQuelle))

// --- 3. Nachschlag ------------------------------------------------------
check('zaehlFeldFuer findet ein bekanntes Feld', zaehlFeldFuer('li_anfragen')?.field === 'li_anfragen')
check('zaehlFeldFuer gibt bei Unsinn null', zaehlFeldFuer('gibtsnicht') === null)
check('zaehlFeldFuer verträgt undefined (Raster-Route ohne :feld)', zaehlFeldFuer(undefined) === null)
check(
  'ein Metrikfeld, das nicht in der Zähl-Liste steht, liefert null',
  zaehlFeldFuer('abschluesse') === null,
  'Sonst hätte /tracking/zaehlen/abschluesse ein Vollbild ohne Eintrag in der Liste.',
)

// --- 4. Es gibt nur einen Schreibweg ------------------------------------
const ui = lies('app/src/cockpit/pages/ZaehlModus.tsx')
check('der Zähl-Modus schreibt über bump()', /bump\(zaehlFeld\.field,\s*1\)/.test(ui))
check('Rückgängig geht denselben Weg, nur mit -1', /bump\(zaehlFeld\.field,\s*-1\)/.test(ui))
check(
  'kein eigener Datenweg an useDailyMetrics vorbei',
  !/supabase|fetch\(|upsert|from\(/.test(ui),
  'Der Zähl-Modus darf nur konsumieren, was der Hook anbietet.',
)
check(
  'Rückgängig nimmt nur Tipps DIESER Sitzung zurück',
  /dieseSitzung\s*<=\s*0/.test(ui),
  'Sonst zöge der Knopf Zahlen ab, die woanders gebucht wurden.',
)

// --- 5. Eine Liste, zwei Orte -------------------------------------------
const quickTrack = lies('app/src/cockpit/components/QuickTrack.tsx')
check(
  'QuickTrack liest dieselbe Liste, statt sie zu wiederholen',
  /ZAEHL_FELDER\.map/.test(quickTrack) && !/\{ field: 'li_anfragen', label:/.test(quickTrack),
)

console.log(`\nverify-zaehl-modus: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
