/**
 * Verifikation für Wargame Zug 6 (docs/wargames/linkedin-followups.md).
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-linkedin-followups.ts
 */
import { bucketOf, coverage, isDue } from '../app/src/cockpit/lib/linkedinFollowups'
import type { Contact, LinkedinThread } from '../app/src/types/db'

const NOW = new Date('2026-07-28T12:00:00Z')
const dayAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

function makeThread(overrides: Partial<LinkedinThread>): LinkedinThread {
  return {
    id: 'thread-1',
    brand_id: 'brand-1',
    thread_key: 'urn:li:messagingThread:test',
    contact_id: null,
    name: 'Test Kontakt',
    company: '',
    profile_url: '',
    preview: '',
    last_message_at: dayAgo(1),
    last_from: 'me',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active',
    first_seen_at: dayAgo(30),
    last_synced_at: dayAgo(0),
    ...overrides,
  }
}

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: 'contact-1',
    brand_id: 'brand-1',
    contact_type: 'person',
    parent_company_id: null,
    contact_status: 'in_contact',
    first_name: 'Test',
    last_name: 'Kontakt',
    job_title: '',
    address: '',
    lead_source: 'linkedin',
    follow_up_type: '',
    name: 'Test Kontakt',
    email: '',
    phone: '',
    website: '',
    instagram: '',
    linkedin: 'https://www.linkedin.com/in/test',
    company: '',
    source_content_piece_id: null,
    source_campaign_id: null,
    source_funnel_id: null,
    lead_quality: 'good',
    lead_value: null,
    pipeline_stage: 'conversation',
    last_contact_at: null,
    next_follow_up_at: null,
    notes: '',
    call_notes: '',
    activity_log: [],
    bedarf: '',
    ansprechpartner: '',
    aktuelle_situation: '',
    hauptproblem: '',
    timeline: '',
    budget: '',
    ist_entscheider: false,
    entscheider_name: '',
    einwaende: '',
    naechste_schritte: '',
    abschluss_wahrscheinlichkeit: 0,
    potenzial_betrag: 0,
    potenzial_typ: 'einmalig',
    potenzial_notiz: '',
    custom_fields: {},
    updated_at: dayAgo(0),
    ...overrides,
  }
}

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

// --- isDue / bucketOf ---

// 1. Fällig: Stufe 0, 4 Tage her (Schwelle 3)
check('1 faellig stufe0', isDue(makeThread({ followup_stage: 0, last_message_at: dayAgo(4) }), NOW), true)

// 2. Noch nicht fällig: Stufe 0, 2 Tage her (Schwelle 3)
check('2 noch nicht faellig stufe0', isDue(makeThread({ followup_stage: 0, last_message_at: dayAgo(2) }), NOW), false)

// 3. Fällig: Stufe 1, 8 Tage her (Schwelle 7)
check('3 faellig stufe1', isDue(makeThread({ followup_stage: 1, last_message_at: dayAgo(8) }), NOW), true)

// 4. Fällig: Stufe 2, 15 Tage her (Schwelle 14)
check('4 faellig stufe2', isDue(makeThread({ followup_stage: 2, last_message_at: dayAgo(15) }), NOW), true)

// 5. Nie fällig: Stufe 3 (> 2), auch wenn uralt
check('5 stufe3 nie faellig', isDue(makeThread({ followup_stage: 3, last_message_at: dayAgo(100) }), NOW), false)

// 6. Nicht fällig: last_from = 'them'
check('6 them nicht faellig', isDue(makeThread({ last_from: 'them', last_message_at: dayAgo(30) }), NOW), false)

// 7. Nicht fällig: last_from = 'unknown' (darf nie durchfallen)
check('7 unknown nicht faellig', isDue(makeThread({ last_from: 'unknown', last_message_at: dayAgo(30) }), NOW), false)

// 8. Nicht fällig: snoozed_until in der Zukunft
check(
  '8 snoozed nicht faellig',
  isDue(makeThread({ last_message_at: dayAgo(10), snoozed_until: new Date(NOW.getTime() + 86400000).toISOString() }), NOW),
  false,
)

// 9. Nicht fällig: status != active
check('9 waiting_reply nicht faellig', isDue(makeThread({ status: 'waiting_reply', last_message_at: dayAgo(10) }), NOW), false)

// --- bucketOf: alle sechs Buckets ---

check('10a bucket faellig', bucketOf(makeThread({ followup_stage: 0, last_message_at: dayAgo(4) }), NOW), 'faellig')
check('10b bucket du_bist_dran', bucketOf(makeThread({ last_from: 'them', last_message_at: dayAgo(1) }), NOW), 'du_bist_dran')
check('10c bucket wartet', bucketOf(makeThread({ last_from: 'me', last_message_at: dayAgo(1) }), NOW), 'wartet')
check('10d bucket pruefen (unknown)', bucketOf(makeThread({ last_from: 'unknown' }), NOW), 'pruefen')
check('10e bucket pruefen (kein last_message_at)', bucketOf(makeThread({ last_message_at: null }), NOW), 'pruefen')
check('10f bucket abschluss', bucketOf(makeThread({ followup_stage: 3, last_message_at: dayAgo(20) }), NOW), 'abschluss')
check('10g bucket ruht (archived)', bucketOf(makeThread({ status: 'archived' }), NOW), 'ruht')

