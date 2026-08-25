/**
 * Drift-Wache für die Jophiel-Brücke (25.08.2026).
 *
 * Zwei Dinge werden hier festgehalten, und beide sind teuer, wenn sie kippen:
 *
 * 1. **Slug und Aufnahme-Name landen in einem Dateipfad.** Sie kommen aus der
 *    URL, also von aussen. Eine Positivliste ist der einzige Schutz, der auch
 *    dann noch hält, wenn jemand später eine neue Kodierung findet.
 * 2. **Ein nicht laufender Nebendienst darf nichts kaputt machen.** Ist
 *    Jophiel aus, kommt eine leere Liste plus `jophielErreichbar: false` —
 *    kein Fehler, keine Ausnahme, kein 500.
 *
 * Start: npx tsx scripts/verify-jophiel-bruecke.ts
 */
// @ts-expect-error — Zero-Dependency-Runner ohne Typdeklarationen, tsx löst das zur Laufzeit.
import { SHOT_NAMEN, gueltigerShotName, gueltigerSlug, jophielProjekte } from '../runner/jophiel.mjs'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

/* ── Slugs: nur, was Jophiels slugify erzeugt ──────────────────────────── */

for (const gut of ['staffel-immobilien', 'main-panorama-immobilienpartner', 'abc', 'a1-b2-c3']) {
  check(`Slug „${gut}" ist erlaubt`, gueltigerSlug(gut) === true)
}

const boese = [
  '../../../etc/passwd',
  '..',
  'a/../b',
  'slug/mit/schraegstrich',
  'Slug-Mit-Grossbuchstaben',
  'slug_mit_unterstrich',
  'slug mit leerzeichen',
  'slug.mit.punkt',
  '',
  '-',
  'slug-',
  '-slug',
  'slug--doppelt',
  '%2e%2e%2f',
  'slug\0null',
]
for (const b of boese) {
  check(`Slug ${JSON.stringify(b)} wird abgewiesen`, gueltigerSlug(b) === false)
}
check('kein String wird abgewiesen', gueltigerSlug(null) === false && gueltigerSlug(42) === false)
check('ein sehr langer Slug wird abgewiesen', gueltigerSlug('a'.repeat(121)) === false)

/* ── Aufnahme-Namen: die vier bekannten, sonst nichts ──────────────────── */

check('genau vier Aufnahme-Namen', SHOT_NAMEN.length === 4, JSON.stringify(SHOT_NAMEN))
check(
  'die Namen stimmen mit Jophiels config.screenshots plus alt-Variante überein',
  ['desktop', 'mobile', 'alt-desktop', 'alt-mobile'].every((n: string) => SHOT_NAMEN.includes(n)),
  JSON.stringify(SHOT_NAMEN),
)
for (const n of SHOT_NAMEN) check(`Aufnahme „${n}" ist erlaubt`, gueltigerShotName(n) === true)
for (const n of ['desktop-full', 'alt-desktop-full', 'mobile-full', 'neu-desktop', 'passwd', '../x', '']) {
  check(`Aufnahme ${JSON.stringify(n)} wird abgewiesen`, gueltigerShotName(n) === false)
}
// `-full` ausdruecklich: 3-6 MB pro Bild, und auf einer Karte ist ohnehin nur
// der erste Bildschirm zu sehen. Wer die ganze Seite will, oeffnet die Vorschau.
check(
  'keine -full-Fassung ist erlaubt',
  SHOT_NAMEN.every((n: string) => !n.endsWith('-full')),
)
// `neu-desktop.png` liegt in staffel-immobilien noch herum (24.08.), ist aber
// ein Rest aus einer frueheren Benennung - config.json kennt ihn nicht.
check('der Altbestand „neu-desktop" gilt nicht als Konvention', gueltigerShotName('neu-desktop') === false)

/* ── Jophiel ist aus: leise scheitern, nicht laut ──────────────────────── */

{
  // Auf einen Port zeigen, auf dem garantiert nichts lauscht.
  const vorher = process.env.JOPHIEL_ROOT
  process.env.JOPHIEL_ROOT = '/nicht/vorhanden/jophiel'
  // Der Port ist beim ersten Aufruf gemerkt worden; entscheidend ist hier
  // ohnehin nur, dass ein Fehlschlag als leere Liste zurueckkommt.
  const stand = await jophielProjekte()
  check('die Antwort hat immer beide Felder', Array.isArray(stand.projekte) && typeof stand.jophielErreichbar === 'boolean', JSON.stringify(stand).slice(0, 200))
  if (!stand.jophielErreichbar) {
    check('ohne Jophiel: leere Liste statt Ausnahme', stand.projekte.length === 0)
  } else {
    // Jophiel laeuft gerade — dann pruefen wir die Form der Eintraege.
    check(
      'jedes Projekt traegt einen gueltigen Slug',
      stand.projekte.every((p: { slug: string }) => gueltigerSlug(p.slug)),
    )
    check(
      'jedes Projekt traegt die Klammer zu Uriel (leadName, ggf. leer)',
      stand.projekte.every((p: { leadName: unknown }) => typeof p.leadName === 'string'),
    )
    check(
      'der Auftragstext (brief) wird NICHT mitgespiegelt',
      stand.projekte.every((p: Record<string, unknown>) => !('brief' in p)),
    )
    check(
      'jedes Projekt sagt, ob es etwas zu zeigen gibt',
      stand.projekte.every((p: { hatShot: unknown }) => typeof p.hatShot === 'boolean'),
    )
  }
  if (vorher === undefined) delete process.env.JOPHIEL_ROOT
  else process.env.JOPHIEL_ROOT = vorher
}

console.log(`\nverify-jophiel-bruecke: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
