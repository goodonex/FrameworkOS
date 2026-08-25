/**
 * Drift-Wache für die Rechenschicht des Sales-Canvas (25.08.2026).
 *
 * Die eine Invariante, an der alles hängt: **jeder Lead liegt auf genau einer
 * Karte.** Bricht sie, ist die Summe größer als der Bestand, und Kevin sieht
 * einen Berg, den es nicht gibt — oder er arbeitet denselben Menschen zweimal
 * an. Die zweite: `soll` und `erledigtHeute` werden durchgereicht, nicht
 * nachgerechnet.
 *
 * Start: npx tsx scripts/verify-funnel-karten.ts
 */
import type { LeadEreignisTyp } from '../app/src/types/db'
import {
  FUNNEL_BAUPLAN,
  funnelKarten,
  kartenIdFuer,
  type FunnelEingabe,
  type FunnelKartenId,
  type FunnelLead,
  type FunnelThread,
} from '../app/src/cockpit/lib/funnelKarten'
import { FOLLOWUP_VORLAGEN } from '../app/src/cockpit/lib/followupVorlagen'
import { TAGES_FLOW, stufenStaende } from '../app/src/cockpit/lib/tagesFlow'

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
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * 86_400_000).toISOString()

/** Eine Headline, die der ICP-Filter sicher durchlässt. */
const MAKLER = 'Immobilienmakler in Hamburg'

let laufendeNummer = 0
function lead(teil: Partial<FunnelLead> = {}): FunnelLead {
  laufendeNummer++
  return {
    id: `l${laufendeNummer}`,
    name: 'Max Mustermann',
    headline: MAKLER,
    lead_status: 'aktiv',
    wiedervorlage_am: null,
    ereignisse: [],
    thread: null,
    ...teil,
  }
}

function thread(teil: Partial<FunnelThread> = {}): FunnelThread {
  return {
    status: 'active',
    last_from: 'me',
    last_message_at: vorTagen(1),
    followup_stage: 0,
    snoozed_until: null,
    starred: false,
    loom_status: null,
    ...teil,
  }
}

function ereignis(typ: LeadEreignisTyp, tageHer: number) {
  return { typ, at: vorTagen(tageHer) }
}

/** Echte Stände aus `stufenStaende` — keine handgeschnitzten Zahlen. */
function staende(faelligHeute = 8) {
  return stufenStaende({
    today: { li_anfragen: 12, li_nachrichten: 3, li_followups: 5, inmails: 1, looms: 0 },
    faelligHeute,
    erstnachrichtenOffen: 7,
    loomsOffen: 2,
    antworten: { warten: 43, aeltesteStunden: 30 },
  })
}

function eingabe(leads: FunnelLead[], faelligHeute = 8): FunnelEingabe {
  return { leads, staende: staende(faelligHeute), jetzt: JETZT }
}

/* ── Die Invariante ────────────────────────────────────────────────────── */

