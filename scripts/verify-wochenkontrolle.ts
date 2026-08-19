/**
 * Drift-Wache für die Wochenkontrolle (19.08.2026).
 *
 * Diese Ansicht ist Kevins einzige Gegenprobe zu allen Filtern: Sie soll
 * zeigen, wer angenommen hat und NICHT angeschrieben wurde. Wenn sie lügt,
 * lügt sie beruhigend — und genau das wäre der teuerste Fehler im Modul.
 *
 * Start: npx tsx scripts/verify-wochenkontrolle.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { NetzwerkEintrag } from '../app/src/cockpit/lib/funnelStufen'
import { wochenkontrolle } from '../app/src/cockpit/lib/wochenkontrolle'
import type { Erstnachricht } from '../app/src/hooks/useErstnachrichten'
import type { LinkedinThread } from '../app/src/types/db'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-08-19T12:00:00.000Z')
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * 86_400_000).toISOString()

function netz(teil: Partial<NetzwerkEintrag> & { profil_key: string }): NetzwerkEintrag {
  return {
    id: `n-${teil.profil_key}`,
    name: teil.profil_key,
    headline: '',
    profile_url: `https://www.linkedin.com/in/${teil.profil_key}/`,
    status: 'angenommen',
    eingeladen_at: null,
    angenommen_at: vorTagen(2),
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
    last_message_at: vorTagen(1),
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

// --- 1. Die drei Lagen ----------------------------------------------------
const netzwerk: NetzwerkEintrag[] = [
  // Makler, angenommen, kein Thread, keine Erstnachricht → offen.
  netz({ profil_key: 'maria-makler', name: 'Maria Makler', headline: 'Immobilienmaklerin Hamburg' }),
  // Makler mit Thread → angeschrieben.
  netz({
    profil_key: 'tom-thread',
    name: 'Tom Thread',
    headline: 'Immobilienmakler München',
    angenommen_at: vorTagen(3),
  }),
  // Coach ohne Thread → aussortiert, mit nennbarem Grund.
  netz({ profil_key: 'carla-coach', name: 'Carla Coach', headline: 'Business Coaching für Führungskräfte' }),
]
const threads = [thread({ id: 't1', profile_url: 'https://www.linkedin.com/in/tom-thread/' })]

const w = wochenkontrolle(netzwerk, threads, [], JETZT)
check('der Makler ohne Nachricht steht als offen', w.offen.length === 1 && w.offen[0].key === 'maria-makler')
check(
  'wer einen Thread hat, gilt als angeschrieben',
  w.angeschrieben.length === 1 && w.angeschrieben[0].key === 'tom-thread',
)
check(
  'der Coach ist aussortiert und nennt das auslösende Wort',
  w.aussortiert.length === 1 && w.aussortiert[0].grund === 'coach',
  `Ist: ${JSON.stringify(w.aussortiert)}`,
)
check('alle drei stehen in der Gesamtliste', w.alle.length === 3)
check('jüngste Annahme zuerst', w.alle[w.alle.length - 1].key === 'tom-thread')

// --- 2. Eine gesendete Erstnachricht zählt wie ein Thread -----------------
const wMitNachricht = wochenkontrolle(
  netzwerk,
  [],
  [ersteN({ name: 'Maria Makler', status: 'gesendet' })],
  JETZT,
)
check(
  'eine gesendete Erstnachricht macht aus offen ein angeschrieben',
  !wMitNachricht.offen.some((e) => e.key === 'maria-makler') &&
    wMitNachricht.angeschrieben.some((e) => e.key === 'maria-makler'),
  `Ist: ${JSON.stringify(wMitNachricht.offen.map((e) => e.key))}`,
)

// --- 3. Das Fenster schneidet, aber verliert nichts Aktuelles ------------
const alt = wochenkontrolle(
  [netz({ profil_key: 'alt-anna', name: 'Anna Alt', headline: 'Immobilienmaklerin', angenommen_at: vorTagen(9) })],
  [],
  [],
  JETZT,
)
check('was älter als sieben Tage ist, fällt aus dem Fenster', alt.alle.length === 0)

const genauSieben = wochenkontrolle(
  [netz({ profil_key: 'rand-rita', name: 'Rita Rand', headline: 'Immobilienmaklerin', angenommen_at: vorTagen(6) })],
  [],
  [],
  JETZT,
)
check('der siebte Tag zählt noch dazu', genauSieben.alle.length === 1)

// --- 4. Wer angeschrieben wurde, wird nicht nachträglich aussortiert -----
// Sonst verschwände ein bereits bearbeiteter Kontakt in die Fehlerliste und
// erzeugte Alarm, wo nichts zu tun ist.
const coachMitThread = wochenkontrolle(
  [netz({ profil_key: 'carla-coach', name: 'Carla Coach', headline: 'Business Coaching' })],
  [thread({ id: 't2', profile_url: 'https://www.linkedin.com/in/carla-coach/' })],
  [],
  JETZT,
)
check(
  'ein angeschriebener Off-ICP bleibt angeschrieben statt in der Fehlerliste zu landen',
  coachMitThread.aussortiert.length === 0 && coachMitThread.angeschrieben.length === 1,
)

// --- 5. Nur angenommene Kontakte, und nur mit Datum ---------------------
const gemischt = wochenkontrolle(
  [
    netz({ profil_key: 'offen-olaf', name: 'Olaf Offen', status: 'offen' }),
    netz({ profil_key: 'ohne-datum', name: 'Ohne Datum', angenommen_at: null }),
  ],
  [],
  [],
  JETZT,
)
check('offene Einladungen und undatierte Annahmen bleiben draussen', gemischt.alle.length === 0)

// --- 6. Blatt-Disziplin -------------------------------------------------
const quelle = readFileSync(join(wurzel, 'app/src/cockpit/lib/wochenkontrolle.ts'), 'utf8')
check('wochenkontrolle ist frei von React', !/from 'react'/.test(quelle))
check('wochenkontrolle schreibt nichts', !/supabase|upsert/.test(quelle))
check(
  'die Zuordnung kommt aus funnelStufen, statt neu gebaut zu werden',
  /angenommenOhneErstnachricht/.test(quelle),
  'Zwei Antworten auf „wurde die Person angeschrieben?" driften auseinander.',
)
check(
  'das ICP-Urteil kommt aus icp.ts, statt hier nachgebaut zu werden',
  /from '\.\/icp'/.test(quelle),
)

console.log(`\nverify-wochenkontrolle: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
