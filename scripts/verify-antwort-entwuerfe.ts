/**
 * Verifikation für Etappe 3, Schritt 2 (docs/IDEEN-2026-07-30-nutzbarkeit.md):
 * Auswahl und Eingabe des Antwort-Entwürfe-Agenten.
 *
 * Kern des Skripts ist die Drift-Wache: `istDuBistDran` (Runner, .mjs) muss über
 * eine Fall-Matrix hinweg exakt dasselbe sagen wie `bucketOf(...) === 'du_bist_dran'`
 * (Cockpit, .ts). Der Runner braucht die Regel nachts ohne Cockpit — dass es
 * zwei Fassungen gibt, ist nur tragbar, solange dieses Skript sie zusammenhält.
 *
 * Start: npx tsx scripts/verify-antwort-entwuerfe.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { ANTWORT_MAX, baueAntwortInput, istDuBistDran } from '../runner/linkedin/antwortThreads.mjs'
import { bucketOf } from '../app/src/cockpit/lib/linkedinFollowups'
import type { LinkedinThread, LinkedinThreadStatus, LinkedinLastFrom } from '../app/src/types/db'

const NOW = new Date('2026-08-03T09:00:00Z')
const tageHer = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
const inTagen = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString()

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
function thread(over: Partial<LinkedinThread> = {}): LinkedinThread {
  seq += 1
  return {
    id: `t${seq}`,
    brand_id: 'b1',
    thread_key: `key-${seq}`,
    contact_id: null,
    name: `Lead ${seq}`,
    company: 'Makler GmbH',
    profile_url: 'https://www.linkedin.com/in/lead',
    preview: 'Klingt spannend, schick mal rüber',
    last_message_at: tageHer(2),
    last_from: 'them',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active',
    first_seen_at: tageHer(30),
    last_synced_at: NOW.toISOString(),
    loom_status: 'offen',
    loom_erledigt_at: null,
    ...over,
  }
}

// ---- 1. Drift-Wache: Runner-Regel == bucketOf über die volle Matrix ----
{
  const stati: LinkedinThreadStatus[] = ['active', 'waiting_reply', 'won', 'lost', 'archived']
  const absender: LinkedinLastFrom[] = ['me', 'them', 'unknown']
  const schlummer = [null, inTagen(1), tageHer(1)]
  const stufen = [0, 1, 2, 3, 4]
  const zeiten = [null, tageHer(0), tageHer(2), tageHer(40)]

  let faelle = 0
  let abweichungen = 0
  for (const status of stati) {
    for (const last_from of absender) {
      for (const snoozed_until of schlummer) {
        for (const followup_stage of stufen) {
          for (const last_message_at of zeiten) {
            const t = thread({ status, last_from, snoozed_until, followup_stage, last_message_at })
            const cockpit = bucketOf(t, NOW) === 'du_bist_dran'
            const runner = istDuBistDran(t, NOW)
            faelle++
            if (cockpit !== runner) {
              abweichungen++
              if (abweichungen <= 3) {
                console.error(
                  `  Drift: status=${status} last_from=${last_from} snooze=${snoozed_until} stage=${followup_stage} ts=${last_message_at} → Cockpit ${cockpit}, Runner ${runner}`,
                )
              }
            }
          }
        }
      }
    }
  }
  check(`1 Drift-Wache über ${faelle} Fälle`, abweichungen, 0)
}

// ---- 2. Die Regel selbst, an den Fällen, die im Alltag zählen ----
{
  check('2 Lead hat geschrieben', istDuBistDran(thread(), NOW), true)
  check('2b Kevin war zuletzt dran', istDuBistDran(thread({ last_from: 'me' }), NOW), false)
  check('2c unklarer Absender', istDuBistDran(thread({ last_from: 'unknown' }), NOW), false)
  check('2d archiviert', istDuBistDran(thread({ status: 'archived' }), NOW), false)
  check('2e gewonnen', istDuBistDran(thread({ status: 'won' }), NOW), false)
  check('2f schlummert noch', istDuBistDran(thread({ snoozed_until: inTagen(2) }), NOW), false)
  check('2g Schlummer abgelaufen', istDuBistDran(thread({ snoozed_until: tageHer(1) }), NOW), true)
  // Der teuerste Fehler im Funnel: Antwort nach drei Follow-ups zählt trotzdem.
  check('2h Antwort nach Stufe 3', istDuBistDran(thread({ followup_stage: 3 }), NOW), true)
  check('2i waiting_reply ist kein Endzustand', istDuBistDran(thread({ status: 'waiting_reply' }), NOW), true)
}

// ---- 3. Eingabe für den Agenten ----
{
  const { input, weitereWarten } = baueAntwortInput(
    [
      thread({ name: 'Neu', last_message_at: tageHer(1) }),
      thread({ name: 'Alt', last_message_at: tageHer(9) }),
      thread({ name: 'Raus', last_from: 'me' }),
    ],
    NOW,
  )
  check('3 nur wartende Threads', input.threads.length, 2)
  check('3b ältester zuerst', input.threads[0].name, 'Alt')
  check('3c Wartetage berechnet', input.threads[0].tage_seit_antwort, 9)
  check('3d nichts über dem Limit', weitereWarten, 0)
}

// 3e. Rangfolge = `dringlichkeit` aus prioritaet.ts: Stern sticht das Alter.
// Sonst entwirft der Agent für andere Threads, als die Arbeitsliste oben zeigt.
{
  const { input } = baueAntwortInput(
    [
      thread({ name: 'Ganz alt', last_message_at: tageHer(40) }),
      thread({ name: 'Stern', last_message_at: tageHer(1), starred: true }),
      thread({ name: 'Mittel', last_message_at: tageHer(10) }),
    ],
    NOW,
  )
  check(
    '3e Stern vor Alter',
    input.threads.map((t: { name: string }) => t.name),
    ['Stern', 'Ganz alt', 'Mittel'],
  )
}

// 4. thread_key ist der Anker für den Entwurf am Posten — er muss immer mit.
{
  const { input } = baueAntwortInput([thread({ thread_key: 'urn:li:conv:(A,7)' })], NOW)
  check('4 thread_key im Input', input.threads[0].thread_key, 'urn:li:conv:(A,7)')
  check('4b contact_id bleibt null', input.threads[0].contact_id, null)
}

// 5. Verlauf wird durchgereicht; fehlt die Spalte 0064, steht dort ein leeres Array.
{
  const mit = baueAntwortInput(
    [thread({ verlauf: [{ sender: 'them', text: 'Moin', ts: null }] })],
    NOW,
  )
  check('5 Verlauf durchgereicht', mit.input.threads[0].verlauf.length, 1)
  const ohne = baueAntwortInput([thread({ verlauf: undefined })], NOW)
  check('5b fehlende Spalte → leeres Array', ohne.input.threads[0].verlauf, [])
}

// 6. Deckel: ein Lauf bleibt überschaubar, der Rest wird gemeldet statt verschwiegen.
{
  const viele = Array.from({ length: ANTWORT_MAX + 5 }, (_, i) =>
    thread({ last_message_at: tageHer(i + 1) }),
  )
  const { input, weitereWarten } = baueAntwortInput(viele, NOW)
  check('6 Deckel greift', input.threads.length, ANTWORT_MAX)
  check('6b Rest wird gemeldet', weitereWarten, 5)
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
