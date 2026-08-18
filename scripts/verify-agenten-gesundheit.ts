/**
 * Drift-Wache für die Agenten-Meldung (18.08.2026).
 *
 * **Der Fall, der sie ausgelöst hat.** Am 18.08. um 10:44 stand auf Kevins
 * Handy weiterhin „2 Agenten sind heute gescheitert: linkedin-antwort-entwuerfe,
 * morgenbrief — Nicht angelaufen", obwohl beide um 10:07 sauber durchgelaufen
 * waren. Die Regel „ein Erfolg danach hebt den Befund auf" galt bis dahin nur
 * für den Sperrbalken, nicht für die rote Zeile darunter.
 *
 * Eine Warnung, die nach der Reparatur stehen bleibt, bringt man sich bei zu
 * übersehen — und dann fehlt sie an dem Morgen, an dem sie zählt.
 *
 * Start: npx tsx scripts/verify-agenten-gesundheit.ts
 */
import { agentenBefund, istGesperrt, istWerktag, tagesStempel } from '../app/src/cockpit/lib/agentenGesundheit'
import type { RunSummary } from '../app/src/cockpit/lib/runnerApi'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const HEUTE = new Date('2026-08-18T12:00:00')
const tag = tagesStempel(HEUTE)

const lauf = (zeit: string, agent: string, status: RunSummary['status'], grund?: Partial<RunSummary['grund']>): RunSummary => ({
  id: `${tag}-${zeit}-${agent}`,
  agent,
  status,
  started: `2026-08-18T${zeit.slice(0, 2)}:${zeit.slice(2, 4)}:${zeit.slice(4, 6)}.000Z`,
  finished: '',
  preview: '',
  ...(grund ? { grund: { schluessel: 'unbekannt', kurz: '', hinweis: '', handeln: false, ...grund } as RunSummary['grund'] } : {}),
})

const FEHLSTART = { schluessel: 'fehlstart' as const, kurz: 'Nicht angelaufen', hinweis: 'Der Mac schlief beim Start', handeln: false }
const ANMELDUNG = { schluessel: 'anmeldung' as const, kurz: 'Anmeldung abgelaufen', hinweis: 'Im Terminal `claude` neu anmelden', handeln: true }

// --- 1. Der echte Verlauf des 18.08. ----------------------------------------
const derTag: RunSummary[] = [
  lauf('061644', 'morgenbrief', 'error', FEHLSTART),
  lauf('061645', 'linkedin-antwort-entwuerfe', 'error', FEHLSTART),
  lauf('064810', 'morgenbrief', 'error', FEHLSTART),
  lauf('064810', 'linkedin-antwort-entwuerfe', 'error', FEHLSTART),
  lauf('100728', 'morgenbrief', 'done'),
  lauf('100728', 'linkedin-antwort-entwuerfe', 'done'),
]
const b = agentenBefund(derTag, HEUTE)
check(
  'nach dem gelungenen Lauf meldet die Oberfläche NICHTS mehr',
  b.meldung === null,
  `Bekommen: ${b.meldung}. Das ist der Screenshot von 10:44 — die Zeile, die Kevin gemeldet hat.`,
)
check('kein Fehlschlag bleibt übrig', b.fehlschlaege.length === 0)
check('beide gelten als erfolgreich', b.erfolgreich.includes('morgenbrief') && b.erfolgreich.includes('linkedin-antwort-entwuerfe'))
check('kein Sperrbalken', istGesperrt(b) === false)

// --- 2. Vormittag: nur Fehlstarts, noch kein Erfolg --------------------------
// Der Runner wartet in diesem Zustand von selbst auf den wachen Mac. Rot wäre
// falsch — aber „erledigt" auch: Der Agent steht weiter aus.
const nurFehlstarts = agentenBefund(derTag.slice(0, 4), HEUTE)
check('ein reiner Fehlstart-Vormittag meldet nichts Rotes', nurFehlstarts.meldung === null)
check('die Agenten gelten aber als ausstehend', nurFehlstarts.ausstehend.includes('morgenbrief'))
check('und nicht als erfolgreich', nurFehlstarts.erfolgreich.length === 0)

// --- 3. Ein echter Fehlschlag muss weiterhin durchkommen ---------------------
const echterFehler = agentenBefund([lauf('070000', 'morgenbrief', 'error', { schluessel: 'unbekannt', kurz: 'Abbruch (Code 1)' })], HEUTE)
check('ein echter Fehlschlag wird gemeldet', echterFehler.meldung?.includes('morgenbrief ist heute gescheitert') === true)
check('mit seinem Grund', echterFehler.meldung?.includes('Abbruch (Code 1)') === true)

// Derselbe Agent, danach erfolgreich → erledigt.
const spaeterGut = agentenBefund(
  [lauf('070000', 'morgenbrief', 'error', { schluessel: 'unbekannt', kurz: 'Abbruch (Code 1)' }), lauf('080000', 'morgenbrief', 'done')],
  HEUTE,
)
check('ein Erfolg desselben Agenten räumt ihn ab', spaeterGut.meldung === null)

// Aber der Erfolg eines ANDEREN Agenten räumt nichts ab: Der Morgenbrief fehlt.
const andererGut = agentenBefund(
  [lauf('070000', 'morgenbrief', 'error', { schluessel: 'unbekannt', kurz: 'Abbruch (Code 1)' }), lauf('080000', 'dream-check', 'done')],
  HEUTE,
)
check(
  'der Erfolg eines anderen Agenten räumt NICHT ab',
  andererGut.fehlschlaege.length === 1,
  'Sonst deckt ein gelungener Dream-Check den fehlenden Morgenbrief zu.',
)

// --- 4. Die Anmeldung bleibt der laute Fall ---------------------------------
const gesperrt = agentenBefund([lauf('070000', 'morgenbrief', 'error', ANMELDUNG)], HEUTE)
check('eine abgelaufene Anmeldung setzt den Sperrbalken', istGesperrt(gesperrt) === true)
check('und sagt, was zu tun ist', gesperrt.meldung?.includes('neu anmelden') === true)

// Nach der Neu-Anmeldung räumt der nächste gelungene Lauf sie ab (Regel 17.08.).
const wiederGut = agentenBefund([lauf('070000', 'morgenbrief', 'error', ANMELDUNG), lauf('090000', 'morgenbrief', 'done')], HEUTE)
check('ein gelungener Lauf danach löst die Sperre', istGesperrt(wiederGut) === false)

// --- 5. Kalender -------------------------------------------------------------
check('Dienstag ist ein Werktag', istWerktag(HEUTE) === true)
check('Samstag nicht', istWerktag(new Date('2026-08-22T09:00:00')) === false)
check('gestrige Läufe zählen nicht für heute', agentenBefund([lauf('070000', 'morgenbrief', 'error', ANMELDUNG)], new Date('2026-08-19T09:00:00')).meldung === null)

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
