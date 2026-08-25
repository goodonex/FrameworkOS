/**
 * Drift-Wache für die Auswahl des Follow-up-Entwürfe-Agenten (25.08.2026).
 *
 * `istFaellig` (Runner, .mjs) muss über eine volle Fall-Matrix hinweg exakt
 * dasselbe sagen wie `isDue` / `bucketOf(...) === 'faellig'` (Cockpit, .ts).
 * Der Runner braucht die Regel morgens ohne Cockpit — dass es zwei Fassungen
 * gibt, ist nur tragbar, solange dieses Skript sie zusammenhält.
 *
 * Warum das eng geführt gehört: Sagt der Runner „fällig", wo das Cockpit
 * „wartet" sagt, hängt der Entwurf an einem Namen, der gar nicht in Kevins
 * Arbeitsliste steht. Sagt er „nicht fällig", wo das Cockpit „fällig" sagt,
 * steht der Posten ohne Text da — und genau daran ist der Nachfass-Trichter
 * bis zum 25.08. gestorben (177 fällige Threads, 0 Entwürfe).
 *
 * Start: npx tsx scripts/verify-followup-entwuerfe.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { FOLLOWUP_MAX, baueFollowupInput, istFaellig } from '../runner/linkedin/followupThreads.mjs'
import { FOLLOWUP_THRESHOLDS_DAYS, bucketOf, isDue } from '../app/src/cockpit/lib/linkedinFollowups'
import type { LinkedinLastFrom, LinkedinThread, LinkedinThreadStatus } from '../app/src/types/db'

const NOW = new Date('2026-08-25T09:00:00Z')
const tageHer = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
const inTagen = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString()

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++
  else {
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
    company: 'Immobilienmakler',
    profile_url: 'https://www.linkedin.com/in/lead',
    preview: 'Moin, melde mich nochmal',
    last_message_at: tageHer(5),
    last_from: 'me',
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
  } as LinkedinThread
}

/* ── 1. Drift-Wache: Runner-Regel == isDue über die volle Matrix ────────── */
{
  const stati: LinkedinThreadStatus[] = ['active', 'waiting_reply', 'won', 'lost', 'archived']
  const absender: LinkedinLastFrom[] = ['me', 'them', 'unknown']
  const stufen = [0, 1, 2, 3]
  const alter = [0, 1, 3, 4, 7, 8, 14, 15, 60]
  const schlummer = [null, inTagen(2), tageHer(2)]

  let faelle = 0
  for (const status of stati) {
    for (const last_from of absender) {
      for (const followup_stage of stufen) {
        for (const tage of alter) {
          for (const snoozed_until of schlummer) {
            const t = thread({ status, last_from, followup_stage, last_message_at: tageHer(tage), snoozed_until })
            faelle++
            const runner = istFaellig(t, NOW)
            const cockpit = isDue(t, NOW)
            if (runner !== cockpit) {
              check(
                `Drift bei status=${status} from=${last_from} stufe=${followup_stage} tage=${tage} snooze=${String(snoozed_until).slice(0, 10)}`,
                runner,
                cockpit,
              )
            } else pass++
            // Und die Bucket-Sicht muss dieselbe Aussage stützen.
            if (runner) check(`fällig ⇒ Bucket faellig (${status}/${last_from}/${followup_stage}/${tage}d)`, bucketOf(t, NOW), 'faellig')
          }
        }
      }
    }
  }
  console.log(`Drift-Matrix: ${faelle} Kombinationen geprüft`)
}

/* ── 2. Fehlendes Datum ist kein Absturz ───────────────────────────────── */
{
  const ohne = thread({ last_message_at: null })
  check('ohne last_message_at nicht fällig', istFaellig(ohne, NOW), false)
  check('… und das Cockpit sagt dasselbe', isDue(ohne, NOW), false)
}

/* ── 3. Die Schwellen sind dieselben Zahlen ────────────────────────────── */
{
  FOLLOWUP_THRESHOLDS_DAYS.forEach((schwelle, stufe) => {
    const knapp = thread({ followup_stage: stufe, last_message_at: tageHer(schwelle - 1) })
    const genau = thread({ followup_stage: stufe, last_message_at: tageHer(schwelle) })
    check(`Stufe ${stufe}: ${schwelle - 1} Tage noch nicht fällig`, istFaellig(knapp, NOW), false)
    check(`Stufe ${stufe}: ${schwelle} Tage fällig`, istFaellig(genau, NOW), true)
  })
}

