/**
 * Drift-Wache für die einstellbare Kadenz (25.08.2026, Pipeline-Board Zug 5) —
 * der gefährlichste Eingriff dieser Runde.
 *
 * An `bucketOf` hängt jede Fälligkeit im Cockpit. Eine falsche Zahl macht 600
 * Leute auf einen Schlag fällig oder keinen mehr, und beides fällt erst auf,
 * wenn Kevin morgens vor der falschen Liste sitzt.
 *
 * **Warum hier Zahlen abgetippt stehen und sonst nirgends.** Der Red-Team-Durchgang
 * der Blaupause (Angriff 6) hat den Fehler benannt: `verify-lead-station.ts`
 * rechnet MIT den Konstanten (`ereignis('anfrage', STILL_EMAIL_TAGE + 1)`) und
 * bliebe deshalb grün, auch wenn jemand die Konstante von 30 auf 3 setzt. Genau
 * eine Stelle muss die Vorgabewerte gegen feste Zahlen halten — diese hier.
 *
 * Start: npx tsx scripts/verify-kadenz.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KADENZ_STANDARD,
  aktiveKadenz,
  gueltigeKadenz,
  setzeAktiveKadenz,
  setzeKadenzZurueck,
  type Kadenz,
} from '../app/src/cockpit/lib/kadenz'
import { bucketOf, isDue, FOLLOWUP_THRESHOLDS_DAYS } from '../app/src/cockpit/lib/linkedinFollowups'
import {
  LAUT_ANRUF_TAGE,
  LAUT_INSTAGRAM_TAGE,
  LAUT_PDF_TAGE,
  LAUT_POSTKARTE_TAGE,
  MIN_ABSTAND_TAGE,
  RUHE_MONATE,
  STILL_ANRUF_TAGE,
  STILL_EMAIL_TAGE,
  STILL_POSTKARTE_TAGE,
  leadStation,
  type LeadStationEingabe,
} from '../app/src/cockpit/lib/leadStation'
import type { LeadEreignisTyp, LinkedinThread } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

/* ── 1. DIE GEGENPROBE: Vorgabewerte gegen FESTE Zahlen ─────────────────── */

check('Vorgabe followupTage = [3, 7, 14]', JSON.stringify(KADENZ_STANDARD.followupTage) === '[3,7,14]')
check('Vorgabe stillEmailTage = 30', KADENZ_STANDARD.stillEmailTage === 30)
check('Vorgabe stillPostkarteTage = 7', KADENZ_STANDARD.stillPostkarteTage === 7)
check('Vorgabe stillAnrufTage = 7', KADENZ_STANDARD.stillAnrufTage === 7)
check('Vorgabe lautInstagramTage = 7', KADENZ_STANDARD.lautInstagramTage === 7)
check('Vorgabe lautPdfTage = 14', KADENZ_STANDARD.lautPdfTage === 14)
check('Vorgabe lautPostkarteTage = 21', KADENZ_STANDARD.lautPostkarteTage === 21)
check('Vorgabe lautAnrufTage = 7', KADENZ_STANDARD.lautAnrufTage === 7)
check('Vorgabe mindestabstandTage = 7', KADENZ_STANDARD.mindestabstandTage === 7)
check('Vorgabe ruheMonate = 4', KADENZ_STANDARD.ruheMonate === 4)

/* ── 2. Die alten Konstanten-Exporte zeigen auf dieselben Werte ─────────── */

check('STILL_EMAIL_TAGE unverändert', STILL_EMAIL_TAGE === 30)
check('STILL_POSTKARTE_TAGE unverändert', STILL_POSTKARTE_TAGE === 7)
check('STILL_ANRUF_TAGE unverändert', STILL_ANRUF_TAGE === 7)
check('LAUT_INSTAGRAM_TAGE unverändert', LAUT_INSTAGRAM_TAGE === 7)
check('LAUT_PDF_TAGE unverändert', LAUT_PDF_TAGE === 14)
check('LAUT_POSTKARTE_TAGE unverändert', LAUT_POSTKARTE_TAGE === 21)
check('LAUT_ANRUF_TAGE unverändert', LAUT_ANRUF_TAGE === 7)
check('MIN_ABSTAND_TAGE unverändert', MIN_ABSTAND_TAGE === 7)
check('RUHE_MONATE unverändert', RUHE_MONATE === 4)
check('FOLLOWUP_THRESHOLDS_DAYS unverändert', JSON.stringify(FOLLOWUP_THRESHOLDS_DAYS) === '[3,7,14]')

