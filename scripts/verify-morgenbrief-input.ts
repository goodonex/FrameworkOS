/**
 * Drift-Wache für den Routine-Morgenbrief-Input (13.08.2026).
 *
 * `runner/morgenbriefInput.mjs` spiegelt bewusst Zahlen und Formeln der App
 * (goals.ts, metricsAggregate.ts, CockpitHome-Knopfpfad). Diese Wache schlägt
 * an, sobald eine Seite justiert wird und die andere stehen bleibt — sonst
 * erzählt der 7-Uhr-Brief andere Ziele als das Cockpit.
 *
 * Start: npx tsx scripts/verify-morgenbrief-input.ts
 */
import {
  WOCHEN_ZIELE,
  MONATSZIELE,
  MONATSZIEL_STANDARD,
  baueVitals,
  teileFollowups,
  montagVon,
  toIsoDatum,
  monatsSchluessel,
  monatszielFuer,
} from '../runner/morgenbriefInput.mjs'
import { WEEK_TARGETS, MONTH_TARGETS, LIFE_TARGET } from '../app/src/cockpit/lib/goals'
import {
  anfragenSum,
  nachrichtenSum,
  termineVereinbartTotal,
} from '../app/src/cockpit/lib/metricsAggregate'
import type { DailyMetricsRow } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

// --- 1. Ziel-Spiegel gegen goals.ts -------------------------------------
{
  const a = Object.entries(WOCHEN_ZIELE)
  const b = Object.entries(WEEK_TARGETS)
  check('WOCHEN_ZIELE hat dieselben Schlüssel wie WEEK_TARGETS', a.length === b.length)
  for (const [k, v] of b) {
    check(
      `Wochenziel „${k}" ist deckungsgleich`,
      (WOCHEN_ZIELE as Record<string, number>)[k] === v,
      `Runner ${String((WOCHEN_ZIELE as Record<string, number>)[k])} vs. App ${v}`,
    )
  }
  for (const [key, ziel] of Object.entries(MONATSZIELE)) {
    check(
      `Monatsziel ${key} ist deckungsgleich`,
      MONTH_TARGETS[key]?.total === ziel,
      `Runner ${ziel} vs. App ${String(MONTH_TARGETS[key]?.total)}`,
    )
  }
  check(
    'jeder feste App-Monat hat einen Runner-Spiegel',
    Object.keys(MONTH_TARGETS).every((k) => k in MONATSZIELE),
  )
  check(
    'Monats-Default == LIFE_TARGET.umsatzMonat',
    MONATSZIEL_STANDARD === LIFE_TARGET.umsatzMonat,
  )
}

// --- 2. Vitals-Formeln gegen metricsAggregate ---------------------------
{
  const zeile = (over: Partial<DailyMetricsRow>): DailyMetricsRow =>
    ({
      datum: '2026-08-10',
      li_anfragen: 0,
      li_nachrichten: 0,
      li_followups: 0,
      ig_anfragen: 0,
      ig_nachrichten: 0,
      ig_followups: 0,
      cold_calls: 0,
      call_followups: 0,
      inmails: 0,
      looms: 0,
      li_antworten: 0,
      ig_antworten: 0,
      call_antworten: 0,
      termine_li: 0,
      termine_ig: 0,
      termine_call: 0,
      quali_termine: 0,
      sales_calls: 0,
      abschluesse: 0,
      umsatz: 0,
      ...over,
    }) as DailyMetricsRow

  const wochenZeilen = [
    zeile({ li_anfragen: 30, ig_anfragen: 5, li_nachrichten: 8, looms: 2, termine_li: 1, umsatz: 5000 }),
    zeile({ datum: '2026-08-11', li_anfragen: 65, ig_nachrichten: 3, termine_call: 1, abschluesse: 1 }),
  ]
  const vitals = baueVitals(wochenZeilen)
  const erwartet = {
    Anfragen: wochenZeilen.reduce((a, r) => a + anfragenSum(r), 0),
    Nachrichten: wochenZeilen.reduce((a, r) => a + nachrichtenSum(r), 0),
    Looms: wochenZeilen.reduce((a, r) => a + r.looms, 0),
    Termine: wochenZeilen.reduce((a, r) => a + termineVereinbartTotal(r), 0),
    Abschlüsse: wochenZeilen.reduce((a, r) => a + r.abschluesse, 0),
  }
  check('fünf Vitals in App-Reihenfolge', vitals.map((v) => v.label).join(',') === 'Anfragen,Nachrichten,Looms,Termine,Abschlüsse')
  for (const v of vitals) {
    check(
      `Vital „${v.label}" rechnet wie metricsAggregate`,
      v.current === (erwartet as Record<string, number>)[v.label],
      `Runner ${v.current} vs. App ${(erwartet as Record<string, number>)[v.label]}`,
    )
    check(
      `Vital „${v.label}" trägt das App-Ziel`,
      Object.values(WEEK_TARGETS).includes(v.target as never),
    )
  }
  check('leere Woche → alle current 0', baueVitals([]).every((v) => v.current === 0))
}

