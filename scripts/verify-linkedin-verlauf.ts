/**
 * Verifikation für Etappe 3, Schritt 1 (docs/IDEEN-2026-07-30-nutzbarkeit.md):
 * Gesprächsverlauf aus dem Voyager-included-Array.
 *
 * Geprüft wird beides an einem Stück, weil es dieselbe Kette ist:
 *  - `verlaufAusMessages` (runner/linkedin/verlauf.mjs) — läuft im Seitenkontext,
 *    wird dort per .toString() injiziert; hier gegen Fixtures.
 *  - `verlaufVon` / `verlaufAlsText` (app/src/cockpit/lib/linkedinVerlauf.ts) —
 *    die Leseseite, die eine fehlende Spalte überstehen muss.
 *
 * Start: npx tsx scripts/verify-linkedin-verlauf.ts
 */
// @ts-expect-error — bewusst dieselbe .mjs, die der Runner in die Seite injiziert (kein Typ-Zwilling).
import { verlaufAusMessages } from '../runner/linkedin/verlauf.mjs'
import { verlaufAlsText, verlaufVon } from '../app/src/cockpit/lib/linkedinVerlauf'
import type { LinkedinThread } from '../app/src/types/db'

const CONV = 'urn:li:msg_conversation:(A,42)'
const ANDERE_CONV = 'urn:li:msg_conversation:(A,99)'
const ICH = 'urn:li:msg_participant:me'
const LEAD = 'urn:li:msg_participant:lead'
const isSelf = (urn: string) => urn === ICH

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

function msg(over: Record<string, unknown>): Record<string, unknown> {
  return {
    '*conversation': CONV,
    '*sender': LEAD,
    deliveredAt: 1_753_000_000_000,
    body: { text: 'Text' },
    ...over,
  }
}

// 1. Chronologisch, nicht in Array-Reihenfolge — die included-Liste ist unsortiert.
{
  const v = verlaufAusMessages(
    [
      msg({ deliveredAt: 3000, body: { text: 'dritte' } }),
      msg({ deliveredAt: 1000, body: { text: 'erste' } }),
      msg({ deliveredAt: 2000, body: { text: 'zweite' } }),
    ],
    CONV,
    isSelf,
  )
  check('1 chronologisch', v.map((e: { text: string }) => e.text), ['erste', 'zweite', 'dritte'])
}

// 2. Nur Nachrichten DIESER Konversation — eine Seite trägt alle Threads gemischt.
{
  const v = verlaufAusMessages(
    [
      msg({ deliveredAt: 1000, body: { text: 'meine' } }),
      msg({ '*conversation': ANDERE_CONV, deliveredAt: 2000, body: { text: 'fremde' } }),
    ],
    CONV,
    isSelf,
  )
  check('2 fremder Thread bleibt draußen', v.map((e: { text: string }) => e.text), ['meine'])
}

// 3. Absender: me / them / unknown — ohne *sender wird nicht geraten.
{
  const v = verlaufAusMessages(
    [
      msg({ deliveredAt: 1000, '*sender': ICH }),
      msg({ deliveredAt: 2000, '*sender': LEAD }),
      msg({ deliveredAt: 3000, '*sender': undefined }),
    ],
    CONV,
    isSelf,
  )
  check('3 sender-Zuordnung', v.map((e: { sender: string }) => e.sender), ['me', 'them', 'unknown'])
}

// 4. Deckel: die NEUESTEN 10, nicht die ersten 10.
{
  const viele = Array.from({ length: 14 }, (_, i) =>
    msg({ deliveredAt: 1000 + i, body: { text: `n${i}` } }),
  )
  const v = verlaufAusMessages(viele, CONV, isSelf)
  check('4 Deckel bei 10', v.length, 10)
  check('4b neueste behalten', v[9].text, 'n13')
  check('4c älteste abgeschnitten', v[0].text, 'n4')
}

// 5. Textlose Einträge (Anhänge, Reaktionen) fliegen raus statt als Leerzeile zu erscheinen.
{
  const v = verlaufAusMessages(
    [
      msg({ deliveredAt: 1000, body: { text: '   ' } }),
      msg({ deliveredAt: 2000, body: {} }),
      msg({ deliveredAt: 3000, body: { text: 'echt' } }),
    ],
    CONV,
    isSelf,
  )
  check('5 nur Einträge mit Text', v.map((e: { text: string }) => e.text), ['echt'])
}

