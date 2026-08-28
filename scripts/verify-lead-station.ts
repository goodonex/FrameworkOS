/**
 * Drift-Wache für den Workflow-Rechner (20.08.2026).
 *
 * Diese Funktion sagt, wer heute angefasst wird. Ein Fehler ist leise und
 * teuer: Wer aus „E-Mail fällig" fällt, wird nie angeschrieben; wer zu früh
 * hineinfällt, bekommt zwei Anläufe in derselben Woche.
 *
 * Start: npx tsx scripts/verify-lead-station.ts
 */
import type { LeadEreignisTyp, LinkedinThread } from '../app/src/types/db'
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

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-08-20T12:00:00.000Z')
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * 86_400_000).toISOString()

function ereignis(typ: LeadEreignisTyp, tageHer: number) {
  return { typ, at: vorTagen(tageHer) }
}

function eingabe(teil: Partial<LeadStationEingabe> = {}): LeadStationEingabe {
  return { lead_status: 'aktiv', wiedervorlage_am: null, ereignisse: [], thread: null, ...teil }
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
    snoozed_until: null,
    status: 'active',
    first_seen_at: vorTagen(30),
    last_synced_at: vorTagen(0),
    loom_status: null,
    loom_erledigt_at: null,
    ...teil,
  } as LinkedinThread
}

/* ── Stiller Zweig: die Kadenz ─────────────────────────────────────────── */

{
  const r = leadStation(eingabe({ ereignisse: [ereignis('anfrage', 10)] }), JETZT)
  check('frische Anfrage wartet auf Annahme', r.station === 'anfrage_offen' && !r.faellig, JSON.stringify(r))
  check('frische Anfrage ist im InMail-Pool', r.imInmailPool)
}

{
  const r = leadStation(eingabe({ ereignisse: [ereignis('anfrage', STILL_EMAIL_TAGE + 1)] }), JETZT)
  check('nach 30 Tagen ohne Annahme wird die E-Mail fällig', r.station === 'email_faellig' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ ereignisse: [ereignis('anfrage', STILL_EMAIL_TAGE - 1)] }), JETZT)
  check('einen Tag zu früh ist die E-Mail noch nicht fällig', r.station === 'anfrage_offen' && !r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 60), ereignis('email', STILL_POSTKARTE_TAGE + 1)] }),
    JETZT,
  )
  check('eine Woche nach der E-Mail ist die Postkarte dran', r.station === 'postkarte_faellig' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 90), ereignis('email', 20), ereignis('postkarte', STILL_ANRUF_TAGE + 1)] }),
    JETZT,
  )
  check('eine Woche nach der Postkarte ist der Anruf dran', r.station === 'anruf_faellig' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 200), ereignis('email', 60), ereignis('postkarte', 50), ereignis('anruf', 40)] }),
    JETZT,
  )
  check('nach dem Anruf ruht der Lead', r.station === 'ruht' && !r.faellig, JSON.stringify(r))
}

{
  // Ruhe von 6 Monaten ist um: der Lead kommt von selbst wieder hoch.
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 400), ereignis('anruf', 200)] }),
    JETZT,
  )
  check('nach der Ruhezeit wird der Lead wieder fällig', r.station === 'ruht' && r.faellig, JSON.stringify(r))
}

/* ── Der Mindestabstand (Kevins Nebenstrom-Problem) ────────────────────── */

{
  // E-Mail wäre fällig, aber gestern ging eine InMail raus.
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 60), ereignis('inmail', 1)] }),
    JETZT,
  )
  check('frische InMail verschiebt die fällige E-Mail', r.station === 'email_faellig' && !r.faellig, JSON.stringify(r))
  const ziel = new Date(r.faelligAm ?? 0).getTime()
  const erwartet = new Date(vorTagen(1)).getTime() + MIN_ABSTAND_TAGE * 86_400_000
  check('die Verschiebung beträgt genau den Mindestabstand', ziel === erwartet, `${r.faelligAm}`)
}

