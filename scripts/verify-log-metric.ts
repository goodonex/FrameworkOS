/**
 * Verifikation für das Uriel-Werkzeug `log_metric` (Backlog-Punkt „Uriel kann
 * Tages-KPIs nicht eintragen"). Reine Funktionen, keine DB —
 * Start: npx tsx scripts/verify-log-metric.ts
 */
import {
  METRIC_FIELDS,
  METRIK_LABEL,
  berechneStand,
  istMetrikFeld,
  pruefeBuchung,
} from '../app/src/cockpit/lib/metrikFelder'

const HEUTE = '2026-08-06'
const FENSTER = '2026-06-22' // 45 Tage zurück

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(`✗ ${label}\n    erwartet: ${JSON.stringify(expected)}\n    war:      ${JSON.stringify(actual)}`)
  }
}

const pruefe = (feld: unknown, wert: unknown, datum?: unknown) =>
  pruefeBuchung({ feld, wert, datum, heute: HEUTE, windowStart: FENSTER })

// ---- Feldkarte: Enum, Labels und DB-Deckung ------------------------------
check('19 Felder', METRIC_FIELDS.length, 19)
check('jedes Feld hat ein Label', METRIC_FIELDS.filter((f) => !METRIK_LABEL[f]).length, 0)
check('Labels sind eindeutig', new Set(Object.values(METRIK_LABEL)).size, METRIC_FIELDS.length)
check('keine Legacy-Felder mehr', METRIC_FIELDS.filter((f) =>
  ['coldmails', 'followups', 'antworten_cold', 'termine_vereinbart'].includes(f as string),
).length, 0)
check('umsatz ist bewusst kein Zählfeld', istMetrikFeld('umsatz'), false)

// ---- Validierung ---------------------------------------------------------
check('gültige Buchung', pruefe('li_anfragen', 30), {
  ok: true, feld: 'li_anfragen', datum: HEUTE, wert: 30,
})
check('Datum wird übernommen', pruefe('looms', 2, '2026-08-04').ok && pruefe('looms', 2, '2026-08-04'), {
  ok: true, feld: 'looms', datum: '2026-08-04', wert: 2,
})
check('erfundenes Feld', pruefe('vernetzungsanfragen', 30).ok, false)
check('erfundenes Feld — Fehlercode', (pruefe('vernetzungsanfragen', 30) as { fehler: string }).fehler, 'unknown_field')
check('Tippfehler im Feldnamen', pruefe('li_anfrage', 1).ok, false)
check('Wert 0', (pruefe('looms', 0) as { fehler: string }).fehler, 'invalid_value')
check('Kommazahl', (pruefe('looms', 2.5) as { fehler: string }).fehler, 'invalid_value')
check('Text als Wert', (pruefe('looms', 'drei') as { fehler: string }).fehler, 'invalid_value')
check('negativer Wert erlaubt (Korrektur)', pruefe('looms', -3).ok, true)
check('Datum im falschen Format', (pruefe('looms', 1, '06.08.2026') as { fehler: string }).fehler, 'bad_date')
check('Datum in der Zukunft', (pruefe('looms', 1, '2026-08-07') as { fehler: string }).fehler, 'future_date')
check('heute ist erlaubt', pruefe('looms', 1, HEUTE).ok, true)
check('vor dem Ladefenster', (pruefe('looms', 1, '2026-06-21') as { fehler: string }).fehler, 'out_of_window')
check('Fenstergrenze selbst ist erlaubt', pruefe('looms', 1, FENSTER).ok, true)

// ---- Rechnen: addieren statt überschreiben -------------------------------
check('addiert auf einen bestehenden Tageswert', berechneStand({
  vorher: 12, wert: 30, wochenstandVorher: 54, inDieserWoche: true,
}), { vorher: 12, tagesstand: 42, wochenstand: 84, begrenzt: false })

check('leerer Tag', berechneStand({
  vorher: 0, wert: 30, wochenstandVorher: 54, inDieserWoche: true,
}), { vorher: 0, tagesstand: 30, wochenstand: 84, begrenzt: false })

check('Korrektur nach unten', berechneStand({
  vorher: 30, wert: -5, wochenstandVorher: 84, inDieserWoche: true,
}), { vorher: 30, tagesstand: 25, wochenstand: 79, begrenzt: false })

check('Klammer bei 0 — Woche zieht nur die echte Änderung ab', berechneStand({
  vorher: 3, wert: -10, wochenstandVorher: 20, inDieserWoche: true,
}), { vorher: 3, tagesstand: 0, wochenstand: 17, begrenzt: true })

check('Vorwoche lässt den Wochenstand unberührt', berechneStand({
  vorher: 4, wert: 6, wochenstandVorher: 84, inDieserWoche: false,
}), { vorher: 4, tagesstand: 10, wochenstand: 84, begrenzt: false })

// Der Fall aus dem Auftrag: „trag 30 Vernetzungsanfragen für heute ein"
// → Antwort muss „heute 30, Woche 84" ergeben.
const geprueft = pruefe('li_anfragen', 30)
if (geprueft.ok) {
  const s = berechneStand({ vorher: 0, wert: geprueft.wert, wochenstandVorher: 54, inDieserWoche: true })
  check('Beispiel aus dem Auftrag', `${METRIK_LABEL[geprueft.feld]}: heute ${s.tagesstand}, Woche ${s.wochenstand}`,
    'Vernetzungsanfragen (LinkedIn): heute 30, Woche 84')
} else {
  fail++
  console.error('✗ Beispiel aus dem Auftrag — Prüfung schlug fehl')
}

console.log(`\n${pass}/${pass + fail} Fälle korrekt`)
process.exit(fail === 0 ? 0 : 1)
