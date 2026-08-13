/**
 * Verifikation der Log-Hygiene (13.08.2026).
 *
 * Der Kern in einem Satz: **Ein Dauerfehler darf das Log nicht zumüllen, aber
 * er darf auch nicht verschwinden** — genau zwischen diesen beiden Fehlern
 * liegt der Nutzen, und beide Seiten werden hier geprüft.
 *
 * Start: npx tsx scripts/verify-log-hygiene.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { baueZeile, macheDaempfer, signatur, zeitstempel } from '../runner/logHygiene.mjs'

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

// ---- 1. Der Fingerabdruck ----
{
  // DER FALL vom 13.08.: 50.339 Zeilen, die sich nur im Dateinamen unterschieden.
  const a = '[runner] Datei-Spiegel "reichentrog-ad-13.png" fehlgeschlagen: Bucket not found'
  const b = '[runner] Datei-Spiegel "reichentrog-ad-14.png" fehlgeschlagen: Bucket not found'
  const c = '[runner] Datei-Spiegel "Vertriebszentrale.html" fehlgeschlagen: Bucket not found'
  check('1 gleicher Defekt, anderer Dateiname → eine Signatur', signatur(a) === signatur(b), true)
  check('1b auch bei ganz anderem Namen', signatur(a) === signatur(c), true)
  check(
    '1c anderer Defekt → andere Signatur',
    signatur(a) === signatur('[runner] Heartbeat fehlgeschlagen: fetch failed'),
    false,
  )
  check('1d Zahlen außerhalb von Anführungszeichen zählen nicht', signatur('Exit 1') === signatur('Exit 143'), true)
  check('1e leere Eingabe überlebt', signatur(undefined), '')
  check('1f sehr lange Zeile wird gekappt', signatur('x'.repeat(500)).length, 200)
}

// ---- 2. Der Dämpfer ----
{
  let t = 0
  const d = macheDaempfer({ fensterMs: 60_000, jetzt: () => t })
  const zeile = (n: number) => `[runner] Datei-Spiegel "datei-${n}.png" fehlgeschlagen: Bucket not found`

  check('2 die erste Meldung kommt durch', d(zeile(1)), { schreiben: true, unterdrueckt: 0 })
  check('2b die zweite gleichartige nicht', d(zeile(2)), { schreiben: false, unterdrueckt: 1 })
  check('2c die dritte auch nicht', d(zeile(3)), { schreiben: false, unterdrueckt: 2 })

  // Ein anderer Fehler darf nicht mitgedämpft werden — sonst verdeckt ein
  // lauter Dauerfehler den leisen echten. Genau das ist am 12.08. passiert.
  check('2d fremder Fehler kommt sofort durch', d('[runner] Heartbeat fehlgeschlagen: fetch failed'), {
    schreiben: true,
    unterdrueckt: 0,
  })

  // Nach dem Fenster wieder durchlassen — mit der Zahl der ausgelassenen.
  // Zwei, nicht drei: unterdrückt wurden zeile(2) und zeile(3), die erste wurde
  // ja geschrieben. Der Zähler meint die verschluckten, nicht die gesehenen.
  t = 60_000
  check('2e nach dem Fenster wieder sichtbar, mit Zähler', d(zeile(4)), {
    schreiben: true,
    unterdrueckt: 2,
  })
  check('2f und der Zähler beginnt neu', d(zeile(5)), { schreiben: false, unterdrueckt: 1 })

  // Die Rechnung des echten Falls: 1265 Meldungen im 60s-Takt über 21 Stunden
  // wären mit Dämpfung rund 21 Zeilen statt 1265.
  let t2 = 0
  const d2 = macheDaempfer({ fensterMs: 60_000, jetzt: () => t2 })
  let geschrieben = 0
  for (let i = 0; i < 1265; i++) {
    t2 = i * 60_000 // ein Tick pro Minute
    if (d2(zeile(i)).schreiben) geschrieben++
  }
  check('2g 60s-Takt bei 60s-Fenster: jede Zeile bleibt', geschrieben, 1265)

  // Derselbe Dauerfehler, aber im 4-Sekunden-Takt (Auftrags-Abfrage):
  let t3 = 0
  const d3 = macheDaempfer({ fensterMs: 60_000, jetzt: () => t3 })
  let g3 = 0
  for (let i = 0; i < 900; i++) {
    t3 = i * 4_000 // eine Stunde im 4s-Takt
    if (d3('[runner] Auftrags-Abfrage fehlgeschlagen: fetch failed').schreiben) g3++
  }
  check('2h 4s-Takt über eine Stunde → 60 statt 900 Zeilen', g3, 60)
}

// ---- 3. Die fertige Zeile ----
{
  const d = new Date('2026-08-13T14:05:43')
  check('3 Zeitstempel lokal', zeitstempel(d), '[14:05:43]')
  check('3b einstellige Werte aufgefüllt', zeitstempel(new Date('2026-08-13T09:05:03')), '[09:05:03]')
  check('3c Zeile ohne Unterdrückte', baueZeile('[runner] alive', 0, d), '[14:05:43] [runner] alive')
  check(
    '3d Zeile mit Unterdrückten nennt die Zahl',
    baueZeile('[runner] Heartbeat fehlgeschlagen', 42, d),
    '[14:05:43] [runner] Heartbeat fehlgeschlagen (+42 gleichartige unterdrückt)',
  )
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