{
  // Dieselbe Lage, aber die InMail ist alt genug.
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 60), ereignis('inmail', MIN_ABSTAND_TAGE + 1)] }),
    JETZT,
  )
  check('alte InMail hält die E-Mail nicht auf', r.station === 'email_faellig' && r.faellig, JSON.stringify(r))
}

{
  // InMail hakt nichts ab: die Kadenz läuft weiter, die Station bleibt.
  const r = leadStation(eingabe({ ereignisse: [ereignis('anfrage', 60), ereignis('inmail', 30)] }), JETZT)
  check('eine InMail beendet den stillen Zweig nicht', r.station === 'email_faellig', JSON.stringify(r))
  check('wer eine InMail hat, ist nicht mehr im Pool', !r.imInmailPool)
}

/* ── Hauptweg ──────────────────────────────────────────────────────────── */

{
  const r = leadStation(eingabe({ ereignisse: [ereignis('anfrage', 40), ereignis('angenommen', 2)] }), JETZT)
  check('angenommen ohne Thread heißt: Erstnachricht fällig', r.station === 'erstnachricht_faellig' && r.faellig, JSON.stringify(r))
  check('wer angenommen hat, ist nicht im InMail-Pool', !r.imInmailPool)
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 40), ereignis('angenommen', 10)], thread: thread({ last_from: 'them' }) }),
    JETZT,
  )
  check('Antwort der Person sticht alles andere', r.station === 'antwort_da' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ thread: thread({ starred: true, loom_status: 'offen', last_from: 'them' }) }),
    JETZT,
  )
  check('zugesagtes Loom kommt vor der Antwort-Station', r.station === 'loom_offen' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ thread: thread({ last_from: 'me', last_message_at: vorTagen(1) }) }), JETZT)
  check('frisch geschrieben heißt warten', r.station === 'wartet_auf_antwort' && !r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ thread: thread({ last_from: 'me', last_message_at: vorTagen(5), followup_stage: 0 }) }), JETZT)
  check('nach der ersten Schwelle ist Nachfassen dran', r.station === 'wartet_auf_antwort' && r.faellig, JSON.stringify(r))
  check('der Bucket kommt aus linkedinFollowups', r.bucket !== null, JSON.stringify(r))
}

/* ── Übersteuerungen ───────────────────────────────────────────────────── */

{
  const r = leadStation(
    eingabe({
      lead_status: 'wiedervorlage',
      wiedervorlage_am: '2026-10-01',
      thread: thread({ last_from: 'them' }),
    }),
    JETZT,
  )
  check('Wiedervorlage sticht selbst eine offene Antwort', r.station === 'wiedervorlage' && !r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ lead_status: 'wiedervorlage', wiedervorlage_am: '2026-08-19' }), JETZT)
  check('erreichte Wiedervorlage ist fällig', r.station === 'wiedervorlage' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ lead_status: 'disqualifiziert', ereignisse: [ereignis('anfrage', 100)], thread: thread({ last_from: 'them' }) }),
    JETZT,
  )
  check('aussortiert bleibt aussortiert', r.station === 'disqualifiziert' && !r.faellig, JSON.stringify(r))
  check('aussortierte tauchen nicht im InMail-Pool auf', !r.imInmailPool)
}

{
  const r = leadStation(eingabe({ lead_status: 'kunde', thread: thread({ last_from: 'them' }) }), JETZT)
  check('Kunde ist eine Endstation', r.station === 'kunde' && !r.faellig, JSON.stringify(r))
}

/* ── Lauter Zweig: was nach dem dritten Follow-up passiert (0078) ──────── */

