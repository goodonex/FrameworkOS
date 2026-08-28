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
import { TAGES_FLOW } from '../app/src/cockpit/lib/tagesFlow'
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
const flowFelder = new Set<string>(TAGES_FLOW.map((s) => s.feld))
check(
  'ein Tagesziel trägt nur, wer im Tages-Flow eines hat',
  mitZiel.every((z) => flowFelder.has(z.field)),
  'Für die Kanäle ausserhalb des Rituals existiert im Code kein Tagesziel. Eines zu behaupten wäre erfunden.',
)
check(
  'jedes Ziel in der Liste ist das Ziel seiner Stufe — keine zweite Zahlenreihe',
  mitZiel.every((z) => TAGES_FLOW.find((s) => s.feld === z.field)?.standardZiel === z.tagesziel),
)
check(
  'die Anfragen tragen weiterhin ANFRAGEN_LIMIT_TAG',
  ZAEHL_FELDER.find((z) => z.field === 'li_anfragen')?.tagesziel === ANFRAGEN_LIMIT_TAG,
)
check(
  'die Follow-up-Stufe steht ohne festes Ziel — ihr Soll hängt am Tag',
  ZAEHL_FELDER.find((z) => z.field === 'li_followups')?.tagesziel === undefined,
  'Ein statisches Ziel hier wäre eine erfundene Zahl neben dem dynamischen Soll des Flows.',
)
const zaehlQuelle = lies('app/src/cockpit/lib/zaehlFelder.ts')
check('zaehlFelder.ts bezieht die Ziele aus dem Flow, statt sie zu wiederholen', /import\s*\{\s*TAGES_FLOW/.test(zaehlQuelle))
check('keine abgetippte Zielzahl in zaehlFelder.ts', !/tagesziel:\s*\d+/.test(zaehlQuelle))

// --- 2b. Die Liste trägt den Tages-Flow (D7) ----------------------------
const reihenfolge = ZAEHL_FELDER.map((z) => z.field)
// Bis zum 28.08.2026 hatte der Flow eine Stufe ohne Zähl-Feld (Antworten,
// damals Frische-Stufe). Seit 0081 zählen alle sechs. Der Filter bleibt: er ist
// die Regel, nicht die Beschreibung des Ist-Zustands — kommt je wieder eine
// Stufe ohne Feld dazu, darf sie hier nicht durchrutschen.
const zaehlbareStufen = TAGES_FLOW.filter((s) => s.feld !== null)
check(
  'jede Zähl-Stufe des Flows hat einen Eintrag — sonst führt der Flow ins Leere',
  zaehlbareStufen.every((s) => reihenfolge.includes(s.feld as (typeof reihenfolge)[number])),
  `Fehlt: ${zaehlbareStufen.filter((s) => !reihenfolge.includes(s.feld as (typeof reihenfolge)[number])).map((s) => s.feld).join(', ')}`,
)
check(
  'die Antworten-Stufe hat seit 0081 ihre Zähl-Kachel',
  reihenfolge.includes('antworten_erledigt'),
  'Folge des Umbaus, keine eigene Absicht: Kevins Weg zu den Antworten fuehrt weiter ueber die Arbeitsliste — die Kachel ist der Nachtrag fuer unterwegs.',
)
check(
  'die Liste beginnt mit den Zähl-Stufen des Flows, in seiner Reihenfolge',
  JSON.stringify(reihenfolge.slice(0, zaehlbareStufen.length)) === JSON.stringify(zaehlbareStufen.map((s) => s.feld)),
  `Ist: ${reihenfolge.join(', ')}`,
)
check(
  'die Kanäle ausserhalb des Rituals stehen dahinter, nicht dazwischen',
  reihenfolge.slice(zaehlbareStufen.length).every((f) => !flowFelder.has(f)),
)
check(
  'die Reaktivierung (InMails) ist als Zähl-Kachel wirklich erreichbar',
  reihenfolge.includes('inmails'),
  'Ohne Index geprueft: der stand auf 3 und war damit an der Stufen-Reihenfolge festgenagelt — eine neue Stufe davor liess ihn fallen, ohne dass an den InMails etwas kaputt war.',
)

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

// --- 4b. Der Auto-Advance (D5) ------------------------------------------
check(
  'der Zähl-Modus fragt den Flow, wohin es weitergeht — und nur über Zähl-Stufen',
  /naechsteZaehlbareStufe\(/.test(ui),
  'Eine eigene „nächste Stufe"-Rechnung hier wäre eine zweite Reihenfolge — und die zähllose Antworten-Stufe als Ziel wäre /tracking/zaehlen/null.',
)
check(
  'der Sprung wartet, bis die Daten da sind',
  /if\s*\(\s*flow\.laedt/.test(ui),
  'Beim ersten Render stehen alle Zähler auf 0 — aus diesem Zustand zu springen wäre blind.',
)
check(
  'gesprungen wird nur, wenn die Stufe in dieser Sitzung offen war',
  /stufeWarOffen/.test(ui),
  'Sonst schöbe schon das Ansehen einer erledigten Stufe sofort weiter.',
)
check(
  'eine Rücknahme innerhalb des Moments nimmt den Sprung zurück',
  /if\s*\(\s*!stufeErledigt\s*\)\s*\{[\s\S]{0,400}?setUebergang\(null\)/.test(ui),
)
check(
  'die Lesepause steht als benannte Konstante, nicht als Zahl im Effekt',
  /const STUFE_STEHT_MS = \d+/.test(ui) && /}, STUFE_STEHT_MS\)/.test(ui),
)
check(
  'der Sprung ersetzt den Verlaufseintrag, statt ihn zu stapeln',
  /naechsteZaehlbareStufe[\s\S]*?replace: true/.test(ui),
  'Sonst führte „Zurück" durch jede abgeschlossene Stufe des Tages.',
)

// --- 5. Eine Liste, zwei Orte -------------------------------------------
const quickTrack = lies('app/src/cockpit/components/QuickTrack.tsx')
check(
  'QuickTrack liest dieselbe Liste, statt sie zu wiederholen',
  /ZAEHL_FELDER\.map/.test(quickTrack) && !/\{ field: 'li_anfragen', label:/.test(quickTrack),
)
check(
  'QuickTrack zeigt kein Feld zweimal, das in die vordere Liste gewandert ist',
  /FEATURED_FIELDS\.some/.test(quickTrack),
  'Zwei Knöpfe auf dasselbe daily_metrics-Feld sind der kürzeste Weg zu einer Zahl, der niemand mehr glaubt.',
)

// --- 6. Der Weg vom Homescreen führt in EINEN Zähler --------------------
const home = lies('app/src/cockpit/pages/UrielHome.tsx')
check(
  'die Schnell-Aktion führt in den Zähl-Modus, nicht in den alten Anfragen-Zähler',
  // Auf die Route gemünzt, nicht auf das Wort: der Kommentar daneben darf den
  // alten Weg erklären, ohne dass die Prüfung darüber stolpert.
  /route: '\/tracking\/zaehlen\/li_anfragen'/.test(home) &&
    !/route: '[^']*kachel=vernetzungsanfragen/.test(home),
  'Zwei Bedienbilder für dieselbe Zahl — und nur eines kennt den Tages-Flow.',
)
check(
  'der Hero öffnet den Zähl-Modus für die angetippte Zähl-Stufe',
  /\/tracking\/zaehlen\/\$\{stufe\.feld\}/.test(home),
)
check(
  'die zähllose Antworten-Stufe führt vom Hero in den Sales-Flow',
  /stufe\.feld \? [\s\S]{0,80}? : '\/sales\?kachel=antworten'/.test(home),
  'Ein Ring ohne Ziel wäre ein toter Knopf — und /tracking/zaehlen/null die Sackgasse.',
)

console.log(`\nverify-zaehl-modus: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
