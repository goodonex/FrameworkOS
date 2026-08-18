/**
 * Drift-Wache für den Postfach-Abgleich der Erstnachrichten (17.08.2026).
 *
 * Der Fehler, der das nötig gemacht hat: Die Kachel meldete „117 offen", obwohl
 * 78 dieser Leads längst einen Thread im Postfach hatten — 15 davon hatten sogar
 * geantwortet (Steven Koller: 👍 am 13.07.). `linkedin_erstnachrichten.status`
 * kannte nur den Haken im Cockpit, und den setzt Kevin nicht, wenn er die
 * Nachricht vom Handy verschickt.
 *
 * Geprüft wird deshalb: dass ein Thread als Beleg zählt, dass eine Antwort
 * gesondert gemeldet wird, dass ein FEHLENDER Thread niemanden verschwinden
 * lässt (Sync-Ausfall darf keinen Lead kosten) und dass die Rangfolge im
 * Arbeitsmodus dieselbe Regel benutzt.
 *
 * Start: npx tsx scripts/verify-erstnachrichten-offen.ts
 */
import { erstnachrichtPosten } from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import { teileErstnachrichten, type AbgleichThread, personenSchluessel } from '../app/src/cockpit/lib/erstnachrichtenOffen'
import type { Erstnachricht } from '../app/src/hooks/useErstnachrichten'
import type { LinkedinThread } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`  FEHLT: ${label}${hinweis ? ` — ${hinweis}` : ''}`)
    return
  }
  console.log(`  ok: ${label}`)
}

const lead = (name: string, status: Erstnachricht['status'] = 'offen', sort_index = 0): Erstnachricht => ({
  id: `id-${name}`,
  gruppe: 'Gruppe 1',
  name,
  firma: 'Firma',
  website: 'beispiel.ch',
  nachricht: 'Moin …',
  sort_index,
  status,
  sent_at: null,
})

const thread = (name: string, last_from: AbgleichThread['last_from']): AbgleichThread => ({ name, last_from })

console.log('Postfach-Abgleich der Erstnachrichten:')

const leads = [
  lead('Steven Koller', 'offen', 1), // Thread + Antwort (👍)
  lead('Diego Büchel', 'offen', 2), // Thread, Kevin zuletzt
  lead('Sandro Hagen', 'offen', 3), // kein Thread → echter Vorrat
  lead('Alt Erledigt', 'gesendet', 4),
]
const threads = [thread('Steven Koller', 'them'), thread('diego  büchel', 'me')]

const t = teileErstnachrichten(leads, threads)
check('nur der Lead ohne Thread bleibt offen', t.offen.length === 1 && t.offen[0].name === 'Sandro Hagen',
  `offen: ${t.offen.map((l) => l.name).join(', ')}`)
check('Thread mit eigener letzter Nachricht → „schon raus"', t.schonRaus.map((l) => l.name).join() === 'Diego Büchel')
check('Antwort des Leads wird gesondert gemeldet', t.hatGeantwortet.map((l) => l.name).join() === 'Steven Koller')
check('Groß-/Kleinschreibung und Doppel-Leerzeichen stören den Abgleich nicht', t.schonRaus.length === 1)
check('bereits abgehakte Zeilen tauchen in keinem Topf auf',
  [...t.offen, ...t.schonRaus, ...t.hatGeantwortet].every((l) => l.name !== 'Alt Erledigt'))

const ohneThreads = teileErstnachrichten(leads, [])
check('ohne Threads (Sync-Ausfall) bleibt alles offen — niemand geht verloren', ohneThreads.offen.length === 3,
  `offen: ${ohneThreads.offen.length}`)

const posten = erstnachrichtPosten(leads, threads as LinkedinThread[])
check('erstnachrichtPosten benutzt dieselbe Regel', posten.length === 1 && posten[0].name === 'Sandro Hagen')
check('erstnachrichtPosten ohne Threads verhält sich wie vorher', erstnachrichtPosten(leads).length === 3)

// ---------------------------------------------------------------------------
// Kevins echte Fälle vom 18.08.2026 — an den Prod-Daten gefunden.
//
// Alle drei kamen aus einer Beschwerde („die haben doch schon eine Nachricht
// gehabt"), und jeder steht für eine eigene Ursache. Sie stehen hier
// namentlich, weil eine allgemeine Regel („Akzente egal") beim nächsten
// Umbau leise verloren geht — ein Name mit Datum nicht.
// ---------------------------------------------------------------------------
const echteFaelle = [
  { name: 'Célie-Hélène Helinurm', status: 'offen' as const },
  { name: 'Jonas Jacobi & Moritz Wagner', status: 'offen' as const },
  { name: 'Sandro Hagen', status: 'offen' as const },
]
const echteThreads = [
  // Schreibweise wie im Postfach — NICHT wie in der Lead-Liste.
  { name: 'Célie-Helén Helinurm', last_from: 'me' as const },
  { name: 'Jonas Jacobi', last_from: 'me' as const },
]
const echt = teileErstnachrichten(echteFaelle, echteThreads)
check(
  'Akzent-Abweichung Hélène/Helén gilt als dieselbe Person (Kevin 18.08.)',
  echt.schonRaus.some((l) => l.name === 'Célie-Hélène Helinurm'),
  `schonRaus: ${echt.schonRaus.map((l) => l.name).join(', ')}`,
)
check(
  'Doppelname „X & Y" trifft den Thread der ersten Person (Kevin 18.08.)',
  echt.schonRaus.some((l) => l.name === 'Jonas Jacobi & Moritz Wagner'),
  `schonRaus: ${echt.schonRaus.map((l) => l.name).join(', ')}`,
)
check('wer wirklich keinen Thread hat, bleibt offen', echt.offen.map((l) => l.name).join() === 'Sandro Hagen')

// Die Gegenrichtung: der Schlüssel darf nicht so grob werden, dass zwei
// verschiedene Menschen zusammenfallen. Ein verlorener offener Lead ist
// teurer als einer, der einmal zu viel dasteht.
const namensvettern = teileErstnachrichten(
  [
    { name: 'Michael Schmidt', status: 'offen' as const },
    { name: 'Martina Schmidt', status: 'offen' as const },
  ],
  [{ name: 'Michael Schmidt', last_from: 'me' as const }],
)
check(
  'gleicher Nachname, anderer Vorname bleibt getrennt',
  namensvettern.offen.map((l) => l.name).join() === 'Martina Schmidt' &&
    namensvettern.schonRaus.map((l) => l.name).join() === 'Michael Schmidt',
  `offen: ${namensvettern.offen.map((l) => l.name).join(', ')}`,
)
check(
  'Zweitname stört nicht (Bernd Benno Herrfurth = Bernd Herrfurth)',
  teileErstnachrichten(
    [{ name: 'Bernd Benno Herrfurth', status: 'offen' as const }],
    [{ name: 'Bernd Herrfurth', last_from: 'me' as const }],
  ).schonRaus.length === 1,
)
check('personenSchluessel verträgt Leeres', personenSchluessel(null) === '' && personenSchluessel('  ') === '')

console.log(`\n${pass} ok, ${fail} fehlen`)
process.exit(fail === 0 ? 0 : 1)
