/**
 * Verifikation für Etappe 3, Schritt 4 (docs/IDEEN-2026-07-30-nutzbarkeit.md):
 * Tagesansage aus `arbeits_dauern` + die Termin-Auswahl fürs Heute-Deck.
 *
 * Der Punkt, an dem hier nichts schiefgehen darf: Es wird NICHTS geschätzt.
 * Ohne Messwerte gibt es keine Uhrzeit — eine erfundene wäre schlimmer als gar
 * keine, weil Kevin danach seinen Tag plant.
 *
 * Start: npx tsx scripts/verify-tagesansage.ts
 */
import {
  formatDauer,
  medianeJeSpur,
  restarbeit,
  tagesansage,
  type Dauern,
} from '../app/src/cockpit/lib/tagesansage'
import { eventsByDate, termineAmTag } from '../app/src/cockpit/lib/termineEvents'
import type { Posten, Spur } from '../app/src/cockpit/lib/prioritaet'
import type { Contact } from '../app/src/types/db'

// Fester Zeitpunkt in lokaler Zeit — die Ansage nennt eine lokale Uhrzeit.
const NOW = new Date(2026, 7, 3, 11, 45, 0)

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

let seq = 0
function posten(spur: Spur): Posten {
  seq += 1
  return { id: `p${seq}`, spur, name: `Posten ${seq}`, text: '', timestamp: null }
}

// ---- 1. Median je Spur ----
{
  const d = medianeJeSpur([
    { spur: 'antwort', sekunden: 60 },
    { spur: 'antwort', sekunden: 120 },
    { spur: 'antwort', sekunden: 300 },
    { spur: 'loom', sekunden: 900 },
  ])
  check('1 ungerade Anzahl → mittlerer Wert', d.jeSpur.antwort, 120)
  check('1b einzelner Messwert zählt', d.jeSpur.loom, 900)
  check('1c Gesamtmedian', d.gesamt, 210) // (120+300)/2 über [60,120,300,900]
  check('1d Messwerte gezählt', d.messwerte, 4)
}

// 2. Unbrauchbare Zeilen fliegen raus (0 Sekunden = direkt weggehakt).
{
  const d = medianeJeSpur([
    { spur: 'antwort', sekunden: 0 },
    { spur: 'antwort', sekunden: -5 },
    { spur: 'antwort', sekunden: Number.NaN },
    { spur: 'antwort', sekunden: 200 },
  ])
  check('2 nur echte Messwerte', d.messwerte, 1)
  check('2b Median aus dem einen Wert', d.jeSpur.antwort, 200)
}

// 3. Gar keine Messwerte → keine Zahl, kein Rechnen.
{
  const leer = medianeJeSpur([])
  check('3 kein Gesamtmedian', leer.gesamt, null)
  check('3b keine Restdauer', restarbeit([posten('antwort')], leer).sekunden, null)
  check(
    '3c Ansage ohne Uhrzeit — nur die Zahl, kein Jargon (D8)',
    tagesansage([posten('antwort'), posten('loom')], leer, NOW),
    '2 offen',
  )
}

// 4. Ungemessene Spur fällt auf den Gesamtmedian zurück, statt zu fehlen.
//    Genug Messwerte, damit die Schwellen aus Fall 7 nicht greifen.
{
  const d = medianeJeSpur([
    { spur: 'antwort', sekunden: 120 },
    { spur: 'antwort', sekunden: 120 },
    { spur: 'antwort', sekunden: 120 },
    { spur: 'antwort', sekunden: 120 },
    { spur: 'antwort', sekunden: 120 },
  ])
  const r = restarbeit([posten('antwort'), posten('kundenaufgabe')], d)
  check('4 Summe mit Rückfall', r.sekunden, 240)
  check('4b nur einer echt gemessen', r.gemessen, 1)
}