/** Ein Thread, dessen LinkedIn-Follow-ups durch sind — `bucketOf` sagt `abschluss`. */
function ausgereizt(tageSeitLetzterNachricht: number, teil: Partial<LinkedinThread> = {}): LinkedinThread {
  return thread({ followup_stage: 3, last_from: 'me', last_message_at: vorTagen(tageSeitLetzterNachricht), ...teil })
}

{
  const r = leadStation(eingabe({ ereignisse: [ereignis('angenommen', 60)], thread: ausgereizt(3) }), JETZT)
  check(
    'Follow-ups durch, aber noch keine Woche her — Instagram wartet',
    r.station === 'instagram_faellig' && !r.faellig && r.zweig === 'laut',
    JSON.stringify(r),
  )
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('angenommen', 60)], thread: ausgereizt(LAUT_INSTAGRAM_TAGE + 3) }),
    JETZT,
  )
  check(
    'Follow-ups durch und die Woche um — Instagram ist dran',
    r.station === 'instagram_faellig' && r.faellig,
    JSON.stringify(r),
  )
  check('der ausgereizte Thread landet nicht mehr in „wartet auf Antwort"', r.station !== 'wartet_auf_antwort')
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('instagram', LAUT_PDF_TAGE + 2)], thread: ausgereizt(40) }),
    JETZT,
  )
  check('nach Instagram folgt die PDF', r.station === 'pdf_faellig' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ ereignisse: [ereignis('instagram', 4)], thread: ausgereizt(40) }), JETZT)
  check('die PDF wartet ihre zwei Wochen ab', r.station === 'pdf_faellig' && !r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('instagram', 60), ereignis('pdf', LAUT_POSTKARTE_TAGE + 2)], thread: ausgereizt(70) }),
    JETZT,
  )
  check('nach der PDF folgt die Postkarte', r.station === 'postkarte_faellig' && r.faellig, JSON.stringify(r))
  check(
    'die Postkarte im lauten Zweig wird als solche erkannt',
    r.zweig === 'laut' && r.naechsterSchritt.includes('Analyse'),
    JSON.stringify(r),
  )
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('pdf', 40), ereignis('postkarte', LAUT_ANRUF_TAGE + 1)], thread: ausgereizt(80) }),
    JETZT,
  )
  check('nach der Postkarte folgt der Anruf', r.station === 'anruf_faellig' && r.faellig, JSON.stringify(r))
  check('die Karte ist der Aufhänger des Anrufs', r.naechsterSchritt.includes('Karte'), JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ ereignisse: [ereignis('anruf', 10)], thread: ausgereizt(90) }), JETZT)
  check('nach dem Anruf ist die Kette durch', r.station === 'ruht' && !r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('anruf', RUHE_MONATE * 30 + 5)], thread: ausgereizt(200) }),
    JETZT,
  )
  check(`nach ${RUHE_MONATE} Monaten Ruhe kommt der Lead von selbst wieder`, r.station === 'ruht' && r.faellig, JSON.stringify(r))
}

{
  // Ein uebersprungener Schritt haelt die Kette nicht an: Postkarte ohne PDF.
  const r = leadStation(eingabe({ ereignisse: [ereignis('postkarte', 10)], thread: ausgereizt(60) }), JETZT)
  check(
    'übersprungene Stufe blockiert nicht — nach der Postkarte kommt der Anruf, nicht die nachgeholte PDF',
    r.station === 'anruf_faellig' && r.faellig,
    JSON.stringify(r),
  )
}