// Regression: genau der Zustand, den upsert.mjs schreibt, wenn der Lead geantwortet hat.
// Vorher landete das in 'ruht' und der wichtigste Bucket war dauerhaft leer.
check(
  '10i waiting_reply + them → du_bist_dran',
  bucketOf(makeThread({ status: 'waiting_reply', last_from: 'them' }), NOW),
  'du_bist_dran',
)
// Antwort schlägt Break-up: wer geantwortet hat, bekommt keine Abschluss-Nachricht.
check(
  '10j them schlaegt stufe 3',
  bucketOf(makeThread({ status: 'waiting_reply', last_from: 'them', followup_stage: 3 }), NOW),
  'du_bist_dran',
)
// won/lost sind Endzustaende und ruhen weiterhin.
check('10k bucket ruht (won)', bucketOf(makeThread({ status: 'won', last_from: 'them' }), NOW), 'ruht')
check('10l bucket ruht (lost)', bucketOf(makeThread({ status: 'lost', last_from: 'them' }), NOW), 'ruht')

// Altlast: selbst geschrieben, > 30 Tage her, nie nachgefasst → eigener Bucket,
// damit der Rückstau die tatsächlich heute fälligen Threads nicht ertränkt.
check('10m verwaist (40 Tage, Stufe 0)', bucketOf(makeThread({ last_from: 'me', last_message_at: dayAgo(40) }), NOW), 'verwaist')
// Wer schon nachgefasst hat, ist nicht verwaist, sondern im Prozess.
check('10n stufe 1 trotz 40 Tagen faellig', bucketOf(makeThread({ last_from: 'me', last_message_at: dayAgo(40), followup_stage: 1 }), NOW), 'faellig')
// Knapp unter der Grenze bleibt normale Tagesarbeit.
check('10o 29 Tage bleibt faellig', bucketOf(makeThread({ last_from: 'me', last_message_at: dayAgo(29) }), NOW), 'faellig')
check(
  '10h bucket ruht (snoozed)',
  bucketOf(makeThread({ last_message_at: dayAgo(10), snoozed_until: new Date(NOW.getTime() + 86400000).toISOString() }), NOW),
  'ruht',
)

// 11. Zeitzonen-Stundenfehler folgenlos: 3 Tage minus 1 Stunde (Schwelle 3) darf NICHT fällig sein,
//     3 Tage plus 1 Stunde MUSS fällig sein — Millisekunden-Vergleich, kein Kalendertag.
const threeDaysMinusHour = new Date(NOW.getTime() - (3 * 24 - 1) * 60 * 60 * 1000).toISOString()
const threeDaysPlusHour = new Date(NOW.getTime() - (3 * 24 + 1) * 60 * 60 * 1000).toISOString()
check('11a knapp unter Schwelle', isDue(makeThread({ followup_stage: 0, last_message_at: threeDaysMinusHour }), NOW), false)
check('11b knapp über Schwelle', isDue(makeThread({ followup_stage: 0, last_message_at: threeDaysPlusHour }), NOW), true)

// 12. coverage(): nie_angeschrieben, ohne_kontakt, verwaist + Bucket-Zähler
{
  const threads: LinkedinThread[] = [
    makeThread({ id: 't1', thread_key: 'k1', contact_id: 'c1', followup_stage: 0, last_message_at: dayAgo(4) }), // faellig
    makeThread({ id: 't2', thread_key: 'k2', contact_id: null, last_from: 'them', last_message_at: dayAgo(1) }), // du_bist_dran, ohne_kontakt
    makeThread({
      id: 't3',
      thread_key: 'k3',
      contact_id: 'c2',
      last_from: 'me',
      last_message_at: dayAgo(40),
      followup_stage: 0,
      status: 'active',
    }), // > 30 Tage, stufe unveraendert -> verwaist; auch faellig (stufe0, 40>3)
  ]
  const contacts: Contact[] = [
    makeContact({ id: 'c1', pipeline_stage: 'conversation', linkedin: 'https://linkedin.com/in/c1' }),
    makeContact({ id: 'c2', pipeline_stage: 'conversation', linkedin: 'https://linkedin.com/in/c2' }),
    makeContact({ id: 'c3', pipeline_stage: 'conversation', linkedin: 'https://linkedin.com/in/c3' }), // nie_angeschrieben
    makeContact({ id: 'c4', pipeline_stage: 'paused', linkedin: '' }), // kein ICP, zaehlt nicht
  ]
  const cov = coverage(threads, contacts, NOW)
  // t3 ist 40 Tage alt und nie nachgefasst → zaehlt als Altlast, nicht als heute faellig.
  check('12a coverage.faellig', cov.faellig, 1)
  check('12b coverage.du_bist_dran', cov.du_bist_dran, 1)
  check(
    '12f coverage zaehlt alle Threads',
    cov.faellig + cov.du_bist_dran + cov.wartet + cov.pruefen + cov.abschluss + cov.verwaist + cov.ruht,
    threads.length,
  )
  check('12c coverage.ohne_kontakt', cov.ohne_kontakt, 1)
  check('12d coverage.nie_angeschrieben', cov.nie_angeschrieben, 1)
  check('12e coverage.verwaist', cov.verwaist, 1)
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
