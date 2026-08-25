/**
 * Wache für die Auswahl des Sortier-Agenten (25.08.2026).
 *
 * Der teuerste Fehler, den dieses Modul machen kann, ist ein STILLER: einen
 * Thread gar nicht erst vorlegen. Wer nicht vorgelegt wird, bekommt nie ein
 * Urteil, bleibt ohne Urteil unentschieden — und Kevins Vorgabe war
 * ausdrücklich „da darf keiner wegfallen".
 *
 * Start: npx tsx scripts/verify-sortierer.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { SORTIER_MAX, baueSortierInput, brauchtUrteil } from '../runner/linkedin/sortierThreads.mjs'
import type { LinkedinThread, LinkedinThreadStatus } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

let seq = 0
function thread(over: Partial<LinkedinThread> & { agent_urteil?: string | null } = {}) {
  seq += 1
  return {
    id: `t${seq}`,
    brand_id: 'b1',
    thread_key: `key-${seq}`,
    contact_id: null,
    name: `Lead ${seq}`,
    company: 'Immobilienmakler',
    profile_url: 'https://www.linkedin.com/in/lead',
    preview: 'Moin',
    last_message_at: '2026-08-01T10:00:00Z',
    last_from: 'me',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active' as LinkedinThreadStatus,
    first_seen_at: '2026-07-01T10:00:00Z',
    last_synced_at: '2026-08-25T10:00:00Z',
    loom_status: 'offen',
    loom_erledigt_at: null,
    agent_urteil: null,
    ...over,
  }
}

/* ── Wer braucht ein Urteil? ───────────────────────────────────────────── */
{
  check('ohne Urteil: ja', brauchtUrteil(thread()) === true)
  check('mit Urteil lead: nein', brauchtUrteil(thread({ agent_urteil: 'lead' })) === false)
  check('mit Urteil akquise: nein', brauchtUrteil(thread({ agent_urteil: 'akquise' })) === false)
  check('leerer String zählt als kein Urteil', brauchtUrteil(thread({ agent_urteil: '  ' })) === true)
  for (const status of ['archived', 'won', 'lost'] as LinkedinThreadStatus[]) {
    check(`${status} braucht kein Urteil mehr`, brauchtUrteil(thread({ status })) === false)
  }
  check('waiting_reply braucht eins', brauchtUrteil(thread({ status: 'waiting_reply' })) === true)
}

/* ── Kevins Kernanforderung: keiner fällt weg ──────────────────────────── */
{
  /* Der Wortfilter darf hier NICHTS aussortieren — er liefert nur einen
   * Hinweis. Genau hier passiert sonst Kevins teurer Fehler: Ein Makler mit
   * schräger Headline („Addicted to selling Houses and deep Housemusic") wird
   * vom Wortfilter auf `off` gesetzt, und wenn dieses Modul ihn daraufhin gar
   * nicht erst vorlegt, kann der Agent den Irrtum nie korrigieren. */
  const offensichtlich = thread({ company: 'Immobilienmakler in Hamburg' })
  const schraeg = thread({ company: 'Addicted to selling Houses and deep Housemusic' })
  const fitness = thread({ company: 'Als Unternehmer 5-10KG Fett in 90 Tagen verlieren' })
  const leer = thread({ company: '' })
  const gebaut = baueSortierInput([offensichtlich, schraeg, fitness, leer])
  check(
    'ALLE vier werden vorgelegt — auch die, die der Wortfilter aussortieren würde',
    gebaut.input.threads.length === 4,
    JSON.stringify(gebaut.input.threads.map((t: { name: string }) => t.name)),
  )
  const wortfilter = gebaut.input.threads.map((t: { wortfilter: string }) => t.wortfilter)
  check('das Wortlisten-Urteil fährt als Hinweis mit', wortfilter.every(Boolean), JSON.stringify(wortfilter))
  check(
    'und es ist nicht überall dasselbe — der Hinweis trägt Information',
    new Set(wortfilter).size > 1,
    JSON.stringify(wortfilter),
  )
}

/* ── Reihenfolge: die Zweifelsfälle zuerst ─────────────────────────────── */
{
  /* `unklar` und `off` sind die Gruppen, in denen der Wortfilter wirklich
   * entscheidet — und sich damit irren kann. Sie gehören zuerst geprüft. */
  const kern = thread({ name: 'Kern', company: 'Immobilienmakler' })
  const unklar = thread({ name: 'Unklar', company: 'Do what you love. Love what you do.' })
  const off = thread({ name: 'Off', company: 'Recruiter für IT-Fachkräfte' })
  const gebaut = baueSortierInput([kern, off, unklar])
  const reihenfolge = gebaut.input.threads.map((t: { name: string }) => t.name)
  check('unklar vor off vor kern', reihenfolge[0] === 'Unklar' && reihenfolge[2] === 'Kern', JSON.stringify(reihenfolge))
}

/* ── Deckel und Vollständigkeit der Felder ─────────────────────────────── */
{
  const viele = Array.from({ length: SORTIER_MAX + 12 }, () => thread())
  const gebaut = baueSortierInput(viele)
  check('Deckel greift', gebaut.input.threads.length === SORTIER_MAX)
  check('der Rest wird gezählt, nicht verschwiegen', gebaut.weitereWarten === 12)

  // Ohne thread_key ist das Urteil verloren — `schreibeUrteile` ordnet
  // ausschliesslich darüber zu.
  check(
    'jeder Thread trägt einen thread_key',
    gebaut.input.threads.every((t: { thread_key?: string }) => Boolean(t.thread_key)),
  )
  const erster = gebaut.input.threads[0]
  for (const feld of ['name', 'headline', 'profile_url', 'verlauf', 'wortfilter']) {
    check(`Feld ${feld} ist im Input`, feld in erster, JSON.stringify(Object.keys(erster)))
  }
  check('verlauf ist immer ein Array, nie undefined', Array.isArray(erster.verlauf))
}

{
  // Schon Beurteilte belegen keinen Platz im Lauf.
  const offen = thread({ name: 'Offen' })
  const fertig = thread({ name: 'Fertig', agent_urteil: 'lead' })
  const gebaut = baueSortierInput([fertig, offen])
  check('bereits Beurteilte kommen nicht noch einmal', gebaut.input.threads.length === 1)
  check('… und zwar bleibt der Offene übrig', gebaut.input.threads[0].name === 'Offen')
}

{
  // Ein kaputter Verlauf darf den Lauf nicht kippen.
  const kaputt = thread({ verlauf: 'kein Array' as unknown as [] })
  const gebaut = baueSortierInput([kaputt])
  check('kaputter Verlauf wird zu einem leeren Array', Array.isArray(gebaut.input.threads[0].verlauf))
}

console.log(`\nverify-sortierer: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
