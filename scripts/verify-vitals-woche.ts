/**
 * Verifikation für den Wochen-Vitals-Bug an der Monatsgrenze
 * (docs/IDEEN-2026-07-30-nutzbarkeit.md, Abschnitt „Sofort").
 *
 * Der Fehler: `weekRows` wurde aus `monthRows` gefiltert. Am Samstag, 01.08.2026
 * (Wochenstart Mo 27.07.) hätte die Woche damit alle Mo–Fr-Tage verloren und die
 * Vitals wären auf den Stand eines einzigen Tages gefallen.
 *
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-vitals-woche.ts
 */
import { mondayOf, toIsoDate, weekRowsOf } from '../app/src/cockpit/lib/metricsDates'
import { weekVitals } from '../app/src/cockpit/lib/metricsAggregate'
import type { DailyMetricsRow } from '../app/src/cockpit/lib/useDailyMetrics'

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

/** Lokale Datums-Konstruktion — die Wochenlogik rechnet bewusst in Ortszeit. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0)

function makeRow(datum: string, werte: Partial<DailyMetricsRow> = {}): DailyMetricsRow {
  return {
    datum,
    li_anfragen: 0,
    li_nachrichten: 0,
    inmails: 0,
    looms: 0,
    ig_anfragen: 0,
    ig_nachrichten: 0,
    cold_calls: 0,
    coldmails: 0,
    followups: 0,
    li_followups: 0,
    ig_followups: 0,
    call_followups: 0,
    antworten_li: 0,
    antworten_inmail: 0,
    antworten_ig: 0,
    antworten_cold: 0,
    quali_termine: 0,
    sales_calls: 0,
    termine_vereinbart: 0,
    termine_li: 0,
    termine_ig: 0,
    termine_call: 0,
    abschluesse: 0,
    umsatz: 0,
    ...werte,
  }
}

const FENSTER_START = at(2026, 7, 13)

/**
 * Ladefenster ab 13.07.2026 bis einschließlich `bis` — so, wie es aus Supabase
 * käme: keine Zeilen für Tage, die noch nicht stattgefunden haben. Jeder Tag mit
 * gleichmäßigem Ertrag: 10 Anfragen (li 6 + ig 4), 5 Nachrichten, 2 Looms, 1 Termin.
 */
