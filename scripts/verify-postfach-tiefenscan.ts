/**
 * Drift-Wache für die Postfach-Abdeckung (18.08.2026).
 *
 * Der teuerste Fehler dieses Systems war keiner im Code, sondern eine
 * **Annahme im Kommentar**: „der einmalige Tiefenscan ist gelaufen, ältere
 * Threads liegen bereits in der DB". Sie stimmte nicht — 39 Threads aus Kevins
 * Postfach standen nie in der Tabelle, teils aus 2025. Das Alltagsfenster von
 * 30 Tagen kann sie nicht einholen, weil es nur vorwärts schaut.
 *
 * Die Folge sah Kevin am 18.08. in der Oberfläche: Leads standen als
 * „Erstnachricht offen", obwohl der Chat seit Monaten lief — und sein Urteil
 * war „anscheinend funktioniert das System überhaupt nicht".
 *
 * Diese Wache prüft, dass die Gegenprobe bleibt: ein Fenster je Aufruf, ein
 * wöchentlicher Tiefenscan im Runner, und keine stille Rückkehr zur alten
 * Annahme.
 *
 * Start: npx tsx scripts/verify-postfach-tiefenscan.ts
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

const sync = lies('runner/linkedin/sync.mjs')
const runner = lies('runner/index.mjs')

// --- 1. Das Fenster ist je Aufruf steuerbar -----------------------------
check(
  'syncThreads nimmt ein eigenes Fenster entgegen',
  /export async function syncThreads\(\{[^}]*scanTage/.test(sync),
  'Ohne Parameter gäbe es nur das 30-Tage-Fenster — und keinen Weg, die Lücke je zu schließen.',
)
check(
  'das übergebene Fenster wird auch benutzt, nicht nur entgegengenommen',
  /buildSyncExpr\(cachedQid, fenster\)/.test(sync),
)
check(
  'ein unbrauchbares Fenster fällt auf den Standard zurück',
  /Number\.isFinite\(scanTage\) && scanTage > 0/.test(sync),
  'Sonst stünde bei scanTage=0 oder NaN plötzlich „alles seit 1970" oder gar nichts im Scan.',
)
check(
  'das benutzte Fenster steht im Ergebnis',
  /scanTage: fenster/.test(sync),
  'Sonst sieht man im Log nicht, ob ein Lauf der flache oder der tiefe war.',
)
check('TIEFENSCAN_TAGE ist benannt und exportiert', /export const TIEFENSCAN_TAGE = \d+/.test(sync))

// --- 2. Der Runner fährt ihn wirklich -----------------------------------
check(
  'der Runner importiert das Tiefen-Fenster, statt eine Zahl abzutippen',
  /import \{[^}]*TIEFENSCAN_TAGE[^}]*\} from '\.\/linkedin\/sync\.mjs'/.test(runner),
)
check(
  'der Postfach-Sync entscheidet je Lauf zwischen flach und tief',
  /syncThreads\(tief \? \{ scanTage: TIEFENSCAN_TAGE \} : \{\}\)/.test(runner),
)
check(
  'der Abstand ist benannt und überschreibbar',
  /const TIEFENSCAN_ABSTAND_MS = Number\(process\.env\.TIEFENSCAN_ABSTAND_MS/.test(runner),
)
check(
  'nach einem Tieflauf wird der Zeitpunkt vermerkt',
  /if \(tief\) letzterTiefenscan = Date\.now\(\)/.test(runner),
  'Ohne das liefe jeder Sync als Tiefenscan — zehn Seitenaufrufe alle zwei Stunden durch Kevins Postfach.',
)
check(
  'das Log sagt, welcher Lauf es war',
  /postfach-sync\$\{tief \? ' \(Tiefenscan\)' : ''\}/.test(runner),
)

// --- 3. Die widerlegte Annahme kommt nicht zurück -----------------------
check(
  'die alte Begründung steht nicht mehr als Tatsache im Code',
  !/der einmalige Tiefenscan\s*\n?\s*\/\/ ist gelaufen, ältere Threads liegen bereits in der DB/.test(sync),
  'Genau dieser Satz hat die Lücke drei Wochen lang gedeckt.',
)
check(
  'der Befund vom 18.08. ist am Code dokumentiert',
  /39 Threads/.test(sync),
  'Eine Zahl mit Datum überlebt den nächsten Umbau, eine allgemeine Warnung nicht.',
)
check(
  'die CLI weist aus, dass sie nicht schreibt',
  /schreibt NIE in die Datenbank/.test(sync),
  'Ein Tiefenscan von Hand sah am 18.08. aus, als hätte er nachgetragen — er tat es nicht.',
)

console.log(`\nverify-postfach-tiefenscan: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