// --- 3. Follow-up-Teilung wie der Cockpit-Knopf -------------------------
{
  const jetzt = new Date('2026-08-13T09:00:00')
  const k = (name: string, stage: string, at: string | null) => ({
    name,
    company: name,
    pipeline_stage: stage,
    next_follow_up_at: at,
  })
  const { overdue, today } = teileFollowups(
    [
      k('Gestern', 'conversation', '2026-08-12T10:00:00+02:00'),
      k('HeuteFrüh', 'proposal', '2026-08-13T07:00:00+02:00'),
      k('HeuteAbend', 'deal', '2026-08-13T22:00:00+02:00'),
      k('Morgen', 'conversation', '2026-08-14T09:00:00+02:00'),
      k('Pausiert', 'paused', '2026-08-12T10:00:00+02:00'),
      k('OhneTermin', 'conversation', null),
      k('ErstkontaktAlt', 'first_contact', '2026-06-02T00:00:00+02:00'),
    ],
    jetzt,
  )
  check('gestern fällig → overdue', overdue.some((f) => f.name === 'Gestern'))
  check('first_contact mit Termin bleibt drin (Knopf-Parität)', overdue.some((f) => f.name === 'ErstkontaktAlt'))
  check('heute früh und heute Abend → today', today.length === 2 && today.every((f) => f.name.startsWith('Heute')))
  check('morgen taucht nirgends auf', ![...overdue, ...today].some((f) => f.name === 'Morgen'))
  check('paused fliegt raus', ![...overdue, ...today].some((f) => f.name === 'Pausiert'))
  check('ohne next_follow_up_at fliegt raus', ![...overdue, ...today].some((f) => f.name === 'OhneTermin'))
  check(
    'Mapping trägt die Skill-Felder',
    overdue.every((f) => 'name' in f && 'company' in f && 'stage' in f && 'nextFollowUp' in f),
  )
}

// --- 4. Datums-Helfer ----------------------------------------------------
{
  check('Mittwoch → Montag derselben Woche', toIsoDatum(montagVon(new Date('2026-08-12T15:00:00'))) === '2026-08-10')
  check('Sonntag gehört zur Vorwoche', toIsoDatum(montagVon(new Date('2026-08-16T10:00:00'))) === '2026-08-10')
  check('Montag bleibt Montag', toIsoDatum(montagVon(new Date('2026-08-10T00:30:00'))) === '2026-08-10')
  check('Monats-Schlüssel im goals-Format', monatsSchluessel(new Date('2026-08-13')) === '2026-08')
}

// --- 5. Monatsziel-Staffelung -------------------------------------------
{
  check('Kevin-Override schlägt die Kurve', monatszielFuer('2026-08', 60000) === 60000)
  check('bekannter Monat nimmt die Kurve', monatszielFuer('2026-08', null) === 50000)
  check('unbekannter Monat fällt auf den Default', monatszielFuer('2027-01', undefined) === MONATSZIEL_STANDARD)
  check('Override 0/negativ zählt nicht', monatszielFuer('2026-08', 0) === 50000)
}

console.log(`verify-morgenbrief-input: ${pass} ok, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