/* ── 3. Kaputte Werte fallen auf die Vorgabe ────────────────────────────── */

for (const [label, roh] of [
  ['null', null],
  ['undefined', undefined],
  ['eine Zahl', 42],
  ['ein String', 'kaputt'],
  ['ein Array', [1, 2, 3]],
  ['ein leeres Objekt', {}],
] as const) {
  check(`${label} ergibt die Vorgabe`, JSON.stringify(gueltigeKadenz(roh)) === JSON.stringify(KADENZ_STANDARD))
}

for (const [label, wert] of [
  ['0', 0],
  ['negativ', -5],
  ['zu gross', 999],
  ['Komma', 7.5],
  ['NaN', Number.NaN],
  ['String', '7'],
  ['null', null],
] as const) {
  const k = gueltigeKadenz({ ...KADENZ_STANDARD, stillEmailTage: wert })
  check(`stillEmailTage ${label} -> Vorgabe`, k.stillEmailTage === KADENZ_STANDARD.stillEmailTage, String(k.stillEmailTage))
}

{
  // Feldweise, nicht als Ganzes: Ein kaputter Wert reisst neun gute nicht mit.
  const k = gueltigeKadenz({ ...KADENZ_STANDARD, ruheMonate: 'vier', lautPdfTage: 21 })
  check('ein kaputtes Feld setzt nur sich selbst zurueck', k.ruheMonate === 4 && k.lautPdfTage === 21, JSON.stringify(k))
}

{
  const k = gueltigeKadenz({ ...KADENZ_STANDARD, ruheMonate: 25 })
  check('ruheMonate hat eine eigene Obergrenze (24)', k.ruheMonate === 4, String(k.ruheMonate))
  check('ruheMonate 24 ist erlaubt', gueltigeKadenz({ ...KADENZ_STANDARD, ruheMonate: 24 }).ruheMonate === 24)
}

/* ── 4. DIE MONOTONIE: [14, 7, 3] wuerde die Stufen gegeneinander laufen ── */

for (const [label, tage] of [
  ['absteigend', [14, 7, 3]],
  ['gleich', [7, 7, 7]],
  ['mittleres zu gross', [3, 20, 14]],
  ['zu kurz', [3, 7]],
  ['zu lang', [3, 7, 14, 21]],
  ['mit String', [3, '7', 14]],
  ['kein Array', 7],
] as const) {
  const k = gueltigeKadenz({ ...KADENZ_STANDARD, followupTage: tage })
  check(
    `followupTage ${label} -> Vorgabe`,
    JSON.stringify(k.followupTage) === JSON.stringify(KADENZ_STANDARD.followupTage),
    JSON.stringify(k.followupTage),
  )
}

{
  const k = gueltigeKadenz({ ...KADENZ_STANDARD, followupTage: [5, 10, 20] })
  check('aufsteigende Follow-up-Tage werden uebernommen', JSON.stringify(k.followupTage) === '[5,10,20]')
}

/* ── 5. Ohne Ueberschreibung rechnet alles EXAKT wie vorher ─────────────── */

const JETZT = new Date('2026-08-25T12:00:00.000Z')
const TAG = 86_400_000
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * TAG).toISOString()

function eingabe(teil: Partial<LeadStationEingabe> = {}): LeadStationEingabe {
  return { lead_status: 'aktiv', wiedervorlage_am: null, ereignisse: [], thread: null, ...teil }
}
function ereignis(typ: LeadEreignisTyp, tageHer: number) {
  return { typ, at: vorTagen(tageHer) }
}
function thread(teil: Partial<LinkedinThread> = {}): LinkedinThread {
  return {
    id: 't1',
    brand_id: 'b1',
    thread_key: 't1',
    contact_id: null,
    name: 'Test',
    company: '',
    profile_url: '',
    preview: '',
    last_message_at: vorTagen(1),
    last_from: 'me',
    unread: false,
    starred: false,
    followup_stage: 0,
    status: 'active',
    snoozed_until: null,
    loom_status: null,
    ...teil,
  } as LinkedinThread
}

setzeKadenzZurueck()
check('die aktive Kadenz ist beim Start die Vorgabe', JSON.stringify(aktiveKadenz()) === JSON.stringify(KADENZ_STANDARD))