// 7. Zu dünne Datenlage sagt lieber nichts, als eine Uhrzeit zu erfinden.
//    Realfall 03.08.: drei Zeilen aus Klick-Tests (11–20 s) — daraus darf keine
//    Vormittags-Prognose werden.
{
  const dreiTests = medianeJeSpur([
    { spur: 'erstnachricht', sekunden: 20 },
    { spur: 'kunde_liegt', sekunden: 11 },
    { spur: 'kunde_liegt', sekunden: 11 },
  ])
  const viele = Array.from({ length: 200 }, () => posten('erstnachricht'))
  check('7 unter Gesamt-Schwelle → keine Zahl', restarbeit(viele, dreiTests).sekunden, null)
  check('7b Ansage bleibt ehrlich', tagesansage(viele, dreiTests, NOW), '200 offen')

  // Spur-Median aus 2 Messungen ist Rauschen → Gesamt-Median trägt.
  const duenneSpur = medianeJeSpur([
    { spur: 'antwort', sekunden: 60 },
    { spur: 'antwort', sekunden: 60 },
    { spur: 'loom', sekunden: 600 },
    { spur: 'loom', sekunden: 600 },
    { spur: 'loom', sekunden: 600 },
  ])
  const r = restarbeit([posten('antwort')], duenneSpur)
  check('7c dünne Spur nutzt Gesamt-Median', r.sekunden, duenneSpur.gesamt)
  check('7d zählt nicht als gemessen', r.gemessen, 0)
  check('7e tragfähige Spur nutzt eigenen Median', restarbeit([posten('loom')], duenneSpur).sekunden, 600)
}

// ---- 5. Die Zeile, die Kevin morgens liest ----
{
  const d: Dauern = { jeSpur: { antwort: 500 }, gesamt: 500, messwerte: 12 }
  const zwoelf = Array.from({ length: 12 }, () => posten('antwort'))
  // 12 × 500 s = 6000 s = 1 h 40 · 11:45 + 1:40 = 13:25
  check('5 Kevins Beispielzeile', tagesansage(zwoelf, d, NOW), '12 offen · ≈ 1 h 40 · um 13:25 durch')
}

// 6. Leere Liste ist Feierabend, keine Rechnung.
{
  check('6 nichts offen', tagesansage([], { jeSpur: {}, gesamt: 300, messwerte: 5 }, NOW), 'Liste leer')
}

// 7. Dauer-Format.
{
  check('7 unter einer Stunde', formatDauer(45 * 60), '45 min')
  check('7b glatte Stunden', formatDauer(2 * 3600), '2 h')
  check('7c Stunden + Minuten', formatDauer(6000), '1 h 40')
  check('7d führende Null', formatDauer(3600 + 5 * 60), '1 h 05')
  check('7e Sekundenbruchteile werden nie 0 min', formatDauer(10), '1 min')
}

// ---- 8. Termine des Tages fürs Deck ----
{
  const contact = (over: Partial<Contact>): Contact =>
    ({
      id: 'c1',
      name: 'Anna Bauer',
      company: '',
      email: '',
      linkedin: '',
      pipeline_stage: 'lead',
      next_follow_up_at: null,
      custom_fields: {},
      ...over,
    }) as Contact

  const map = eventsByDate({
    bookings: [
      { id: 'b1', starts_at: '2026-08-03T09:00:00.000Z', status: 'confirmed', name: 'Quali-Call', contact_id: 'c1' },
      { id: 'b2', starts_at: '2026-08-03T14:00:00.000Z', status: 'cancelled', name: 'Abgesagt', contact_id: null },
      { id: 'b3', starts_at: '2026-08-04T09:00:00.000Z', status: 'confirmed', name: 'Morgen', contact_id: null },
    ],
    contacts: [contact({ next_follow_up_at: '2026-08-03' })],
    content: [],
    kalender: [{ id: 'k1', date: '2026-08-03', time: '07:30', title: 'Physio' }],
  })

  const heute = termineAmTag(map, '2026-08-03')
  check('8 nur heutige Termine', heute.length, 3)
  check(
    '8b abgesagte Buchung bleibt draußen',
    heute.some((e) => e.title === 'Abgesagt'),
    false,
  )
  check('8c nach Uhrzeit sortiert', heute[0].title, 'Physio')
  check('8d Follow-up ohne Uhrzeit ans Ende', heute[heute.length - 1].kind, 'followup')
  check('8e Buchung verlinkt auf den Kontakt', heute.find((e) => e.kind === 'booking')?.href, '/sales/c1')
  check('8f leerer Tag', termineAmTag(map, '2026-08-05'), [])
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
