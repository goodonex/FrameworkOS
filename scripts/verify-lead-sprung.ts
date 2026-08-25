/**
 * Drift-Wache für die Handkorrektur (25.08.2026, Pipeline-Board Zug 6).
 *
 * Kevin darf einen Lead von Hand auf eine Stufe setzen. Der naheliegende Weg
 * wäre gewesen, ein Kanal-Ereignis nachzutragen — und genau der hätte die
 * Historie unbrauchbar gemacht: Die Zeile behauptete, eine Analyse sei
 * rausgegangen, und `funnelRaten` rechnete daraus eine Conversion aus einer
 * Nachricht, die nie jemand bekommen hat.
 *
 * Deshalb `uebersprungen`: ein Typ, der nichts über einen Kanal behauptet.
 * Dieses Skript hält die zwei Fehler fest, die die Blaupause namentlich nennt.
 *
 * Start: npx tsx scripts/verify-lead-sprung.ts
 */
import { SPRUNG_ZIELE, leadStation, type LeadStationEingabe } from '../app/src/cockpit/lib/leadStation'
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

const JETZT = new Date('2026-08-25T12:00:00.000Z')
const TAG = 86_400_000
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * TAG).toISOString()

type Ereignis = LeadStationEingabe['ereignisse'][number]
function e(typ: LeadEreignisTyp, tageHer: number, details?: Record<string, unknown>): Ereignis {
  return { typ, at: vorTagen(tageHer), details }
}
function sprung(nach: string, tageHer: number, grund = 'von Hand'): Ereignis {
  return e('uebersprungen', tageHer, { von: 'email_faellig', nach, grund })
}
function eingabe(teil: Partial<LeadStationEingabe> = {}): LeadStationEingabe {
  return { lead_status: 'aktiv', wiedervorlage_am: null, ereignisse: [], thread: null, ...teil }
}
function thread(teil: Partial<LinkedinThread> = {}): LinkedinThread {
  return {
    id: 't1', brand_id: 'b1', thread_key: 't1', contact_id: null, name: 'Test', company: '',
    profile_url: '', preview: '', last_message_at: vorTagen(1), last_from: 'me', unread: false,
    starred: false, followup_stage: 0, status: 'active', snoozed_until: null, loom_status: null,
    ...teil,
  } as LinkedinThread
}

/* ── Der Normalfall ────────────────────────────────────────────────────── */

{
  const r = leadStation(eingabe({ ereignisse: [e('anfrage', 60), sprung('anruf_faellig', 1)] }), JETZT)
  check('von Hand auf Anruf gesetzt', r.station === 'anruf_faellig', r.station)
  check('und sofort faellig', r.faellig === true)
  check('der Grund steht im naechsten Schritt', r.naechsterSchritt.includes('von Hand'), r.naechsterSchritt)
}

{
  // Ohne Sprung stuende dieser Lead auf email_faellig.
  const ohne = leadStation(eingabe({ ereignisse: [e('anfrage', 60)] }), JETZT)
  check('Gegenprobe: ohne Sprung greift die normale Kette', ohne.station === 'email_faellig', ohne.station)
}

/* ── DER WAHRSCHEINLICHSTE FEHLER: die Kette ueberschreibt den Sprung ───── */

{
  // lauteKette liest rueckwaerts. Stuende die Auswertung dort, gewaenne das
  // juengste Kanal-Ereignis und der Sprung waere wirkungslos.
  const r = leadStation(
    eingabe({
      ereignisse: [e('angenommen', 120), e('instagram', 60), e('pdf', 40), sprung('anruf_faellig', 1)],
      thread: thread({ followup_stage: 3, last_message_at: vorTagen(110) }),
    }),
    JETZT,
  )
  check('DER FEHLER: der Sprung schlaegt die laute Kette', r.station === 'anruf_faellig', r.station)
}

{
  // Auch der Thread-Hauptweg darf ihn nicht ueberschreiben.
  const r = leadStation(
    eingabe({ ereignisse: [e('angenommen', 20), sprung('pdf_faellig', 1)], thread: thread({ last_from: 'them' }) }),
    JETZT,
  )
  check('der Sprung schlaegt auch "Antwort da"', r.station === 'pdf_faellig', r.station)
}

/* ── DER ZWEITE FEHLER: der Lead springt beim naechsten Laden zurueck ───── */

