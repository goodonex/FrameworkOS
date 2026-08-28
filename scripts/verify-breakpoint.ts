/**
 * Drift-Wache für O10 (docs/BACKLOG.md, 06.08.2026): Das Cockpit hat genau eine
 * Mobil-Grenze. Bis zum 06.08. schaltete `useViewport` bei 768, `NavRail` und
 * `cockpit.css` bei 900 — dazwischen lag eine halbe Welt: Bottom-Bar sichtbar,
 * `isMobile` aber false. Züge 6 und 7 des Morgen-Wargames hängen daran.
 *
 * Start: npx tsx scripts/verify-breakpoint.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { MOBILE_MAX_WIDTH, MOBILE_MEDIA_QUERY, SALES_ZWEISPALTIG_AB } from '../app/src/hooks/useViewport'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(wurzel, 'app/src')

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

function dateien(ordner: string, endungen: string[]): string[] {
  const out: string[] = []
  for (const eintrag of readdirSync(ordner)) {
    const p = join(ordner, eintrag)
    if (statSync(p).isDirectory()) out.push(...dateien(p, endungen))
    else if (endungen.some((e) => p.endsWith(e))) out.push(p)
  }
  return out
}

// 1. Der Wert selbst.
check('1 Grenze steht auf 900', MOBILE_MAX_WIDTH, 900)
check('1b Media-Query passt zur Zahl', MOBILE_MEDIA_QUERY, '(max-width: 900px)')

// 2. Kein zweiter Breakpoint im Cockpit-CSS. Der einzige Ort, der die Zahl nicht
//    importieren kann — deshalb hier geprüft statt vertraut.
const css = readFileSync(join(src, 'styles/cockpit.css'), 'utf8')
const cssGrenzen = [...css.matchAll(/@media[^{]*max-width:\s*(\d+)px/g)].map((m) => Number(m[1]))
check(
  `2 alle ${cssGrenzen.length} @media-Grenzen in cockpit.css sind ${MOBILE_MAX_WIDTH}`,
  [...new Set(cssGrenzen)],
  [MOBILE_MAX_WIDTH],
)

// 3. Niemand tippt die Zahl ab. Wer eine eigene Grenze braucht, importiert sie.
const tsFiles = dateien(src, ['.ts', '.tsx']).filter(
  (f) => !f.endsWith('hooks/useViewport.ts') && !f.includes('/pages/portal/'),
)
const abtipper: string[] = []
for (const f of tsFiles) {
  const inhalt = readFileSync(f, 'utf8')
  // matchMedia mit literaler Pixelzahl, oder innerWidth-Vergleich gegen eine Zahl.
  if (/matchMedia\(\s*['"`]\([^)]*width:\s*\d+px/.test(inhalt)) abtipper.push(`${relative(wurzel, f)} (matchMedia)`)
  if (/innerWidth\s*[<>]=?\s*\d+/.test(inhalt)) abtipper.push(`${relative(wurzel, f)} (innerWidth)`)
}
check('3 keine abgetippte Grenze in app/src (ohne Portal)', abtipper, [])

// 4. Die drei Konsumenten aus dem Backlog hängen wirklich am Hook.
for (const [datei, muster] of [
  ['App.tsx', 'useViewport()'],
  // Seit dem 28.08.2026 braucht das Dashboard die Breite selbst (zweispaltiges
  // Canvas) und nimmt deshalb `useViewport()` statt `useIsMobile()`. Beide
  // haengen an derselben Grenze — `useIsMobile` ist nur die Kurzform davon.
  ['cockpit/pages/SalesDashboard.tsx', 'useViewport()'],
  ['pages/sales/ContactPage.tsx', 'useViewport()'],
] as const) {
  check(`4 ${datei} nutzt ${muster}`, readFileSync(join(src, datei), 'utf8').includes(muster), true)
}

// 5. Bottom-Bar und isMobile schalten am selben Punkt.
const navRail = readFileSync(join(src, 'cockpit/components/NavRail.tsx'), 'utf8')
check('5 NavRail importiert die geteilte Query', navRail.includes('MOBILE_MEDIA_QUERY'), true)

// 6. Die Sales-Grenze (zweispaltiges Canvas) ist eine EIGENE Frage — aber sie
//    wohnt am selben Ort und wird nirgends abgetippt. Ohne diesen Check waere
//    O10 fuer die Mobil-Grenze geschuetzt und daneben eine zweite Zahl frei im
//    Umlauf, was genau die Drift von damals in neuem Gewand waere.
check('6a Sales-Grenze steht auf 1180', SALES_ZWEISPALTIG_AB, 1180)
check('6b Sales-Grenze liegt ueber der Mobil-Grenze', SALES_ZWEISPALTIG_AB > MOBILE_MAX_WIDTH, true)
const sales = readFileSync(join(src, 'cockpit/pages/SalesDashboard.tsx'), 'utf8')
check('6c SalesDashboard importiert die Grenze', sales.includes('SALES_ZWEISPALTIG_AB'), true)
check(
  '6d niemand tippt 1180 ab',
  tsFiles
    .filter((f) => new RegExp(`[^\\d]${SALES_ZWEISPALTIG_AB}[^\\d]`).test(readFileSync(f, 'utf8')))
    .map((f) => relative(wurzel, f)),
  [],
)

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
