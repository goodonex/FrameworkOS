/**
 * Drift-Wache für die Runde vom 14.08.2026 — **keine Phantom-Nullen**.
 *
 * Befund: `useBrandId` gab `null` zurück, solange die Brands noch luden, und
 * jeder Daten-Hook las das als „fertig, aber leer". Für ein bis zwei Sekunden
 * nach jedem Seitenaufruf stand deshalb auf dem Sales-Dashboard „Alles
 * abgearbeitet", auf /projekte „Noch keine Projekte" plus die Warnung „Keine
 * Brand verbunden", und unter /linkedin „Noch keine Erstnachrichten
 * gespiegelt" — obwohl 118 Leads, 160 Threads und 4 Projekte in der DB lagen.
 *
 * Zweiter Teil derselben Runde: die 1.000-Zeilen-Grenze von PostgREST. Sie hat
 * am 12.08. schon einmal zugeschlagen (InMail-Kachel 370 statt 876). Die
 * Abfragen, die Kevins Tagesliste tragen, blättern jetzt.
 *
 * Hooks sind React und lassen sich ohne DOM nicht aufrufen — geprüft wird
 * deshalb die Struktur der Dateien, wie in `verify-contacts-quelle.ts`.
 *
 * Start: npx tsx scripts/verify-ladezustand.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Kommentare raus — sonst schlägt die Wache an ihrer eigenen Begründung an. */
function ohneKommentare(pfad: string): string {
  return readFileSync(join(wurzel, pfad), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(
      `FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`,
    )
  }
}

// ---------------------------------------------------------------------------
// 1. Der Unterschied „unbekannt" vs. „leer" existiert überhaupt.
// ---------------------------------------------------------------------------
const brandId = ohneKommentare('app/src/hooks/useBrandId.ts')
check('useBrandId exportiert useBrandIdStatus', /export function useBrandIdStatus/.test(brandId), true)
check('Status liest den Ladezustand der Brands', /const \{ brands, loading \} = useBrands\(\)/.test(brandId), true)
check(
  'pending heißt: null UND noch am Laden',
  /pending:\s*brandId === null && loading/.test(brandId),
  true,
)
check('useBrandId bleibt als schmale Fassade erhalten', /export function useBrandId\(/.test(brandId), true)

// ---------------------------------------------------------------------------
// 2. Jeder Hook, der eine Kachel-Zahl trägt, wartet auf die Brand.
// ---------------------------------------------------------------------------
const traeger: Array<[string, string]> = [
  ['app/src/hooks/useErstnachrichten.ts', 'Erstnachrichten (Kachel + /linkedin)'],
  ['app/src/hooks/useLinkedinThreads.ts', 'Antworten / Looms / Follow-ups'],
  ['app/src/hooks/useContacts.ts', 'Kontakte (Nordstern, Namen)'],
  ['app/src/hooks/useTasks.ts', 'Kundenarbeit'],
  ['app/src/hooks/useDeliverProjects.ts', 'Projekte / liegt zu lange'],
]

for (const [pfad, was] of traeger) {
  const quelle = ohneKommentare(pfad)
  check(`${was}: benutzt useBrandIdStatus`, /useBrandIdStatus\(brandSlug\)/.test(quelle), true)
  check(`${was}: kennt brandPending`, /pending:\s*brandPending/.test(quelle), true)
  // Kein `setLoading(false)` mehr, solange die Brand noch gesucht wird: der
  // Zweig ohne brandId muss brandPending berücksichtigen.
  check(
    `${was}: der Zweig ohne brandId endet nicht blind auf "fertig"`,
    /setLoading\(brandPending\)/.test(quelle) || /if \(brandPending\) \{\s*setLoading\(true\)/.test(quelle),
    true,
  )
  check(`${was}: reload hängt an brandPending`, /brandPending[^)]*\]\)/.test(quelle), true)
}

// ---------------------------------------------------------------------------
// 3. Die 1.000-Zeilen-Grenze — die Tagesliste blättert.
// ---------------------------------------------------------------------------
const blaetternd: Array<[string, string, string]> = [
  ['app/src/hooks/useLinkedinThreads.ts', 'linkedin_threads', 'aufsteigend sortiert → sonst fehlen die NEUESTEN'],
  ['app/src/hooks/useContacts.ts', 'contacts', 'absteigend sortiert → sonst fehlt der Altbestand'],
  ['app/src/hooks/useTasks.ts', 'foundation_tasks', 'trägt Rang 1 der Prioritätenliste'],
]
for (const [pfad, tabelle, warum] of blaetternd) {
  const quelle = ohneKommentare(pfad)
  check(`${tabelle} blättert (${warum})`, /\.range\(von, von \+ SEITE - 1\)/.test(quelle), true)
  check(`${tabelle}: Seitengröße 1000`, /const SEITE = 1000/.test(quelle), true)
}
check(
  'foundation_tasks hat kein stilles .limit(500) mehr',
  /\.limit\(500\)/.test(ohneKommentare('app/src/hooks/useTasks.ts')),
  false,
)

// ---------------------------------------------------------------------------
// 4. Die Oberfläche behauptet keine Zahl, die sie nicht hat.
// ---------------------------------------------------------------------------
const dash = ohneKommentare('app/src/cockpit/pages/SalesDashboard.tsx')
check('Sales-Kacheln haben einen Platzhalter für den Ladezustand', /const zahl = \(text: string\)/.test(dash), true)
check('„Alles abgearbeitet" läuft durch den Platzhalter', /zahl\(geordnetMitAnfrage\.length \?/.test(dash), true)
// Die Kacheln, die eine gezählte Menge zeigen. „Vernetzungsanfragen", „Quoten",
// „InMails" und „Werkzeuge" hängen NICHT an usePosten und bleiben außen vor.
for (const kachel of [
  'kundenaufgabePosten.length',
  'antwortListe.length',
  'erstnachrichtListe.length',
  'followupListe.length',
  'loomVerschicktGesamt',
]) {
  check(`Kachel-Zahl ${kachel} ist gegen den Ladezustand gesichert`, dash.includes(`zahl(\``), true)
}
check(
  'Die Unterzeile von „Jetzt dran" wiederholt die Kennzahl nicht',
  /ansage !== `\$\{geordnetMitAnfrage\.length\} offen`/.test(dash),
  true,
)
check(
  'Kennzahl und Unterzeile rechnen auf derselben Liste',
  /tagesansage\(geordnetMitAnfrage, dauern, jetzt\)/.test(dash),
  true,
)

const heute = ohneKommentare('app/src/cockpit/components/HeuteDeck.tsx')
check('Heute-Deck kennt den Ladezustand', /const postenLaedt =/.test(heute), true)
check(
  '„Für heute ist alles abgearbeitet" erst, wenn geladen ist',
  /postenLaedt \? 'Lädt …' : 'Liste leer\./.test(heute),
  true,
)

const projekte = ohneKommentare('app/src/cockpit/pages/ProjekteArea.tsx')
check(
  '„Keine Brand verbunden" wartet, bis die Brands geladen sind',
  /const brandBroken = !brandsLaden &&/.test(projekte),
  true,
)

console.log(`\nverify-ladezustand: ${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