{
  // Rueckwaerts umhaengen: alte Ereignisse bleiben stehen, duerfen ihn aber
  // nicht sofort wieder nach vorn schieben.
  const r = leadStation(
    eingabe({
      ereignisse: [e('anfrage', 200), e('email', 100), e('postkarte', 60), sprung('erstnachricht_faellig', 1)],
    }),
    JETZT,
  )
  check('DER ZWEITE FEHLER: rueckwaerts umhaengen haelt', r.station === 'erstnachricht_faellig', r.station)
}

{
  // Aber ein Ereignis NACH dem Sprung macht ihn ueberholt — dann rechnet die
  // Kette wieder selbst. Das ist gewollt: Die Postkarte ging wirklich raus.
  const r = leadStation(
    eingabe({ ereignisse: [e('anfrage', 200), sprung('email_faellig', 30), e('postkarte', 2)] }),
    JETZT,
  )
  check('ein echtes Ereignis danach ueberholt den Sprung', r.station === 'anruf_faellig', r.station)
}

{
  // Ein Ereignis VOR dem Sprung ueberholt ihn nicht.
  const r = leadStation(
    eingabe({ ereignisse: [e('anfrage', 200), e('postkarte', 30), sprung('email_faellig', 2)] }),
    JETZT,
  )
  check('ein Ereignis davor laesst den Sprung stehen', r.station === 'email_faellig', r.station)
}

/* ── Der juengste Sprung gewinnt ────────────────────────────────────────── */

{
  const r = leadStation(
    eingabe({ ereignisse: [e('anfrage', 60), sprung('pdf_faellig', 10), sprung('anruf_faellig', 2)] }),
    JETZT,
  )
  check('der juengste Sprung gewinnt', r.station === 'anruf_faellig', r.station)
}

{
  // Reihenfolge im Array darf egal sein.
  const r = leadStation(
    eingabe({ ereignisse: [sprung('anruf_faellig', 2), e('anfrage', 60), sprung('pdf_faellig', 10)] }),
    JETZT,
  )
  check('die Array-Reihenfolge aendert nichts', r.station === 'anruf_faellig', r.station)
}

/* ── Endstationen stechen den Sprung ────────────────────────────────────── */

{
  const r = leadStation(
    eingabe({ lead_status: 'kunde', ereignisse: [sprung('anruf_faellig', 1)] }),
    JETZT,
  )
  check('Kunde sticht den Sprung', r.station === 'kunde', r.station)
}

{
  const r = leadStation(
    eingabe({ lead_status: 'disqualifiziert', ereignisse: [sprung('anruf_faellig', 1)] }),
    JETZT,
  )
  check('Aussortiert sticht den Sprung', r.station === 'disqualifiziert', r.station)
}

/* ── Fremdeingabe aus jsonb: ignorieren statt vergiften ─────────────────── */

for (const [label, details] of [
  ['ohne details', undefined],
  ['leeres Objekt', {}],
  ['nach fehlt', { von: 'email_faellig' }],
  ['nach ist keine Station', { nach: 'quatsch' }],
  ['nach ist eine Zahl', { nach: 42 }],
  ['nach ist null', { nach: null }],
  ['nach ist eine Endstation', { nach: 'kunde' }],
  ['nach ist wartet_auf_antwort', { nach: 'wartet_auf_antwort' }],
] as const) {
  const r = leadStation(
    eingabe({ ereignisse: [e('anfrage', 60), { typ: 'uebersprungen', at: vorTagen(1), details: details as never }] }),
    JETZT,
  )
  check(`${label}: Sprung wird ignoriert`, r.station === 'email_faellig', `${label} -> ${r.station}`)
}

{
  const r = leadStation(
    eingabe({ ereignisse: [e('anfrage', 60), { typ: 'uebersprungen', at: 'kaputt', details: { nach: 'anruf_faellig' } }] }),
    JETZT,
  )
  check('unlesbarer Zeitstempel: Sprung wird ignoriert', r.station === 'email_faellig', r.station)
}

/* ── Die erlaubten Ziele ────────────────────────────────────────────────── */

{
  check('es gibt genau sechs Sprung-Ziele', SPRUNG_ZIELE.length === 6, JSON.stringify(SPRUNG_ZIELE))
  check(
    'kein Ziel ist eine Endstation',
    !SPRUNG_ZIELE.some((z) => ['kunde', 'disqualifiziert', 'ruht', 'wiedervorlage'].includes(z)),
  )
  check(
    'jedes Ziel funktioniert auch wirklich',
    SPRUNG_ZIELE.every((ziel) => {
      const r = leadStation(eingabe({ ereignisse: [e('anfrage', 60), sprung(ziel, 1)] }), JETZT)
      return r.station === ziel
    }),
  )
}

console.log(`\nverify-lead-sprung: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