{
  // Doppelbeschuss: Die Postkarte waere faellig, aber gestern ging eine InMail raus.
  const r = leadStation(
    eingabe({ ereignisse: [ereignis('pdf', LAUT_POSTKARTE_TAGE + 2), ereignis('inmail', 1)], thread: ausgereizt(60) }),
    JETZT,
  )
  check(
    'der Mindestabstand bremst auch die laute Kette',
    r.station === 'postkarte_faellig' && !r.faellig,
    JSON.stringify(r),
  )
  check('und sagt auch, dass er es tut', r.naechsterSchritt.includes('Mindestabstand'), JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ ereignisse: [], thread: ausgereizt(40, { last_from: 'them' }) }), JETZT)
  check('eine Antwort sticht die ganze Kette', r.station === 'antwort_da' && r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ ereignisse: [], thread: ausgereizt(40, { starred: true, loom_status: 'offen' }) }),
    JETZT,
  )
  check('eine Loom-Zusage sticht die ganze Kette', r.station === 'loom_offen', JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ lead_status: 'wiedervorlage', wiedervorlage_am: '2026-12-01', thread: ausgereizt(60) }),
    JETZT,
  )
  check('eine gesetzte Wiedervorlage sticht die laute Kette', r.station === 'wiedervorlage' && !r.faellig, JSON.stringify(r))
}

{
  // Dieselbe Station, zwei Aeste — der Unterschied muss ablesbar bleiben.
  const laut = leadStation(eingabe({ ereignisse: [ereignis('pdf', 30)], thread: ausgereizt(60) }), JETZT)
  const still = leadStation(
    eingabe({ ereignisse: [ereignis('anfrage', 60), ereignis('email', STILL_POSTKARTE_TAGE + 2)] }),
    JETZT,
  )
  check(
    'Postkarte laut und Postkarte still sind unterscheidbar',
    laut.station === 'postkarte_faellig' &&
      still.station === 'postkarte_faellig' &&
      laut.zweig === 'laut' &&
      still.zweig === 'still' &&
      laut.naechsterSchritt !== still.naechsterSchritt,
    JSON.stringify({ laut, still }),
  )
}

{
  const r = leadStation(eingabe({ ereignisse: [], thread: ausgereizt(0, { last_message_at: null }) }), JETZT)
  check(
    'ein ausgereizter Thread ohne Datum wird sichtbar statt still zu warten',
    r.station === 'instagram_faellig' && r.faellig,
    JSON.stringify(r),
  )
}

/* ── Randfälle ─────────────────────────────────────────────────────────── */

{
  const r = leadStation(eingabe({ ereignisse: [] }), JETZT)
  check('ohne jedes Ereignis stürzt nichts ab', r.station === 'anfrage_offen' && !r.faellig, JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ ereignisse: [{ typ: 'anfrage', at: 'kaputt' }] }), JETZT)
  check('ein unlesbares Datum wird ignoriert statt zu vergiften', r.station === 'anfrage_offen', JSON.stringify(r))
}

{
  const r = leadStation(eingabe({ lead_status: 'wiedervorlage', wiedervorlage_am: null }), JETZT)
  check('Wiedervorlage ohne Datum fällt auf die normale Rechnung zurück', r.station === 'anfrage_offen', JSON.stringify(r))
}

/* ── Das Loom-Urteil von Hand (0081, 28.08.2026) ──────────────────────────
 *
 * Bis hierher gab es die Ja/Nein-Frage in Uriel nicht: „Ja" ging nur ueber den
 * Stern im LinkedIn-Postfach, „Nein" ueberhaupt nicht. Diese Bloecke halten
 * fest, dass Kevins Hand jetzt zaehlt — und dass der naechste Sync sie nicht
 * ueberschreibt.
 */
{
  const r = leadStation(
    eingabe({
      ereignisse: [ereignis('loom_zugesagt', 0)],
      thread: thread({ starred: false, loom_status: 'offen', last_from: 'them', last_message_at: vorTagen(1) }),
    }),
    JETZT,
  )
  check(
    'Loom ja von Hand wirkt auch ohne Stern',
    r.station === 'loom_offen' && r.faellig,
    JSON.stringify(r),
  )
}

{
  const r = leadStation(
    eingabe({
      ereignisse: [ereignis('loom_abgelehnt', 0)],
      thread: thread({ starred: false, loom_status: 'offen', last_from: 'them', last_message_at: vorTagen(1) }),
    }),
    JETZT,
  )
  check(
    'Loom nein nimmt den Lead aus „Antwort da"',
    r.station === 'wartet_auf_antwort',
    JSON.stringify(r),
  )
}