// 6. Zeitstempel: ISO oder null — ein kaputter Wert darf nicht werfen.
{
  const v = verlaufAusMessages(
    [
      msg({ deliveredAt: 1_753_000_000_000, body: { text: 'gut' } }),
      msg({ deliveredAt: 0, body: { text: 'null-stempel' } }),
      msg({ deliveredAt: 'kaputt', body: { text: 'text-stempel' } }),
    ],
    CONV,
    isSelf,
  )
  check('6 ISO-Zeitstempel', v.find((e: { text: string }) => e.text === 'gut')?.ts, '2025-07-20T08:26:40.000Z')
  check('6b unbrauchbarer Zeitstempel → null', v.filter((e: { ts: string | null }) => e.ts === null).length, 2)
}

// 7. Langer Text wird gekappt, nicht die ganze Zeile verworfen.
{
  const v = verlaufAusMessages([msg({ body: { text: 'x'.repeat(3000) } })], CONV, isSelf, 10, 2000)
  check('7 Textdeckel', v[0].text.length, 2002) // 2000 + ' …'
}

// 8. Leere Eingabe bleibt ein leeres Array (Thread ohne Nachricht im included-Array).
{
  check('8 keine Nachrichten', verlaufAusMessages([], CONV, isSelf), [])
  check('8b null-Eingabe', verlaufAusMessages(null, CONV, isSelf), [])
}

// ---- Leseseite: fehlende Spalte, Müll-Einträge, Textform ----

const thread = (over: Partial<LinkedinThread>): LinkedinThread =>
  ({
    id: 't1',
    brand_id: 'b1',
    thread_key: 'k1',
    contact_id: null,
    name: 'Anna Bauer',
    company: 'Bauer Immobilien',
    profile_url: '',
    preview: 'Klingt gut, schick mal rüber',
    last_message_at: '2026-08-01T10:00:00.000Z',
    last_from: 'them',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active',
    first_seen_at: '2026-07-01T10:00:00.000Z',
    last_synced_at: '2026-08-01T10:00:00.000Z',
    loom_status: 'offen',
    loom_erledigt_at: null,
    ...over,
  }) as LinkedinThread

// 9. Spalte fehlt (Migration 0064 nicht gepusht) → leer, kein Absturz.
{
  check('9 fehlende Spalte', verlaufVon(thread({ verlauf: undefined })), [])
  check(
    '9b Rückfall auf preview',
    verlaufAlsText(thread({ verlauf: undefined })),
    'Anna Bauer: Klingt gut, schick mal rüber',
  )
}

// 10. Fremdformat wird gefiltert statt durchgereicht.
{
  const kaputt = verlaufVon(
    thread({
      verlauf: [
        null,
        { text: '' },
        { sender: 'quatsch', text: 'ohne gültigen Absender', ts: 5 },
        { sender: 'me', text: 'sauber', ts: '2026-08-01T09:00:00.000Z' },
      ],
    } as unknown as Partial<LinkedinThread>),
  )
  check('10 nur brauchbare Einträge', kaputt.length, 2)
  check('10b unbekannter Absender', kaputt[0].sender, 'unknown')
  check('10c Zahl als ts → null', kaputt[0].ts, null)
}

// 11. Textform: Kevin vs. Name des Gegenübers, älteste Zeile zuerst.
{
  const t = verlaufAlsText(
    thread({
      verlauf: [
        { sender: 'me', text: 'Moin Anna, kurze Frage', ts: null },
        { sender: 'them', text: 'Klingt gut, schick mal rüber', ts: null },
      ],
    }),
  )
  check('11 Verlaufstext', t, 'Kevin: Moin Anna, kurze Frage\nAnna Bauer: Klingt gut, schick mal rüber')
}

// 12. Weder Verlauf noch preview → leerer String (der Agent bekommt kein Phantom).
{
  check('12 nichts bekannt', verlaufAlsText(thread({ verlauf: [], preview: '' })), '')
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
