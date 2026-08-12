/**
 * Drift-Wache für die Funnel-Stufen (12.08.2026).
 *
 * Diese fünf Listen sagen Kevin, wen er heute anfasst. Ein Fehler hier ist
 * teuer und leise: jemand, der aus „angenommen, nie angeschrieben" fällt, wird
 * nie angeschrieben — und jemand, der fälschlich in der InMail-Welle landet,
 * bekommt eine Nachricht, die nicht passt.
 *
 * Start: npx tsx scripts/verify-funnel-stufen.ts
 */
import { profilKeyAus as profilKeyRunner } from '../runner/linkedin/netzwerkParse.mjs'
import {
  angenommenOhneErstnachricht,
  funnelStufen,
  inmailKandidaten,
  ohneAntwort,
  profilKeyAus,
  wartetAufLoom,
  type NetzwerkEintrag,
} from '../app/src/cockpit/lib/funnelStufen'
import type { Erstnachricht } from '../app/src/hooks/useErstnachrichten'
import type { LinkedinThread } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-08-12T12:00:00.000Z')
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * 86_400_000).toISOString()

function netz(teil: Partial<NetzwerkEintrag> & { profil_key: string }): NetzwerkEintrag {
  return {
    id: `n-${teil.profil_key}`,
    name: teil.profil_key,
    headline: '',
    profile_url: `https://www.linkedin.com/in/${teil.profil_key}/`,
    status: 'angenommen',
    eingeladen_at: null,
    angenommen_at: null,
    zuletzt_gesehen_at: JETZT.toISOString(),
    ...teil,
  }
}

function thread(teil: Partial<LinkedinThread> & { id: string }): LinkedinThread {
  return {
    brand_id: 'b1',
    thread_key: teil.id,
    contact_id: null,
    name: '',
    company: '',
    profile_url: '',
    preview: '',
    last_message_at: vorTagen(10),
    last_from: 'me',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active',
    first_seen_at: vorTagen(30),
    last_synced_at: JETZT.toISOString(),
    loom_status: 'offen',
    loom_erledigt_at: null,
    ...teil,
  } as LinkedinThread
}

function ersteN(teil: Partial<Erstnachricht> & { name: string }): Erstnachricht {
  return {
    id: `e-${teil.name}`,
    gruppe: 'G1',
    firma: '',
    website: '',
    nachricht: '',
    sort_index: 0,
    status: 'offen',
    sent_at: null,
    ...teil,
  }
}

// --- 1. Der Profil-Schlüssel darf nicht vom Runner abweichen ------------
for (const url of [
  'https://www.linkedin.com/in/josef-seibold-728710112/',
  'https://www.linkedin.com/in/Max-Muster',
  'https://www.linkedin.com/in/j%C3%BCrgen-hall/?trk=x',
  'https://example.com/foo',
  '',
]) {
  check(
    `Schlüssel deckungsgleich mit dem Runner: „${url.slice(0, 46)}"`,
    profilKeyAus(url) === profilKeyRunner(url),
    `App: ${profilKeyAus(url)} · Runner: ${profilKeyRunner(url)}`,
  )
}

// --- 2. Stufe 1: angenommen, noch nie angeschrieben --------------------
{
  const netzwerk = [
    netz({ profil_key: 'anna-neu', name: 'Anna Neu', angenommen_at: vorTagen(1) }),
    netz({ profil_key: 'bernd-alt', name: 'Bernd Alt', angenommen_at: vorTagen(9) }),
    netz({ profil_key: 'clara-chat', name: 'Clara Chat', angenommen_at: vorTagen(4) }),
    netz({ profil_key: 'dora-offen', name: 'Dora Offen', status: 'offen' }),
  ]
  const threads = [thread({ id: 't1', name: 'Clara Chat', profile_url: 'https://www.linkedin.com/in/clara-chat/' })]
  const liste = angenommenOhneErstnachricht(netzwerk, threads, [], JETZT)

  check('wer einen Thread hat, ist raus', !liste.some((p) => p.key === 'clara-chat'))
  check('wer noch offen ist, gehört nicht in diese Stufe', !liste.some((p) => p.key === 'dora-offen'))
  check('die beiden Übrigen sind drin', liste.length === 2)
  check('jüngste Annahme zuerst', liste[0]?.key === 'anna-neu', `Ist: ${liste[0]?.key}`)
  check('das Alter wird gerechnet', liste[0]?.tage === 1)

  const mitGesendet = angenommenOhneErstnachricht(
    netzwerk,
    [],
    [ersteN({ name: 'Anna Neu', status: 'gesendet' })],
    JETZT,
  )
  check('eine gesendete Erstnachricht schliesst aus', !mitGesendet.some((p) => p.key === 'anna-neu'))

  const mitOffener = angenommenOhneErstnachricht(
    netzwerk,
    [],
    [ersteN({ name: 'Anna Neu', status: 'offen' })],
    JETZT,
  )
  check(
    'eine noch OFFENE Erstnachricht schliesst NICHT aus',
    mitOffener.some((p) => p.key === 'anna-neu'),
    'Der Text liegt bereit, verschickt ist er nicht — genau diese Person ist gemeint.',
  )
}

