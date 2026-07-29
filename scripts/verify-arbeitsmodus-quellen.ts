/**
 * Verifikation für Wargame Zug 3/5 Zulieferer (docs/wargames/sales-arbeitsmodus.md).
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-arbeitsmodus-quellen.ts
 */
import {
  antwortPosten,
  erstnachrichtPosten,
  followupPosten,
  loomPosten,
  zeilenId,
} from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import type { Erstnachricht } from '../app/src/hooks/useErstnachrichten'
import type { LinkedinThread } from '../app/src/types/db'

const NOW = new Date('2026-07-29T12:00:00Z')
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
    loom_status: 'offen',
    loom_erledigt_at: null,
    ...overrides,
  }
}

function makeLead(overrides: Partial<Erstnachricht>): Erstnachricht {
  return {
    id: 'lead-1',
    gruppe: 'Gruppe A',
    name: 'Lead Name',
    firma: '',
    website: '',
    nachricht: 'Hallo …',
    sort_index: 0,
    status: 'offen',
    sent_at: null,
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

// 1. antwortPosten: nur 'du_bist_dran' (Lead hat geantwortet).
{
  const threads = [
    makeThread({ id: 't1', last_from: 'them', last_message_at: dayAgo(1) }),
    makeThread({ id: 't2', last_from: 'me', last_message_at: dayAgo(1) }), // wartet, kein antwort-posten
  ]
  const posten = antwortPosten(threads, NOW)
  check('1a genau ein antwort-posten', posten.length, 1)
  check('1b id mit thread-praefix', posten[0]?.id, 'thread:t1')
  check('1c spur antwort', posten[0]?.spur, 'antwort')
}

// 2. loomPosten: nur starred + loom_status 'offen'.
{
  const threads = [
    makeThread({ id: 't1', starred: true, loom_status: 'offen' }),
    makeThread({ id: 't2', starred: true, loom_status: 'verschickt' }), // schon erledigt
    makeThread({ id: 't3', starred: false, loom_status: 'offen' }), // kein Stern, kein Loom-Posten
  ]
  const posten = loomPosten(threads)
  check('2a genau ein loom-posten', posten.length, 1)
  check('2b id mit loom-praefix', posten[0]?.id, 'loom:t1')
  check('2c starred true', posten[0]?.starred, true)
}

// 3. followupPosten: nur faellige Threads (bucketOf === 'faellig').
{
  const threads = [
    makeThread({ id: 't1', followup_stage: 0, last_message_at: dayAgo(4) }), // faellig (Schwelle 3)
    makeThread({ id: 't2', followup_stage: 0, last_message_at: dayAgo(1) }), // wartet noch
  ]
  const posten = followupPosten(threads, NOW)
  check('3a genau ein followup-posten', posten.length, 1)
  check('3b id mit thread-praefix', posten[0]?.id, 'thread:t1')
}

// 4. erstnachrichtPosten: nur offen, Reihenfolge nach sort_index.
{
  const leads = [
    makeLead({ id: 'l2', name: 'Zwei', sort_index: 2 }),
    makeLead({ id: 'l1', name: 'Eins', sort_index: 1 }),
    makeLead({ id: 'l3', name: 'Drei', sort_index: 3, status: 'gesendet' }), // raus
  ]
  const posten = erstnachrichtPosten(leads)
  check('4a nur offene', posten.length, 2)
  check('4b reihenfolge nach sort_index', posten.map((p) => p.name), ['Eins', 'Zwei'])
}

// 5. zeilenId strippt genau das erste Praefix.
check('5a thread-praefix', zeilenId('thread:abc-123'), 'abc-123')
check('5b loom-praefix', zeilenId('loom:xyz'), 'xyz')
check('5c ohne praefix', zeilenId('ohnepraefix'), 'ohnepraefix')

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