{
  /* Der Fall, an dem alles haengt: Der Sync leitet aus dem Stern ein
   * `loom_zugesagt` ab und stempelt es mit `thread.last_message_at` — also mit
   * dem Zeitpunkt der letzten Nachricht. Kevins Absage von heute ist juenger
   * und muss gewinnen, sonst pendelt der Lead bei jedem Sync zurueck. */
  const r = leadStation(
    eingabe({
      ereignisse: [ereignis('loom_zugesagt', 3), ereignis('loom_abgelehnt', 0)],
      thread: thread({ starred: true, loom_status: 'offen', last_from: 'them', last_message_at: vorTagen(3) }),
    }),
    JETZT,
  )
  check(
    'die juengere Absage sticht den Stern und sein abgeleitetes loom_zugesagt',
    r.station === 'wartet_auf_antwort',
    `Sonst ueberschreibt der naechste Sync Kevins Nein. Ist: ${JSON.stringify(r)}`,
  )
}

{
  const r = leadStation(
    eingabe({
      ereignisse: [ereignis('loom_abgelehnt', 3), ereignis('loom_zugesagt', 0)],
      thread: thread({ starred: false, loom_status: 'offen', last_from: 'them', last_message_at: vorTagen(3) }),
    }),
    JETZT,
  )
  check('und umgekehrt genauso — es gewinnt immer das juengste Urteil', r.station === 'loom_offen', JSON.stringify(r))
}

{
  /* Erst abgesagt, zwei Wochen spaeter doch geschrieben: Das Urteil ist
   * ueberholt, Kevin entscheidet neu. Ohne diese Klausel bliebe der Lead stumm
   * in der Kette haengen — die teuerste Art, eine Zusage zu verlieren. */
  const r = leadStation(
    eingabe({
      ereignisse: [ereignis('loom_abgelehnt', 14)],
      thread: thread({ starred: false, loom_status: 'offen', last_from: 'them', last_message_at: vorTagen(1) }),
    }),
    JETZT,
  )
  check('schreibt der Lead nach der Absage erneut, gilt wieder „Antwort da"', r.station === 'antwort_da', JSON.stringify(r))
}

{
  /* 0077 bleibt unangetastet: Wer nicht selbst ueber die Website entscheidet,
   * faellt aus der Bauliste — auch bei einer Zusage von Hand. */
  const r = leadStation(
    eingabe({
      ereignisse: [ereignis('loom_zugesagt', 0)],
      thread: thread({ starred: false, loom_status: 'zustaendigkeit', last_from: 'them', last_message_at: vorTagen(1) }),
    }),
    JETZT,
  )
  check('„Entscheider offen" sticht auch die Hand-Zusage', r.station !== 'loom_offen', JSON.stringify(r))
}

{
  /* Ist das Loom raus, ist die Zusage erledigt — sie darf nicht ewig als
   * offener Posten stehen bleiben. */
  const r = leadStation(
    eingabe({
      ereignisse: [ereignis('loom_zugesagt', 5), ereignis('loom_gesendet', 2)],
      thread: thread({ starred: true, loom_status: 'verschickt', last_from: 'them', last_message_at: vorTagen(5) }),
    }),
    JETZT,
  )
  check('ein verschicktes Loom steht nicht mehr offen', r.station !== 'loom_offen', JSON.stringify(r))
}

{
  const r = leadStation(
    eingabe({ ereignisse: [], thread: thread({ starred: true, loom_status: 'offen', last_from: 'them' }) }),
    JETZT,
  )
  check('der Stern allein wirkt unveraendert weiter', r.station === 'loom_offen', JSON.stringify(r))
}

console.log(`\nverify-lead-station: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