// --- 3. Namens-Mehrdeutigkeit (D5) --------------------------------------
{
  const netzwerk = [netz({ profil_key: 'michael-mueller-1', name: 'Michael Müller', angenommen_at: vorTagen(2) })]
  // Zwei Threads mit demselben Namen, keiner mit passender URL.
  const threads = [
    thread({ id: 't1', name: 'Michael Müller', profile_url: 'https://www.linkedin.com/in/michael-mueller-99/' }),
    thread({ id: 't2', name: 'Michael Müller', profile_url: 'https://www.linkedin.com/in/michael-mueller-77/' }),
  ]
  const liste = angenommenOhneErstnachricht(netzwerk, threads, [], JETZT)
  check('ein mehrdeutiger Name verschwindet NICHT still', liste.length === 1)
  check('er wird als „prüfen" markiert', liste[0]?.pruefen === true)

  const eindeutig = angenommenOhneErstnachricht(
    netzwerk,
    [thread({ id: 't1', name: 'Michael Müller', profile_url: 'https://www.linkedin.com/in/michael-mueller-99/' })],
    [],
    JETZT,
  )
  check(
    'ein einzelner Namenstreffer gilt als „schon geschrieben"',
    eindeutig.length === 0,
    'Bei genau einem Treffer ist die vorsichtige Annahme richtig.',
  )
}

// --- 4. Stufen 2 und 3: ohne Antwort ------------------------------------
{
  const threads = [
    thread({ id: 'a', name: 'Erst Kontakt', followup_stage: 0, last_message_at: vorTagen(20) }),
    thread({ id: 'b', name: 'Nachgefasst', followup_stage: 1, last_message_at: vorTagen(5) }),
    thread({ id: 'c', name: 'Hat geantwortet', last_from: 'them', last_message_at: vorTagen(2) }),
    thread({ id: 'd', name: 'Ruht', status: 'archived' }),
    thread({ id: 'e', name: 'Jung', followup_stage: 0, last_message_at: vorTagen(1) }),
  ]
  const r = ohneAntwort(threads, JETZT)
  check('Erstkontakte ohne Antwort', r.erstkontakt.map((p) => p.name).join(',') === 'Erst Kontakt,Jung', `Ist: ${r.erstkontakt.map((p) => p.name)}`)
  check('älteste zuerst', r.erstkontakt[0]?.name === 'Erst Kontakt')
  check('nachgefasst getrennt', r.nachgefasst.length === 1 && r.nachgefasst[0].name === 'Nachgefasst')
  check(
    'wer geantwortet hat, steht in keiner der beiden Listen',
    ![...r.erstkontakt, ...r.nachgefasst].some((p) => p.name === 'Hat geantwortet'),
    'Dort ist Kevin am Zug, nicht der Lead — das ist ein anderer Eimer.',
  )
  check('archivierte Threads sind raus', ![...r.erstkontakt, ...r.nachgefasst].some((p) => p.name === 'Ruht'))
}

// --- 5. Stufe 4: Loom ---------------------------------------------------
{
  const threads = [
    thread({ id: 'l1', name: 'Loom offen', starred: true, loom_status: 'offen', last_message_at: vorTagen(8) }),
    thread({ id: 'l2', name: 'Loom raus', starred: true, loom_status: 'verschickt' }),
    thread({ id: 'l3', name: 'Kein Stern', starred: false, loom_status: 'offen' }),
  ]
  const liste = wartetAufLoom(threads, JETZT)
  check('nur Stern + offen', liste.length === 1 && liste[0].name === 'Loom offen')
}