{
  // Die Fixtures aus verify-lead-station.ts, gegengerechnet.
  const knappVorher = leadStation(eingabe({ ereignisse: [ereignis('anfrage', 29)] }), JETZT)
  const knappNachher = leadStation(eingabe({ ereignisse: [ereignis('anfrage', 31)] }), JETZT)
  check('29 Tage: noch Anfrage offen', knappVorher.station === 'anfrage_offen', knappVorher.station)
  check('31 Tage: E-Mail faellig', knappNachher.station === 'email_faellig', knappNachher.station)
}

{
  const t2 = thread({ last_message_at: vorTagen(2) })
  const t4 = thread({ last_message_at: vorTagen(4) })
  check('Stufe 0 nach 2 Tagen: noch nicht faellig', isDue(t2, JETZT) === false)
  check('Stufe 0 nach 4 Tagen: faellig', isDue(t4, JETZT) === true)
}

/* ── 6. MIT Ueberschreibung aendert sich das Verhalten — und zwar ueberall ─ */

{
  const langsam: Kadenz = { ...KADENZ_STANDARD, followupTage: [5, 10, 20] }
  const t4 = thread({ last_message_at: vorTagen(4) })
  check('explizit uebergebene Schwellen wirken auf isDue', isDue(t4, JETZT, langsam.followupTage) === false)
  check('… und auf bucketOf', bucketOf(t4, JETZT, langsam.followupTage) === 'wartet')
  check('ohne Uebergabe bleibt es bei der Vorgabe', bucketOf(t4, JETZT) === 'faellig')
}

{
  const spaet: Kadenz = { ...KADENZ_STANDARD, stillEmailTage: 60 }
  const lead = eingabe({ ereignisse: [ereignis('anfrage', 40)] })
  check('Vorgabe: nach 40 Tagen ist die E-Mail faellig', leadStation(lead, JETZT).station === 'email_faellig')
  check('mit 60 Tagen: noch nicht', leadStation(lead, JETZT, spaet).station === 'anfrage_offen')
}

{
  // Das Modul-Singleton wirkt auf alles, was die Kadenz nicht explizit bekommt.
  setzeAktiveKadenz({ ...KADENZ_STANDARD, followupTage: [5, 10, 20] })
  const t4 = thread({ last_message_at: vorTagen(4) })
  check('nach setzeAktiveKadenz gilt die neue Schwelle ohne Uebergabe', bucketOf(t4, JETZT) === 'wartet')
  setzeKadenzZurueck()
  check('setzeKadenzZurueck stellt die Vorgabe wieder her', bucketOf(t4, JETZT) === 'faellig')
}

{
  // Auch der direkte Setzer laesst keinen Unsinn durch.
  setzeAktiveKadenz({ followupTage: [99, 2, 1], stillEmailTage: -3 })
  check('setzeAktiveKadenz prueft: kaputte Follow-up-Tage -> Vorgabe', JSON.stringify(aktiveKadenz().followupTage) === '[3,7,14]')
  check('setzeAktiveKadenz prueft: negativer Wert -> Vorgabe', aktiveKadenz().stillEmailTage === 30)
  setzeKadenzZurueck()
}

/* ── 7. Quelltext-Wache: kein bucketOf/isDue mit hart gesetzter Schwelle ── */

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
function dateien(ordner: string): string[] {
  const out: string[] = []
  for (const eintrag of readdirSync(ordner)) {
    if (eintrag === 'node_modules' || eintrag.startsWith('.')) continue
    const p = join(ordner, eintrag)
    if (statSync(p).isDirectory()) out.push(...dateien(p))
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p)
  }
  return out
}

{
  // Niemand darf die Schwellen abtippen. Die Zahlen stehen in kadenz.ts.
  const treffer: string[] = []
  for (const datei of dateien(join(wurzel, 'app/src'))) {
    if (datei.endsWith('kadenz.ts')) continue
    const inhalt = readFileSync(datei, 'utf8')
    if (/\[\s*3\s*,\s*7\s*,\s*14\s*\]/.test(inhalt)) treffer.push(relative(wurzel, datei))
  }
  check('die Schwellen [3, 7, 14] stehen nur in kadenz.ts', treffer.length === 0, treffer.join(', '))
}

{
  // Gegenprobe, dass die Wache ueberhaupt etwas sieht: kadenz.ts selbst
  // enthaelt das Muster, wurde oben aber ausdruecklich uebersprungen.
  const kadenzQuelle = readFileSync(join(wurzel, 'app/src/cockpit/lib/kadenz.ts'), 'utf8')
  check('Gegenprobe: kadenz.ts enthaelt das gesuchte Muster', /\[\s*3\s*,\s*7\s*,\s*14\s*\]/.test(kadenzQuelle))
}

console.log(`\nverify-kadenz: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
