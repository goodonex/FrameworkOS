/**
 * Verifikation für das Monatsziel (docs/IDEEN-2026-07-30-nutzbarkeit.md,
 * Abschnitt „Sofort"): ab September 2026 zeigte die Home stillschweigend den
 * 40.000-€-Planungs-Default, weil `setMonthTotalOverride` null Aufrufer hatte.
 * Jetzt kommt das Ziel aus `month_goals` (Migration 0062) und wird hier als
 * `overrideTotal` durchgereicht.
 *
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-monatsziel.ts
 */
import {
  DEFAULT_MONTH_TOTAL,
  currentSoll,
  monthKeyOf,
  monthTargetFor,
} from '../app/src/cockpit/lib/goals'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

// 1. Der dokumentierte Fall: September 2026 ohne gesetztes Ziel.
{
  const sep = monthTargetFor('2026-09')
  check('1a September faellt auf den Default', sep?.total, DEFAULT_MONTH_TOTAL)
  // `generated: true` ist das Signal, das die Karte als „Ziel geplant" anzeigt —
  // vorher stand der Default kommentarlos da.
  check('1b als geplant markiert', sep?.generated, true)
  check('1c Label deutsch', sep?.label, 'September 2026')
}

// 2. Gesetztes Ziel schlaegt den Default und gilt als echtes Ziel.
{
  const sep = monthTargetFor('2026-09', 60000)
  check('2a Ziel uebernommen', sep?.total, 60000)
  check('2b nicht mehr „geplant"', sep?.generated, false)
  check(
    '2c Kurve endet exakt auf dem Ziel',
    sep?.curve[sep.curve.length - 1]?.sollKumuliert,
    60000,
  )
  check('2d Kurve ist monoton steigend', sep?.curve.every((w, i, a) => i === 0 || w.sollKumuliert >= a[i - 1].sollKumuliert), true)
}

// 3. Hartverdrahtete Monate (Juli/August 2026) bleiben unveraendert, solange
//    kein Ziel gesetzt ist.
{
  const juli = monthTargetFor('2026-07')
  check('3a Juli bleibt 30k', juli?.total, 30000)
  check('3b Juli-Kurve unveraendert', juli?.curve.map((w) => w.sollKumuliert), [3000, 11000, 20000, 30000])
  // 14.08.2026 auf Kevins Wort: 50k war zur Monatsmitte bei 0 EUR Ist nicht mehr
  // erreichbar. Fuenf Montage statt vier — der 31.08. fehlte vorher.
  check('3c August steht auf 15k', monthTargetFor('2026-08')?.total, 15000)
  check(
    '3d August-Kurve endet am 31.08.',
    monthTargetFor('2026-08')?.curve.map((w) => w.weekStart),
    ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'],
  )
}

// 4. Ein gesetztes Ziel schlaegt auch einen hartverdrahteten Monat — die Kurve
//    skaliert proportional mit, sonst zeigte „Soll bis heute" das alte Niveau.
{
  const aug = monthTargetFor('2026-08', 25000) // Faktor 25000/15000
  check('4a August-Ziel uebernommen', aug?.total, 25000)
  check('4b Kurve skaliert mit', aug?.curve.map((w) => w.sollKumuliert), [1905, 5770, 11043, 17493, 25000])
  // Die letzte Woche beginnt am 31.08. und endet am 07.09. — `currentSoll` gibt
  // den vollen Wert erst danach frei, wie bei jeder anderen Monatskurve auch.
  check('4c Soll nach Kurvenende trifft das Ziel', currentSoll(aug!.curve, new Date(2026, 8, 8)), 25000)
}

// 5. null/undefined heisst „nichts gesetzt" — nicht „Ziel 0".
{
  check('5a undefined -> Default', monthTargetFor('2026-10', undefined)?.total, DEFAULT_MONTH_TOTAL)
  check('5b null -> Default', monthTargetFor('2026-10', null)?.total, DEFAULT_MONTH_TOTAL)
  check('5c null bleibt „geplant"', monthTargetFor('2026-10', null)?.generated, true)
  // 0 darf den Default nicht auf 0 ziehen (kaputter Wert aus der DB).
  check('5d 0 -> Default statt Division durch 0', monthTargetFor('2026-08', 0)?.total, 15000)
}

// 6. monthKeyOf liefert denselben Schluessel wie die Aufrufer erwarten.
{
  check('6a Monatsschluessel', monthKeyOf(new Date(2026, 8, 1)), '2026-09')
  check('6b zweistellig', monthKeyOf(new Date(2026, 0, 31)), '2026-01')
}

// 7. Kaputter Schluessel gibt null, statt eine Phantom-Kurve zu bauen.
{
  check('7a Unsinn -> null', monthTargetFor('quatsch'), null)
  check('7b Monat 13 -> null', monthTargetFor('2026-13'), null)
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