// --- 6. Stufe 5: InMail-Kandidaten und die Schutzklausel (D4) -----------
{
  const vollerLauf = vorTagen(1)
  const netzwerk = [
    netz({ profil_key: 'p1', status: 'offen', eingeladen_at: vorTagen(40), zuletzt_gesehen_at: vollerLauf }),
    netz({ profil_key: 'p2', status: 'offen', eingeladen_at: vorTagen(10), zuletzt_gesehen_at: vollerLauf }),
    // Im letzten vollen Lauf NICHT mehr gesehen → hat angenommen oder wurde zurückgezogen.
    netz({ profil_key: 'p3', status: 'offen', eingeladen_at: vorTagen(60), zuletzt_gesehen_at: vorTagen(30) }),
    netz({ profil_key: 'p4', status: 'angenommen', zuletzt_gesehen_at: vollerLauf }),
  ]
  const liste = inmailKandidaten(netzwerk, vollerLauf, JETZT)
  check('nur offene Einladungen', liste.length === 2, `Ist: ${liste.map((p) => p.key)}`)
  check('älteste Einladung zuerst', liste[0]?.key === 'p1')
  check(
    'wer im letzten vollen Lauf fehlte, ist kein Kandidat mehr',
    !liste.some((p) => p.key === 'p3'),
    'Sonst schriebe die Welle Leute an, die längst angenommen haben.',
  )
  check(
    'ohne vollständigen Lauf gibt es KEINE Liste',
    inmailKandidaten(netzwerk, null, JETZT).length === 0,
    'Eine Zahl ohne belastbare Grundlage ist schlimmer als keine.',
  )
  check('ein kaputter Zeitstempel ergibt keine Liste', inmailKandidaten(netzwerk, 'kaputt', JETZT).length === 0)
}

// --- 7. Eine Person steht in genau einer Liste ---------------------------
{
  const netzwerk = [
    netz({ profil_key: 'solo', name: 'Solo Person', angenommen_at: vorTagen(3) }),
    netz({ profil_key: 'offen-1', name: 'Noch Offen', status: 'offen', eingeladen_at: vorTagen(50) }),
  ]
  const threads = [
    thread({ id: 't-a', name: 'Wartet', profile_url: 'https://www.linkedin.com/in/wartet/', followup_stage: 0, last_message_at: vorTagen(15) }),
    thread({ id: 't-l', name: 'Loomer', profile_url: 'https://www.linkedin.com/in/loomer/', starred: true, loom_status: 'offen', last_from: 'them', last_message_at: vorTagen(3) }),
  ]
  const s = funnelStufen(
    { netzwerk, threads, erstnachrichten: [], letzterVollerEinladungsLauf: JETZT.toISOString() },
    JETZT,
  )
  const alle = [
    ...s.angenommenOffen.map((p) => `1:${p.name}`),
    ...s.ohneAntwortErst.map((p) => `2:${p.name}`),
    ...s.ohneAntwortNachgefasst.map((p) => `3:${p.name}`),
    ...s.loomOffen.map((p) => `4:${p.name}`),
    ...s.inmail.map((p) => `5:${p.name}`),
  ]
  const namen = alle.map((x) => x.split(':')[1])
  check(
    'keine Person steht in zwei Listen',
    new Set(namen).size === namen.length,
    `Ist: ${alle.join(' · ')}`,
  )
  check('alle fünf Listen sind belegt oder leer, aber nie undefined', Object.values(s).every(Array.isArray))
  check('Solo Person steht in Stufe 1', s.angenommenOffen.some((p) => p.name === 'Solo Person'))
  check('Noch Offen steht in Stufe 5', s.inmail.some((p) => p.name === 'Noch Offen'))
  check('Loomer steht bei den Looms', s.loomOffen.some((p) => p.name === 'Loomer'))
}

// --- 8. Leere Eingaben brechen nichts -----------------------------------
{
  const leer = funnelStufen({ netzwerk: [], threads: [], erstnachrichten: [], letzterVollerEinladungsLauf: null }, JETZT)
  check('alles leer, kein Absturz', Object.values(leer).every((l) => Array.isArray(l) && l.length === 0))
}

console.log(`\nverify-funnel-stufen: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