/* ── 4. Die Eingabe: Deckel, Reihenfolge, Pflichtfelder ────────────────── */
{
  const viele = Array.from({ length: FOLLOWUP_MAX + 7 }, (_, i) =>
    thread({ followup_stage: 0, last_message_at: tageHer(10 + i) }),
  )
  const gebaut = baueFollowupInput(viele, NOW)
  check('Deckel greift', gebaut.input.threads.length, FOLLOWUP_MAX)
  check('der Rest wird gezählt, nicht verschwiegen', gebaut.weitereWarten, 7)

  // Ohne thread_key verwirft `schreibeEntwuerfe` den Entwurf still — die
  // Zuordnung läuft ausschliesslich über diesen Schlüssel.
  check(
    'jeder Thread trägt einen thread_key',
    gebaut.input.threads.every((t: { thread_key?: string }) => Boolean(t.thread_key)),
    true,
  )
  check(
    'jeder Thread trägt einen Namen (sonst „Unbekannter Kontakt")',
    gebaut.input.threads.every((t: { name?: string }) => Boolean(t.name)),
    true,
  )
}

{
  // Sortierung: Stern zuerst, dann der am längsten Liegende (beide aus der
  // Makler-Ära, also entscheidet allein das Alter).
  const alt = thread({ name: 'Alt', last_message_at: tageHer(40) })
  const neu = thread({ name: 'Neu', last_message_at: tageHer(5) })
  const stern = thread({ name: 'Stern', last_message_at: tageHer(6), starred: true })
  const gebaut = baueFollowupInput([neu, alt, stern], NOW)
  check(
    'Stern zuerst, dann der Älteste',
    gebaut.input.threads.map((t: { name: string }) => t.name),
    ['Stern', 'Alt', 'Neu'],
  )
}

{
  /* Der Befund aus dem Trockenlauf vom 25.08.: Bei reinem „ältester zuerst"
   * belegten Altlasten von 539 Tagen („Vertriebs-Champion", „salesHAX
   * Consulting") die ersten Entwürfe des Tages, und die echten Makler dahinter
   * kamen wieder nicht dran. Die Altlast fällt NICHT weg — Kevins Regel gilt —,
   * sie rutscht nur ans Ende. */
  const altlast = thread({ name: 'Altlast 539', last_message_at: tageHer(539) })
  const altlast2 = thread({ name: 'Altlast 300', last_message_at: tageHer(300) })
  const makler = thread({ name: 'Makler 41', last_message_at: tageHer(41) })
  const maklerJung = thread({ name: 'Makler 5', last_message_at: tageHer(5) })
  const gebaut = baueFollowupInput([altlast, maklerJung, altlast2, makler], NOW)
  check(
    'Makler-Ära vor Altlast, innerhalb der Gruppe der Älteste zuerst',
    gebaut.input.threads.map((t: { name: string }) => t.name),
    ['Makler 41', 'Makler 5', 'Altlast 539', 'Altlast 300'],
  )
  check('nichts fällt weg — die Altlast bleibt im Vorrat', gebaut.input.threads.length, 4)
}

{
  // Der Stern sticht auch die Ära: Kevins eigene Markierung ist das stärkste Signal.
  const sternAltlast = thread({ name: 'Stern alt', last_message_at: tageHer(400), starred: true })
  const makler = thread({ name: 'Makler', last_message_at: tageHer(30) })
  const gebaut = baueFollowupInput([makler, sternAltlast], NOW)
  check(
    'ein markierter Alt-Thread bleibt vorne',
    gebaut.input.threads.map((t: { name: string }) => t.name),
    ['Stern alt', 'Makler'],
  )
}

{
  // Der Grund, warum der Rückstau bis zum 14.08. nie abgetragen wurde: Wer
  // schon einen frischen Entwurf hat, darf den Lauf nicht erneut belegen.
  const frisch = thread({ last_message_at: tageHer(10), entwurf: 'Moin …', entwurf_at: tageHer(1) } as Partial<LinkedinThread>)
  const veraltet = thread({ last_message_at: tageHer(2), entwurf: 'Alt …', entwurf_at: tageHer(9) } as Partial<LinkedinThread>)
  const leer = thread({ last_message_at: tageHer(10) })
  const gebaut = baueFollowupInput([frisch, veraltet, leer], NOW)
  check('frisch Entworfene blockieren den Lauf nicht', gebaut.input.threads.length, 1)
  check('… und zwar bleibt der ohne Entwurf übrig', gebaut.input.threads[0].thread_key, leer.thread_key)
}

{
  // Stufe 3 ist die laute Kette (0078), nicht mehr LinkedIn — der Agent darf
  // dafür keinen Text mehr schreiben.
  const durch = thread({ followup_stage: 3, last_message_at: tageHer(60) })
  check('Stufe 3 wird nicht mehr entworfen', istFaellig(durch, NOW), false)
  check('… und steht im Bucket abschluss', bucketOf(durch, NOW), 'abschluss')
  check('… und kommt in keinen Lauf', baueFollowupInput([durch], NOW).input.threads.length, 0)
}

console.log(`\nverify-followup-entwuerfe: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