{
  // Ein Querschnitt durch alle Äste: angenommen/nicht angenommen, Follow-ups
  // in allen drei Stufen, laute und stille Kette, Endstationen, Aussortierte.
  const leads: FunnelLead[] = [
    lead({ ereignisse: [ereignis('anfrage', 3)] }),
    lead({ ereignisse: [ereignis('anfrage', 40)] }),
    lead({ ereignisse: [ereignis('anfrage', 40), ereignis('angenommen', 35)] }),
    lead({
      ereignisse: [ereignis('angenommen', 20), ereignis('erstnachricht', 10)],
      thread: thread({ followup_stage: 0, last_message_at: vorTagen(10) }),
    }),
    lead({
      ereignisse: [ereignis('angenommen', 20), ereignis('followup', 10)],
      thread: thread({ followup_stage: 1, last_message_at: vorTagen(10) }),
    }),
    lead({
      ereignisse: [ereignis('angenommen', 30), ereignis('followup', 20)],
      thread: thread({ followup_stage: 2, last_message_at: vorTagen(20) }),
    }),
    lead({ ereignisse: [ereignis('angenommen', 5)], thread: thread({ last_message_at: vorTagen(1) }) }),
    lead({ ereignisse: [ereignis('angenommen', 5)], thread: thread({ last_from: 'them' }) }),
    lead({
      ereignisse: [ereignis('angenommen', 5)],
      thread: thread({ starred: true, loom_status: 'offen' }),
    }),
    lead({
      ereignisse: [ereignis('angenommen', 60), ereignis('instagram', 30)],
      thread: thread({ followup_stage: 3, last_message_at: vorTagen(40) }),
    }),
    lead({
      ereignisse: [ereignis('angenommen', 90), ereignis('pdf', 30)],
      thread: thread({ followup_stage: 3, last_message_at: vorTagen(80) }),
    }),
    lead({ ereignisse: [ereignis('anfrage', 60), ereignis('email', 20)] }),
    lead({ ereignisse: [ereignis('anfrage', 90), ereignis('email', 40), ereignis('postkarte', 20)] }),
    lead({ lead_status: 'wiedervorlage', wiedervorlage_am: '2026-09-01' }),
    lead({ lead_status: 'kunde' }),
    lead({ lead_status: 'disqualifiziert' }),
    lead({ headline: 'Recruiter für Vertriebstalente' }),
    lead({ headline: 'Business Coach für mehr Umsatz' }),
  ]
  const karten = funnelKarten(eingabe(leads))
  const summe = karten.reduce((n, k) => n + k.bestand, 0)

  check('Summe der Bestände = Zahl der Leads', summe === leads.length, `${summe} statt ${leads.length}`)
  check(
    'jeder Lead landet auf genau einer Karte',
    leads.every((l) => FUNNEL_BAUPLAN.some((b) => b.id === kartenIdFuer(l, JETZT))),
  )
  check(
    'die drei Follow-up-Stufen landen auf drei verschiedenen Karten',
    karten.find((k) => k.id === 'followup_0')?.bestand === 1 &&
      karten.find((k) => k.id === 'followup_1')?.bestand === 1 &&
      karten.find((k) => k.id === 'followup_2')?.bestand === 1,
    JSON.stringify(karten.filter((k) => k.id.startsWith('followup')).map((k) => [k.id, k.bestand])),
  )
  check(
    'DIE DOPPELZÄHLUNG: ein fälliges Follow-up steht NICHT zusätzlich in „Erstnachricht fällig"',
    karten.find((k) => k.id === 'erstnachricht_faellig')?.bestand === 1,
    `erstnachricht_faellig: ${karten.find((k) => k.id === 'erstnachricht_faellig')?.bestand}`,
  )
  check(
    'Aussortierte landen sichtbar auf „Nicht in der Zielgruppe", nicht im Nichts',
    karten.find((k) => k.id === 'ausserhalb')?.bestand === 2,
    `ausserhalb: ${karten.find((k) => k.id === 'ausserhalb')?.bestand}`,
  )
  check(
    'heuteFaellig übersteigt nie den Bestand derselben Karte',
    karten.every((k) => k.heuteFaellig <= k.bestand),
  )
  check(
    'Aussortierte sind nie „heute dran"',
    (karten.find((k) => k.id === 'ausserhalb')?.heuteFaellig ?? -1) === 0,
  )
}

/* ── Eine Zähl-Wahrheit, drei Anzeigen ─────────────────────────────────── */

{
  const karten = funnelKarten(eingabe([]))
  const followups = karten.filter((k) => k.id.startsWith('followup_'))
  check('es gibt genau drei Follow-up-Karten', followups.length === 3)
  check(
    'alle drei tragen dieselbe stufenId',
    followups.every((k) => k.stufenId === 'followups'),
    JSON.stringify(followups.map((k) => k.stufenId)),
  )
  check(
    'und damit dasselbe Soll und denselben Tagesstand',
    new Set(followups.map((k) => `${k.soll}/${k.erledigtHeute}`)).size === 1,
    JSON.stringify(followups.map((k) => `${k.soll}/${k.erledigtHeute}`)),
  )
}

/* ── Soll und Erledigt werden gelesen, nicht gerechnet ─────────────────── */

{
  const st = staende()
  const karten = funnelKarten(eingabe([]))
  for (const stufe of TAGES_FLOW) {
    const karte = karten.find((k) => k.stufenId === stufe.id)
    if (!karte) continue
    const quelle = st.find((s) => s.stufe.id === stufe.id)
    if (stufe.art === 'frische') {
      check(`${stufe.id}: Frische-Stufe bekommt kein Soll`, karte.soll === null && karte.erledigtHeute === null)
    } else {
      check(
        `${stufe.id}: Soll und Erledigt stammen unverändert aus stufenStaende`,
        karte.soll === quelle?.soll && karte.erledigtHeute === quelle?.wert,
        `Karte ${karte.soll}/${karte.erledigtHeute} vs. Stand ${quelle?.soll}/${quelle?.wert}`,
      )
    }
  }
  check(
    'die InMail-Welle hat bewusst keine Karte — sie ist ein Nebenstrom, keine Station',
    karten.every((k) => k.stufenId !== 'reaktivierung'),
  )
}

/* ── Die Textbausteine ─────────────────────────────────────────────────── */

{
  const karten = funnelKarten(eingabe([]))
  const mitVorlage = karten.filter((k) => k.vorlage !== null)
  check('genau die drei Follow-up-Karten tragen einen Text', mitVorlage.length === 3)
  check(
    'jeder Text hat den Platzhalter [Vorname] noch drin',
    mitVorlage.every((k) => k.vorlage!.includes('[Vorname]')),
  )
  check(
    'und es ist der Text der richtigen Stufe',
    karten.find((k) => k.id === 'followup_0')?.vorlage === FOLLOWUP_VORLAGEN[0] &&
      karten.find((k) => k.id === 'followup_1')?.vorlage === FOLLOWUP_VORLAGEN[1] &&
      karten.find((k) => k.id === 'followup_2')?.vorlage === FOLLOWUP_VORLAGEN[2],
  )
}

