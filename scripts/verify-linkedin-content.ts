/**
 * Drift-Wache für den LinkedIn-Content-Kanal (Phase 2, Zug C2 · D10).
 *
 * Geprüft werden die drei Stellen, an denen der Kanal rechnet — und genau die
 * sind reine Funktionen, damit dieses Skript sie ohne Vite laden kann:
 *   1. die Zeichenzählung (Marke 1.300 sichtbar, hart 3.000),
 *   2. die Vorschau-Zeile der Liste,
 *   3. der Ordner-Hinweis für Bild-Beiträge.
 * Dazu zwei Struktur-Prüfungen: dass der Kanal-Filter im UI wirklich auf
 * `channel` filtert, und dass „Als gepostet markieren" den bestehenden
 * Endpunkt benutzt statt eines zweiten Weges.
 *
 * Start: npx tsx scripts/verify-linkedin-content.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  MAX_ZEICHEN,
  SICHTBARE_MARKE,
  slidesOrdner,
  vorschauZeile,
  zeichenstand,
} from '../app/src/cockpit/lib/linkedinPost'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}\n  erwartet: ${JSON.stringify(expected)}\n  bekommen: ${JSON.stringify(actual)}`)
  }
}

// --- 1. Zeichenzählung ---------------------------------------------------
check('Marken stehen, wo LinkedIn sie hat', [SICHTBARE_MARKE, MAX_ZEICHEN], [1300, 3000])

check('leerer Text', zeichenstand(''), {
  gesamt: 0,
  sichtbar: 0,
  frei: 3000,
  ueberMarke: false,
  ueberLimit: false,
})

check('kurzer Text', zeichenstand('Hallo'), {
  gesamt: 5,
  sichtbar: 5,
  frei: 2995,
  ueberMarke: false,
  ueberLimit: false,
})

check('genau auf der sichtbaren Marke ist noch NICHT drüber', zeichenstand('a'.repeat(1300)).ueberMarke, false)
check('ein Zeichen mehr ist drüber', zeichenstand('a'.repeat(1301)).ueberMarke, true)
check('sichtbar deckelt bei der Marke', zeichenstand('a'.repeat(2000)).sichtbar, 1300)
check('genau am Limit ist noch NICHT drüber', zeichenstand('a'.repeat(3000)).ueberLimit, false)
check('ein Zeichen über dem Limit', zeichenstand('a'.repeat(3001)).ueberLimit, true)
check('frei wird nie negativ', zeichenstand('a'.repeat(3500)).frei, 0)

/**
 * Der Grund für den Spread-Operator statt `.length`: ein Emoji ist EIN Zeichen
 * für LinkedIn, aber zwei UTF-16-Code-Units. Mit `.length` hätte der Zähler bei
 * emoji-lastigen Beiträgen zu früh Alarm geschlagen.
 */
check('Emoji zählt als ein Zeichen', zeichenstand('✦🚀').gesamt, 2)
check('Umlaute zählen einfach', zeichenstand('Grüße').gesamt, 5)
check('Zeilenumbrüche zählen mit', zeichenstand('a\nb').gesamt, 3)

// --- 2. Vorschau-Zeile ---------------------------------------------------
check('erste echte Zeile gewinnt', vorschauZeile('\n\n  Erste Zeile  \nZweite'), 'Erste Zeile')
check('Hashtag-Zeile taugt nicht als Titel', vorschauZeile('#immobilien #makler\nDer echte Anfang'), 'Der echte Anfang')
check('leerer Text gibt leere Vorschau', vorschauZeile(''), '')
check('nur Hashtags gibt leere Vorschau', vorschauZeile('#a\n#b'), '')
check('lange Zeile wird gekürzt', vorschauZeile('a'.repeat(200), 10), `${'a'.repeat(9)}…`)
check('Zeile auf Kantenlänge bleibt ganz', vorschauZeile('a'.repeat(10), 10), 'a'.repeat(10))

// --- 3. Ordner-Hinweis ---------------------------------------------------
check('ohne Slides kein Hinweis', slidesOrdner([]), null)
check('ein Ordner', slidesOrdner(['w29/post1/1.png', 'w29/post1/2.png']), 'w29/post1')
check('verschiedene Ordner geben lieber gar keinen Hinweis', slidesOrdner(['a/1.png', 'b/2.png']), null)
check('Datei ohne Ordner', slidesOrdner(['1.png']), null)

// --- 4. Struktur: der Kanal filtert wirklich auf `channel` ---------------
const socialArea = readFileSync(join(wurzel, 'app/src/cockpit/pages/SocialArea.tsx'), 'utf8')
check(
  'LinkedIn-Kanal filtert auf channel === linkedin',
  /\.filter\(\(p\) => p\.channel === 'linkedin'\)/.test(socialArea),
  true,
)
check('Instagram-Pfad bleibt unverändert erreichbar', socialArea.includes('<ContentPostsView />'), true)
check('Wochen-Ansicht bleibt erreichbar', socialArea.includes('<WeeksView />'), true)

// --- 5. Struktur: gepostet läuft über den bestehenden Endpunkt -----------
const contentApi = readFileSync(join(wurzel, 'app/src/cockpit/lib/contentApi.ts'), 'utf8')
check('es gibt genau einen posted-Endpunkt', (contentApi.match(/'\/content\/posted'/g) ?? []).length, 1)

const linkedinUi = readFileSync(join(wurzel, 'app/src/cockpit/components/content/LinkedinPosts.tsx'), 'utf8')
check(
  'die LinkedIn-Ansicht ruft keinen eigenen Endpunkt',
  /fetch\(|RUNNER_BASE_URL/.test(linkedinUi),
  false,
)
check('Kopier-Griff ohne await vor der Nutzergeste', /void navigator\.clipboard\.writeText/.test(linkedinUi), true)

console.log(`\nverify-linkedin-content: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
