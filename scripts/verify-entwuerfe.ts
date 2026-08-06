/**
 * Verifikation für Etappe 3, Schritt 3 (docs/IDEEN-2026-07-30-nutzbarkeit.md):
 * Der Entwurf am Posten — Parsen, Zuordnung, Veralterung, Textstand.
 *
 * Enthält die zweite Drift-Wache dieser Etappe: `parseDraftsRoh` (Runner, .mjs,
 * schreibt an die Threads) muss dasselbe herauslesen wie `parseDrafts`
 * (Cockpit, .ts, füttert die Freigaben-Karten).
 *
 * Start: npx tsx scripts/verify-entwuerfe.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { parseDraftsRoh } from '../runner/linkedin/entwuerfe.mjs'
import { dueFollowupContacts, parseDrafts } from '../app/src/cockpit/lib/approvalDrafts'
import { antwortPosten, followupPosten } from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import { entwurfStand } from '../app/src/cockpit/components/Arbeitsliste'
import type { Contact, LinkedinThread } from '../app/src/types/db'

const NOW = new Date('2026-08-03T09:00:00Z')
const tageHer = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
const stundenHer = (n: number) => new Date(NOW.getTime() - n * 60 * 60 * 1000).toISOString()

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
    preview: 'Klingt spannend',
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

const runMd = (drafts: unknown) => `# Entwürfe

## Lead
> Moin

\`\`\`json
${JSON.stringify({ drafts }, null, 2)}
\`\`\`
`

// ---- 1. Drift-Wache: Runner-Parser == Cockpit-Parser ----
{
  const faelle: Array<[string, string]> = [
    ['leer', ''],
    ['kein json-Block', '# Nur Markdown\n\nkein Block'],
    ['kaputtes json', '```json\n{ das ist kein json\n```'],
    ['drafts fehlt', runMd(undefined)],
    ['drafts kein Array', '```json\n{"drafts": "nope"}\n```'],
    ['leeres Array', runMd([])],
    [
      'voller Satz',
      runMd([
        { thread_key: 'k1', contact_id: null, name: 'Anna', channel: 'linkedin', message: 'Moin Anna' },
        { thread_key: 'k2', contact_id: 'c-2', name: 'Bert', channel: 'linkedin', message: 'Moin Bert' },
      ]),
    ],
    ['ohne message', runMd([{ thread_key: 'k1', name: 'Anna', channel: 'linkedin', message: '' }])],
    ['ohne thread_key', runMd([{ contact_id: 'c-1', name: 'Anna', channel: 'linkedin', message: 'Moin' }])],
    ['Müll im Array', runMd([null, 42, 'text', { message: 'ok', thread_key: 'k9' }])],
    [
      'zwei Blöcke, letzter zählt',
      '```json\n{"drafts":[{"thread_key":"alt","message":"alt"}]}\n```\n\n' +
        '```json\n{"drafts":[{"thread_key":"neu","message":"neu"}]}\n```',
    ],
  ]

  let abweichungen = 0
  for (const [label, md] of faelle) {
    const cockpit = parseDrafts(md).map((d) => ({ thread_key: d.thread_key ?? null, message: d.message }))
    const runner = parseDraftsRoh(md).map((d: { thread_key: string | null; message: string }) => ({
      thread_key: d.thread_key,
      message: d.message,
    }))
    if (JSON.stringify(cockpit) !== JSON.stringify(runner)) {
      abweichungen++
      console.error(`  Drift bei "${label}": Cockpit ${JSON.stringify(cockpit)} vs Runner ${JSON.stringify(runner)}`)
    }
  }
  check(`1 Drift-Wache über ${faelle.length} Eingaben`, abweichungen, 0)
}

// ---- 2. Runner-Parser im Detail ----
{
  const d = parseDraftsRoh(
    runMd([
      { thread_key: '  k1  ', contact_id: null, name: ' Anna ', channel: 'linkedin', message: '  Moin Anna  ' },
    ]),
  )
  check('2 getrimmt', d[0].thread_key, 'k1')
  check('2b Name getrimmt', d[0].name, 'Anna')
  check('2c Nachricht getrimmt', d[0].message, 'Moin Anna')
  check(
    '2d fehlender thread_key wird null, nicht verworfen',
    parseDraftsRoh(runMd([{ name: 'X', message: 'Moin' }]))[0].thread_key,
    null,
  )
}

// ---- 3. Entwurf landet am richtigen Posten ----
{
  const posten = antwortPosten(
    [
      thread({ name: 'Mit Entwurf', entwurf: 'Moin Anna, …', entwurf_at: stundenHer(6) }),
      thread({ name: 'Ohne Entwurf' }),
    ],
    NOW,
  )
  const mit = posten.find((p) => p.name === 'Mit Entwurf')
  const ohne = posten.find((p) => p.name === 'Ohne Entwurf')
  check('3 Entwurf am Posten', mit?.entwurf?.text, 'Moin Anna, …')
  check('3b nicht veraltet', mit?.entwurf?.veraltet, false)
  check('3c ohne Entwurf bleibt leer', ohne?.entwurf, undefined)
  // Der Kontext-Text bleibt die Nachricht des Leads — der Entwurf ersetzt ihn nicht.
  check('3d text bleibt Kontext', mit?.text, 'Klingt spannend')
  check('3e Profil-Link steht am Posten', mit?.website, 'https://www.linkedin.com/in/lead')
}

// 4. Veralterung: der Lead hat nach dem Entwurf erneut geschrieben.
{
  const p = antwortPosten(
    [thread({ entwurf: 'Alt', entwurf_at: tageHer(3), last_message_at: tageHer(1) })],
    NOW,
  )
  check('4 Entwurf veraltet', p[0].entwurf?.veraltet, true)
  check('4b Text bleibt trotzdem da', p[0].entwurf?.text, 'Alt')
}

// 5. Leerer/whitespace-Entwurf zählt nicht als Entwurf.
{
  const p = antwortPosten([thread({ entwurf: '   ', entwurf_at: stundenHer(2) })], NOW)
  check('5 leerer Entwurf ignoriert', p[0].entwurf, undefined)
  // Spalte 0065 fehlt (Migration nicht gepusht) → kein Entwurf, kein Absturz.
  const q = antwortPosten([thread({ entwurf: undefined, entwurf_at: undefined })], NOW)
  check('5b fehlende Spalte', q[0].entwurf, undefined)
}

// 6. Follow-up-Posten tragen den Entwurf ebenfalls (Kevins Vorgabe: antwort UND followup).
{
  const p = followupPosten(
    [
      thread({
        last_from: 'me',
        last_message_at: tageHer(5),
        followup_stage: 0,
        entwurf: 'Follow-up-Text',
        entwurf_at: stundenHer(3),
      }),
    ],
    NOW,
  )
  check('6 Entwurf am Follow-up-Posten', p[0].entwurf?.text, 'Follow-up-Text')
  // Kevin war zuletzt dran → kein „veraltet", obwohl last_message_at älter ist.
  check('6b nicht veraltet', p[0].entwurf?.veraltet, false)
}

// 7. Textstand am Posten — „von gestern" trägt mehr als ein Zeitstempel.
{
  check('7 gerade eben', entwurfStand(stundenHer(0), NOW), 'gerade eben')
  check('7b vor 5 h', entwurfStand(stundenHer(5), NOW), 'vor 5 h')
  check('7c von heute Nacht', entwurfStand(stundenHer(14), NOW), 'von heute Nacht')
  check('7d von gestern', entwurfStand(tageHer(1), NOW), 'von gestern')
  check('7e vor 3 Tagen', entwurfStand(tageHer(3), NOW), 'vor 3 Tagen')
  check('7f ohne Zeitstempel', entwurfStand(null, NOW), 'vorbereitet')
  check('7g kaputter Zeitstempel', entwurfStand('quatsch', NOW), 'vorbereitet')
}

// 8. O2-Grenze: Die Freigaben-Queue zieht nur Kunden/Deals, nie den LinkedIn-Funnel.
//    Drift-Wache für die Entscheidung vom 06.08.2026 — fällt sie, verschickt die
//    Queue wieder echte E-Mails an kalte first_contact-Leads.
{
  const kontakt = (over: Partial<Contact>): Contact =>
    ({
      id: `c-${over.name ?? 'x'}`,
      brand_id: 'b1',
      name: 'Kontakt',
      email: 'a@b.de',
      pipeline_stage: 'first_contact',
      next_follow_up_at: null,
      ...over,
    }) as Contact

  // `dueFollowupContacts` liest die echte Uhr — die Grenzen liegen deshalb
  // bewusst weit weg vom Testdatum NOW, sonst kippt der Test mit dem Kalender.
  const faellig = '2020-01-01T00:00:00.000Z'
  const spaeter = '2099-01-01T00:00:00.000Z'
  const namen = (cs: Contact[]) => dueFollowupContacts(cs).map((c) => c.name)

  check(
    '8 first_contact mit fälligem Datum bleibt draußen',
    namen([kontakt({ name: 'Kalt', pipeline_stage: 'first_contact', next_follow_up_at: faellig })]),
    [],
  )
  check(
    '8b conversation/proposal/deal kommen durch',
    namen([
      kontakt({ name: 'Gespräch', pipeline_stage: 'conversation', next_follow_up_at: faellig }),
      kontakt({ name: 'Angebot', pipeline_stage: 'proposal', next_follow_up_at: faellig }),
      kontakt({ name: 'Kunde', pipeline_stage: 'deal', next_follow_up_at: faellig }),
    ]),
    ['Gespräch', 'Angebot', 'Kunde'],
  )
  check(
    '8c Stage follow_up zählt auch ohne Datum',
    namen([kontakt({ name: 'FU', pipeline_stage: 'follow_up' })]),
    ['FU'],
  )
  check(
    '8d paused bleibt still',
    namen([kontakt({ name: 'Pause', pipeline_stage: 'paused', next_follow_up_at: faellig })]),
    [],
  )
  check(
    '8e Zukunfts-Datum ist nicht fällig',
    namen([
      kontakt({ name: 'Später', pipeline_stage: 'conversation', next_follow_up_at: spaeter }),
    ]),
    [],
  )
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