/* ── Der Zweig entscheidet den Text ────────────────────────────────────── */

{
  // Beide haben eine Postkarte bekommen — der eine nach der Analyse (laut),
  // der andere ohne je angenommen zu haben (still). Dieselbe Station, zwei Karten.
  const lauter = lead({
    ereignisse: [ereignis('angenommen', 120), ereignis('pdf', 40), ereignis('postkarte', 25)],
    thread: thread({ followup_stage: 3, last_message_at: vorTagen(110) }),
  })
  const stiller = lead({ ereignisse: [ereignis('anfrage', 90), ereignis('email', 40), ereignis('postkarte', 25)] })
  check('laute Kette: Anruf mit Karte als Aufhänger', kartenIdFuer(lauter, JETZT) === 'anruf_laut', kartenIdFuer(lauter, JETZT))
  check('stille Kette: Anruf bei jemandem, der Kevin nicht kennt', kartenIdFuer(stiller, JETZT) === 'anruf_still', kartenIdFuer(stiller, JETZT))
  check(
    'die beiden Karten tragen den Zweig, aus dem sie kommen',
    FUNNEL_BAUPLAN.find((b) => b.id === 'anruf_laut')?.zweig === 'laut' &&
      FUNNEL_BAUPLAN.find((b) => b.id === 'anruf_still')?.zweig === 'still',
  )
}

/* ── Reihenfolge: Kevins Ritual zuerst ─────────────────────────────────── */

{
  const karten = funnelKarten(eingabe([]))
  const mitStufe = karten.filter((k) => k.stufenId !== null).map((k) => k.stufenId)
  const erwartet = TAGES_FLOW.map((s) => s.id).filter((id) => mitStufe.includes(id))
  // Die drei Follow-up-Karten stehen hintereinander, deshalb entdoppelt.
  const ohneWiederholung = mitStufe.filter((id, i) => id !== mitStufe[i - 1])
  check(
    'die Karten mit Tagesbezug stehen in der Reihenfolge von TAGES_FLOW',
    ohneWiederholung.join('>') === erwartet.join('>'),
    `${ohneWiederholung.join('>')} statt ${erwartet.join('>')}`,
  )
  check(
    'und sie stehen vor dem Bestand ohne Tagesbezug',
    karten.findIndex((k) => k.stufenId === null) > karten.findLastIndex((k) => k.stufenId !== null),
  )
}

/* ── Randfälle ────────────────────────────────────────────────────────── */

{
  const karten = funnelKarten({ leads: [], staende: [], jetzt: JETZT })
  check('leere Eingabe stürzt nicht ab', karten.length === FUNNEL_BAUPLAN.length)
  check('und liefert überall 0 statt NaN', karten.every((k) => k.bestand === 0 && k.heuteFaellig === 0))
  check('ohne Stände gibt es kein erfundenes Soll', karten.every((k) => k.soll === null))
}

{
  const ids = FUNNEL_BAUPLAN.map((b) => b.id)
  check('jede Karten-Id kommt genau einmal vor', new Set(ids).size === ids.length)
  const karten = funnelKarten(eingabe([]))
  check('jede Karte hat einen Titel', karten.every((k) => k.titel.trim().length > 0))
}

{
  const nackt = lead({ ereignisse: [], thread: null })
  check('ein Lead ohne Ereignisse und ohne Thread stürzt nicht ab', kartenIdFuer(nackt, JETZT) === 'anfrage_offen')
}

{
  const kaputt = lead({
    ereignisse: [ereignis('angenommen', 20)],
    // followup_stage jenseits der drei Vorlagen: darf nicht lautlos verschwinden.
    thread: thread({ followup_stage: 7 as unknown as FunnelThread['followup_stage'], last_message_at: vorTagen(30) }),
  })
  const id = kartenIdFuer(kaputt, JETZT)
  check('eine unplausible Follow-up-Stufe landet sichtbar, nicht im Nichts', FUNNEL_BAUPLAN.some((b) => b.id === id), id)
}

{
  // Ein Thread von vor der Makler-Akquise, in dem die Gegenseite zuletzt schrieb.
  const alt = lead({ thread: thread({ last_from: 'them', last_message_at: '2025-04-01T10:00:00.000Z' }) })
  check('Post von vor der Akquise zählt nicht als Arbeitsvorrat', kartenIdFuer(alt, JETZT) === 'ausserhalb')
  const eigener = lead({ thread: thread({ last_from: 'me', last_message_at: '2025-04-01T10:00:00.000Z' }) })
  check(
    'ein alter Thread, den Kevin selbst begonnen hat, bleibt drin',
    kartenIdFuer(eigener, JETZT) !== ('ausserhalb' as FunnelKartenId),
    kartenIdFuer(eigener, JETZT),
  )
}

console.log(`\nverify-funnel-karten: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