function fensterBis(bis: Date): DailyMetricsRow[] {
  const out: DailyMetricsRow[] = []
  const d = new Date(FENSTER_START)
  while (toIsoDate(d) <= toIsoDate(bis)) {
    out.push(
      makeRow(toIsoDate(d), {
        li_anfragen: 6,
        ig_anfragen: 4,
        li_nachrichten: 3,
        ig_nachrichten: 2,
        looms: 2,
        termine_li: 1,
      }),
    )
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Die kaputte Alt-Logik, exakt wie sie in useDailyMetrics.ts:365-368 stand. */
function weekRowsAlt(rows: DailyMetricsRow[], now: Date): DailyMetricsRow[] {
  const monthStart = toIsoDate(now).slice(0, 8) + '01'
  const monthRows = rows.filter((r) => r.datum >= monthStart)
  const mondayIso = toIsoDate(mondayOf(now))
  return monthRows.filter((r) => r.datum >= mondayIso)
}

// 0. Fixture-Annahme: der 01.08.2026 ist wirklich ein Samstag, Wochenstart Mo 27.07.
{
  const samstag = at(2026, 8, 1)
  check('0a 01.08.2026 ist Samstag', samstag.getDay(), 6)
  check('0b Wochenstart ist Mo 27.07.', toIsoDate(mondayOf(samstag)), '2026-07-27')
}

// 1. Der eigentliche Bug: Woche über die Monatsgrenze behält Mo–Fr.
{
  const now = at(2026, 8, 1)
  const fenster = fensterBis(now)
  check(
    '1a Sa 01.08. — volle Woche Mo bis heute',
    weekRowsOf(fenster, now).map((r) => r.datum),
    ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01'],
  )
  // Gegenprobe: Die alte Logik verlor genau diese fünf Tage.
  check(
    '1b Alt-Logik verlor Mo–Fr',
    weekRowsAlt(fenster, now).map((r) => r.datum),
    ['2026-08-01'],
  )
}

// 2. Vitals fallen an der Monatsgrenze nicht auf einen Tagesstand zurück.
{
  const now = at(2026, 8, 1)
  const fenster = fensterBis(now)
  const vitals = weekVitals(weekRowsOf(fenster, now), fenster, now)
  const wert = (key: string) => vitals.find((v) => v.key === key)?.current
  check('2a Anfragen = 6 Tage x 10', wert('anfragen'), 60)
  check('2b Nachrichten = 6 Tage x 5', wert('nachrichten'), 30)
  check('2c Looms = 6 Tage x 2', wert('looms'), 12)
  check('2d Termine = 6 Tage x 1', wert('termine'), 6)

  // Was der Bug produziert hätte: der Stand des 01.08. allein — bei Ziel 50
  // Anfragen also 10/50 statt 60/50, die „~0/75"-Anzeige aus dem Doc.
  const altVitals = weekVitals(weekRowsAlt(fenster, now), fenster, now)
  check('2e Alt-Logik zeigte nur einen Tag', altVitals.find((v) => v.key === 'anfragen')?.current, 10)
}

// 3. Sparkline-Verlauf am Monatsersten: 14 gefüllte Balken aus dem Ladefenster,
//    nicht ein einzelner. Genau dafür bekommt weekVitals windowRows statt monthRows.
{
  const now = at(2026, 8, 1)
  const fenster = fensterBis(now)
  const history = weekVitals(weekRowsOf(fenster, now), fenster, now).find(
    (v) => v.key === 'anfragen',
  )?.history
  check('3a 14 Balken', history?.length, 14)
  check('3b keine Lücke (alle Tage im Fenster befüllt)', history?.filter((n) => n === 0).length, 0)

  // Mit monthRows (Alt-Verhalten) wäre nur der letzte Balken gefüllt gewesen.
  const monthRows = fenster.filter((r) => r.datum >= '2026-08-01')
  const altHistory = weekVitals(fenster, monthRows, now).find((v) => v.key === 'anfragen')?.history
  check('3c Alt-Verhalten hatte 13 leere Balken', altHistory?.filter((n) => n === 0).length, 13)
}

// 4. Wochengrenzen sauber: Vorwoche raus, Sonntag noch drin, neuer Montag schneidet.
{
  const sonntag = at(2026, 8, 2)
  const wocheSo = weekRowsOf(fensterBis(sonntag), sonntag)
  check('4a So 02.08. gehoert noch zur Woche ab 27.07.', wocheSo.length, 7)
  check('4b letzter Tag ist der Sonntag', wocheSo[wocheSo.length - 1]?.datum, '2026-08-02')
  check('4c Vorwoche nicht enthalten', wocheSo.some((r) => r.datum < '2026-07-27'), false)

  const montag = at(2026, 8, 3)
  check(
    '4d Mo 03.08. startet neue Woche',
    weekRowsOf(fensterBis(montag), montag).map((r) => r.datum),
    ['2026-08-03'],
  )
}

// 5. Obergrenze Sonntag greift auch, wenn spätere Zeilen existieren (z. B.
//    rückwirkendes Tracking hat bereits Zeilen der Folgewoche angelegt).
{
  const montag = at(2026, 7, 27)
  const mitFolgewoche = fensterBis(at(2026, 8, 5))
  const woche = weekRowsOf(mitFolgewoche, montag)
  check('5a Mo 27.07. — Woche endet am Sonntag', woche[woche.length - 1]?.datum, '2026-08-02')
  check('5b Folgewoche bleibt draussen', woche.some((r) => r.datum >= '2026-08-03'), false)
}

// 6. Normalfall mitten im Monat bleibt unverändert (keine Regression).
{
  const mittwoch = at(2026, 7, 22)
  check(
    '6 Mi 22.07. — Montag bis heute',
    weekRowsOf(fensterBis(mittwoch), mittwoch).map((r) => r.datum),
    ['2026-07-20', '2026-07-21', '2026-07-22'],
  )
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
