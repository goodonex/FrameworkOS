/**
 * Verifikation für D9 / O13 (docs/wargames/technik-fundament.md, Zug 11i):
 * RRULE-Expansion in `icalParse.ts`. Reine Funktionen, kein Netz —
 * Start: npx tsx scripts/verify-ical-rrule.ts
 *
 * Alle Fälle rechnen in Ortszeit auf Tagesbasis, genau wie der Parser. Eine
 * feste `jetzt`-Zeit hält die Fenster-Grenzen stabil.
 */
import { expandRRule, parseIcal, RRULE_MAX_INSTANZEN } from '../app/src/cockpit/lib/icalParse'

const FENSTER_START = '2026-01-01'
const FENSTER_ENDE = '2026-12-31'
const JETZT = new Date(2026, 7, 9, 12, 0, 0) // 09.08.2026, lokal

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}\n  erwartet ${JSON.stringify(expected)}\n  bekommen ${JSON.stringify(actual)}`)
  }
}

const exp = (start: string, rule: string | null, ex: string[] = []) =>
  expandRRule(start, rule, ex, FENSTER_START, FENSTER_ENDE)

// 1. Wöchentlich MO+DO über drei Wochen (Start ist ein Montag).
{
  const daten = exp('2026-08-03', 'FREQ=WEEKLY;BYDAY=MO,TH;UNTIL=20260820')
  check('1 MO+DO ueber 3 Wochen', daten, [
    '2026-08-03',
    '2026-08-06',
    '2026-08-10',
    '2026-08-13',
    '2026-08-17',
    '2026-08-20',
  ])
}

// 2. INTERVAL=2: jede zweite Woche, nicht jede.
{
  const daten = exp('2026-08-03', 'FREQ=WEEKLY;INTERVAL=2;COUNT=4')
  check('2 alle 2 Wochen', daten, ['2026-08-03', '2026-08-17', '2026-08-31', '2026-09-14'])
}

// 2b. INTERVAL=2 zusammen mit BYDAY — der Sprung gilt der Woche, nicht dem Tag.
{
  const daten = exp('2026-08-03', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=4')
  check('2b alle 2 Wochen MO+DO', daten, [
    '2026-08-03',
    '2026-08-06',
    '2026-08-17',
    '2026-08-20',
  ])
}

// 3. COUNT=5 zählt die erste Instanz mit (RFC 5545).
{
  const daten = exp('2026-08-03', 'FREQ=DAILY;COUNT=5')
  check('3 COUNT=5 inkl. Start', daten, [
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
  ])
}

// 4. UNTIL schneidet mittendrin ab — der Tag selbst zählt noch.
{
  const daten = exp('2026-08-03', 'FREQ=DAILY;UNTIL=20260806T235959Z')
  check('4 UNTIL inklusive', daten, ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06'])
}

// 5. EXDATE fällt raus, ohne den Rhythmus zu verschieben.
{
  const daten = exp('2026-08-03', 'FREQ=DAILY;COUNT=5', ['2026-08-05'])
  check('5 EXDATE faellt raus', daten, ['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07'])
}

// 6. Monatlich am 15. — gleicher Tag, nicht „alle 30 Tage".
{
  const daten = exp('2026-01-15', 'FREQ=MONTHLY;COUNT=4')
  check('6 monatlich am 15.', daten, ['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15'])
}

// 6b. Monatlich am 31.: Monate ohne diesen Tag fallen aus, statt zu verrutschen.
{
  const daten = exp('2026-01-31', 'FREQ=MONTHLY;COUNT=4')
  check('6b der 31. verrutscht nicht', daten, [
    '2026-01-31',
    '2026-03-31',
    '2026-05-31',
    '2026-07-31',
  ])
}

// 7. Kaputte oder nicht unterstützte Regel → Einzeltermin, keine Endlosschleife.
for (const rule of [
  'FREQ=YEARLY',
  'FREQ=WEEKLY;BYDAY=2MO',
  'FREQ=MONTHLY;BYSETPOS=-1;BYDAY=FR',
  'MUELL',
  '',
  'FREQ=DAILY;INTERVAL=0',
]) {
  check(`7 unverstandene Regel bleibt einzeln: ${JSON.stringify(rule)}`, exp('2026-08-03', rule), [
    '2026-08-03',
  ])
}

// 8. Die Kappe greift — „täglich für immer" flutet die Liste nicht.
{
  const daten = expandRRule('2020-01-01', 'FREQ=DAILY', [], '2020-01-01', '2030-01-01')
  check('8a Kappe greift', daten.length, RRULE_MAX_INSTANZEN)
  check('8b beginnt am Start', daten[0], '2020-01-01')
}

// 9. Das Fenster begrenzt nur die Ausgabe, es verschiebt die Serie nicht.
{
  const daten = expandRRule('2026-08-03', 'FREQ=WEEKLY', [], '2026-08-10', '2026-08-31')
  check('9 Fenster schneidet nur zu', daten, ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'])
}

// 10. Ganztägige Serie bleibt am selben Tag (keine Zeitzonen-Verschiebung).
{
  const ical = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:serie@test
SUMMARY:Physio
DTSTART;VALUE=DATE:20260803
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=3
END:VEVENT
END:VCALENDAR`
  const ev = parseIcal(ical, JETZT)
  check('10a drei Instanzen', ev.length, 3)
  check('10b ganztaegig bleibt am selben Tag', ev.map((e) => e.date), [
    '2026-08-03',
    '2026-08-10',
    '2026-08-17',
  ])
  check('10c allDay bleibt', ev.every((e) => e.allDay), true)
  check('10d IDs eindeutig', new Set(ev.map((e) => e.id)).size, 3)
}

// 11. Termin mit Uhrzeit: die Zeit gilt für jede Instanz.
{
  const ical = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:jourfixe@test
SUMMARY:Jour Fixe
DTSTART:20260804T080000Z
RRULE:FREQ=WEEKLY;COUNT=2
EXDATE:20260811T080000Z
END:VEVENT
END:VCALENDAR`
  const ev = parseIcal(ical, JETZT)
  check('11a EXDATE greift auch mit Uhrzeit', ev.length, 1)
  check('11b Uhrzeit an der Instanz', typeof ev[0]?.time === 'string' && ev[0].time.length === 5, true)
}

// 12. Einzeltermine bleiben unangetastet — inklusive ihrer ID.
{
  const ical = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:einzel@test
SUMMARY:Quali-Call
DTSTART:20260803T090000Z
END:VEVENT
END:VCALENDAR`
  const ev = parseIcal(ical, JETZT)
  check('12a genau einer', ev.length, 1)
  check('12b ID unveraendert', ev[0]?.id, 'einzel@test')
}

// 13. Eine Serie ohne Ende bleibt im Fenster und sprengt die Liste nicht.
{
  const ical = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:daily@test
SUMMARY:Taeglich
DTSTART;VALUE=DATE:20260101
RRULE:FREQ=DAILY
END:VEVENT
END:VCALENDAR`
  const ev = parseIcal(ical, JETZT)
  check('13a hoechstens die Kappe', ev.length <= RRULE_MAX_INSTANZEN, true)
  check('13b nichts vor dem Fenster', ev.every((e) => e.date >= '2026-07-09'), true)
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
