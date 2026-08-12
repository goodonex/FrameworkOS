/**
 * Verifikation für die Agenten-Kacheln auf dem Homescreen (O18 v2 b).
 *
 * Die Kacheln beantworten am Morgen „ist die Nacht durchgelaufen?". Wenn diese
 * Ableitung falsch ist, ist sie schlimmer als keine: ein grünes „durch" über
 * einem Agenten, der gescheitert ist, verhindert genau das Nachsehen, für das
 * O17 den Befund überhaupt eingeführt hat.
 *
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-agenten-kacheln.ts
 */
import { zustandVon } from '../app/src/cockpit/components/home/AgentenKacheln'
import { agentenBefund } from '../app/src/cockpit/lib/agentenGesundheit'
import type { RunSummary } from '../app/src/cockpit/lib/runnerApi'

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

const MI = new Date(2026, 7, 5, 9, 0, 0) // Mittwoch, 05.08.2026
const SO = new Date(2026, 7, 9, 9, 0, 0) // Sonntag, 09.08.2026

/** Run-Ids tragen das lokale Tagesdatum — genau daran erkennt `agentenBefund` „heute". */
function run(agent: string, status: RunSummary['status'], tag: Date): RunSummary {
  const p = (n: number) => String(n).padStart(2, '0')
  const stempel = `${tag.getFullYear()}-${p(tag.getMonth() + 1)}-${p(tag.getDate())}`
  return {
    id: `${stempel}-${agent}-1`,
    agent,
    status,
    started: tag.toISOString(),
    finished: tag.toISOString(),
    preview: '',
  }
}

const zustand = (agent: Parameters<typeof zustandVon>[0], runs: RunSummary[], jetzt: Date) =>
  zustandVon(agent, runs, agentenBefund(runs, jetzt), jetzt)

// --- Werktag ---------------------------------------------------------------
check('Werktag, kein Lauf → offen', zustand('morgenbrief', [], MI), 'wartet')
check('Werktag, erfolgreich → durch', zustand('morgenbrief', [run('morgenbrief', 'done', MI)], MI), 'durch')
check('Werktag, Fehler → gescheitert', zustand('morgenbrief', [run('morgenbrief', 'error', MI)], MI), 'gescheitert')
check('läuft gerade → laeuft', zustand('morgenbrief', [run('morgenbrief', 'running', MI)], MI), 'laeuft')

// Ein laufender Versuch nach einem gescheiterten zeigt „läuft" — der neue Lauf
// ist die relevantere Information als der alte Fehlschlag.
check(
  'Fehler + neuer Lauf → laeuft',
  zustand('morgenbrief', [run('morgenbrief', 'error', MI), run('morgenbrief', 'running', MI)], MI),
  'laeuft',
)

// --- Wochenende ------------------------------------------------------------
check('Sonntag, Werktags-Agent ohne Lauf → ruht', zustand('morgenbrief', [], SO), 'ruht')
check('Sonntag, Entwürfe ohne Lauf → ruht', zustand('linkedin-antwort-entwuerfe', [], SO), 'ruht')
// dream-check läuft täglich (runner/index.mjs) — sonntags ist Ausbleiben offen.
check('Sonntag, dream-check ohne Lauf → offen', zustand('dream-check', [], SO), 'wartet')
check(
  'Sonntag, Werktags-Agent gescheitert → gescheitert (nicht ruht)',
  zustand('morgenbrief', [run('morgenbrief', 'error', SO)], SO),
  'gescheitert',
)

// --- Abgrenzung ------------------------------------------------------------
const GESTERN = new Date(2026, 7, 4, 9, 0, 0)
check(
  'Erfolg von gestern zählt heute nicht',
  zustand('morgenbrief', [run('morgenbrief', 'done', GESTERN)], MI),
  'wartet',
)
check(
  'fremder Agent färbt nicht ab',
  zustand('morgenbrief', [run('dream-check', 'error', MI)], MI),
  'wartet',
)

// --- Der Grund eines Fehlschlags (12.08.2026) ------------------------------
// Die Meldung ist das, was morgens auf dem Homescreen steht. Am 11.08. sagte
// sie nur „ist heute gescheitert" — und die Anmeldung war seit einem Tag
// abgelaufen, ohne dass es irgendwo stand.
function mitGrund(r: RunSummary, grund: NonNullable<RunSummary['grund']>): RunSummary {
  return { ...r, grund }
}
const ANMELDUNG = {
  schluessel: 'anmeldung',
  kurz: 'Anmeldung abgelaufen',
  hinweis: 'Im Terminal `claude` neu anmelden',
  handeln: true,
} as const
const ZEITLIMIT = {
  schluessel: 'zeitlimit',
  kurz: 'Zeitlimit erreicht (10 Min.)',
  hinweis: 'Der Agent war zu lange unterwegs und wurde abgebrochen',
  handeln: false,
} as const

check(
  'ohne erkannten Grund bleibt die alte Meldung',
  agentenBefund([run('morgenbrief', 'error', MI)], MI).meldung,
  'morgenbrief ist heute gescheitert',
)
check(
  'ein harmloser Grund steht dabei, statt Rätsel aufzugeben',
  agentenBefund([mitGrund(run('morgenbrief', 'error', MI), ZEITLIMIT)], MI).meldung,
  'morgenbrief ist heute gescheitert — Zeitlimit erreicht (10 Min.)',
)
check(
  'verlangt ein Grund Handeln, sagt die Meldung, was zu tun ist',
  agentenBefund([mitGrund(run('morgenbrief', 'error', MI), ANMELDUNG)], MI).meldung,
  'Anmeldung abgelaufen — Im Terminal `claude` neu anmelden',
)
check(
  'Handlungsbedarf sticht die Namensliste — auch wenn mehrere Agenten scheitern',
  agentenBefund(
    [
      mitGrund(run('linkedin-antwort-entwuerfe', 'error', MI), ZEITLIMIT),
      mitGrund(run('morgenbrief', 'error', MI), ANMELDUNG),
    ],
    MI,
  ).meldung,
  'Anmeldung abgelaufen — Im Terminal `claude` neu anmelden',
)
check(
  'der Handlungsbedarf zeigt auf den richtigen Lauf',
  agentenBefund([mitGrund(run('morgenbrief', 'error', MI), ANMELDUNG)], MI).handlungsbedarf?.agent,
  'morgenbrief',
)
check(
  'harmlose Gründe erzeugen keinen Handlungsbedarf',
  agentenBefund([mitGrund(run('morgenbrief', 'error', MI), ZEITLIMIT)], MI).handlungsbedarf,
  null,
)
check(
  'ein Fehlschlag von gestern ist kein Handlungsbedarf von heute',
  agentenBefund([mitGrund(run('morgenbrief', 'error', GESTERN), ANMELDUNG)], MI).handlungsbedarf,
  null,
)
check('ohne Fehlschlag keine Meldung', agentenBefund([run('morgenbrief', 'done', MI)], MI).meldung, null)

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
