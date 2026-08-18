/**
 * Drift-Wache für die Startfreigabe (18.08.2026).
 *
 * Was hier schiefgehen kann, kostet einen ganzen Arbeitstag: Ist die Schwelle
 * zu lasch, startet der Runner wieder in einen DarkWake hinein und verbrennt
 * den Tagesdeckel, bevor Kevin am Schreibtisch sitzt. Ist sie zu streng, wartet
 * der Morgenbrief auf einem wachen Mac ewig auf eine Erlaubnis, die nie kommt.
 *
 * Start: npx tsx scripts/verify-start-bereit.ts
 */
import { bewerteWachheit, startBereitAus, WACH_KARENZ_MS } from '../runner/startBereit.mjs'
import { bewerteTagesLaeufe, darfRoutineStarten } from '../runner/routineGuard.mjs'
import { laufGrund } from '../runner/laufGrund.mjs'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const TICK = 60_000
const T0 = 1_760_000_000_000

// --- 1. Der Fall, der die Runde ausgelöst hat --------------------------------
// Wortgleich aus 2026-08-18-061644-morgenbrief.md: Zeitlimit, aber null Züge.
const ECHT_FEHLSTART = `# Run abgebrochen (Exit null — Zeitlimit 10 Minuten)

**Mitschrift bis zum Abbruch** — 0 Ereignisse · 0 Werkzeug-Aufrufe

\`\`\`
(noch nichts)
\`\`\``

const fehlstart = laufGrund(ECHT_FEHLSTART)
check('die echte Mitschrift vom 18.08. gilt als Fehlstart', fehlstart?.schluessel === 'fehlstart')
check('sie heißt „Nicht angelaufen"', fehlstart?.kurz === 'Nicht angelaufen')
check('Kevin muss dafür nichts tun', fehlstart?.handeln === false)

// Ein echtes Zeitlimit — der Agent lief, war nur zu lange unterwegs — darf
// weiterhin als Zeitlimit gelten, sonst verschwindet ein echtes Problem.
const ECHT_ZEITLIMIT = `# Run abgebrochen (Exit 143 — Zeitlimit 10 Minuten)

**Mitschrift bis zum Abbruch** — 47 Ereignisse · 12 Werkzeug-Aufrufe

\`\`\`
[+00:02] Sitzung gestartet
\`\`\``
check('ein Lauf MIT Werkzeug-Aufrufen bleibt „Zeitlimit erreicht"', laufGrund(ECHT_ZEITLIMIT)?.schluessel === 'zeitlimit')

// Der zweite echte Fall vom 18.08. (06:48): zwei Ereignisse, aber beide mit
// Zeitstempel [+17:13] — die CLI eröffnete beim nächsten Aufwacher gerade noch
// ihre Sitzung. Am Ereignis-Zähler wäre das ein „echtes" Zeitlimit gewesen; am
// Werkzeug-Zähler ist es das, was es ist.
const ECHT_FEHLSTART_MIT_ZEILEN = `# Run abgebrochen (Exit 143 — Zeitlimit 10 Minuten)

**Mitschrift bis zum Abbruch** — 2 Ereignisse · 0 Werkzeug-Aufrufe

\`\`\`
[+17:13] Sitzung gestartet · 25 Werkzeuge · /Users/kevinherrmann/Second Brain
[+17:14] Fertig (error_during_execution) · 1.0s · 2 Züge · $0.0000
\`\`\``
check(
  'auch der 06:48-Lauf vom 18.08. ist ein Fehlstart',
  laufGrund(ECHT_FEHLSTART_MIT_ZEILEN)?.schluessel === 'fehlstart',
)

// --- 2. Der Deckel, der den Tag gekostet hat ---------------------------------
const metas = [
  { agent: 'morgenbrief', status: 'error', grund: { schluessel: 'fehlstart' } },
  { agent: 'morgenbrief', status: 'error', grund: { schluessel: 'fehlstart' } },
]
const stand = bewerteTagesLaeufe(metas, 'morgenbrief')
check('zwei Fehlstarts zählen als Fehlstarts', stand.fehlstarts === 2)
check('und NICHT auf das echte Kontingent', stand.fehlschlaege === 0)
check(
  'nach zwei Fehlstarts darf der Morgenbrief weiter (der 18.08. wäre nicht passiert)',
  darfRoutineStarten({ ...stand, laeuft: false }) === true,
)
check(
  'aber nicht endlos — bei sechs ist Schluss',
  darfRoutineStarten({ erfolg: false, fehlschlaege: 0, fehlstarts: 6, laeuft: false }) === false,
)
check(
  'zwei ECHTE Fehlschläge sperren weiterhin',
  darfRoutineStarten({ erfolg: false, fehlschlaege: 2, fehlstarts: 0, laeuft: false }) === false,
)

// --- 3. Wachheit ------------------------------------------------------------
// Pünktlicher Tick: der Mac war durchgehend wach.
const laeuft = bewerteWachheit({ jetzt: T0 + 10 * TICK, letzterTick: T0 + 9 * TICK, wachSeit: T0, tickAbstandMs: TICK })
check('zehn Minuten durchgehend wach = startklar', laeuft.wach === true)
check('kein Schlaf gemeldet', laeuft.schlafErkannt === false)

// Der DarkWake vom 18.08.: Tick nach 40 Minuten statt nach einer.
const nachSchlaf = bewerteWachheit({
  jetzt: T0 + 40 * TICK,
  letzterTick: T0,
  wachSeit: T0 - 60 * TICK,
  tickAbstandMs: TICK,
})
check('eine 40-Minuten-Lücke gilt als Schlaf', nachSchlaf.schlafErkannt === true)
check('und setzt die Wachheit zurück', nachSchlaf.wach === false)
check('die Uhr läuft ab dem Aufwachen neu', nachSchlaf.wachSeit === T0 + 40 * TICK)

// Direkt nach dem Aufwachen: noch nicht, kurz danach: ja.
const kurzNach = bewerteWachheit({
  jetzt: T0 + WACH_KARENZ_MS - 1000,
  letzterTick: T0 + WACH_KARENZ_MS - 61_000,
  wachSeit: T0,
  tickAbstandMs: TICK,
})
check('eine Sekunde vor Ablauf der Karenz: noch nicht', kurzNach.wach === false)
const knappDanach = bewerteWachheit({
  jetzt: T0 + WACH_KARENZ_MS + 1000,
  letzterTick: T0 + WACH_KARENZ_MS - 59_000,
  wachSeit: T0,
  tickAbstandMs: TICK,
})
check('eine Sekunde danach: startklar', knappDanach.wach === true)

// Ein einzelner verspäteter Tick (Last, iCloud) ist kein Schlaf.
const traege = bewerteWachheit({ jetzt: T0 + 90_000, letzterTick: T0 + 5_000, wachSeit: T0, tickAbstandMs: TICK })
check('85 Sekunden Verspätung sind noch kein Schlaf', traege.schlafErkannt === false)

// Erster Tick nach dem Start: kein Vorgänger, also auch kein Schlafverdacht.
const erster = bewerteWachheit({ jetzt: T0, letzterTick: null, wachSeit: null, tickAbstandMs: TICK })
check('der erste Tick meldet keinen Schlaf', erster.schlafErkannt === false)
check('startet die Karenz aber trotzdem', erster.wach === false)

// --- 4. Die Zusammenfassung -------------------------------------------------
check('alles da = grün', startBereitAus({ wach: true, netz: true, chrome: true }).bereit === true)
check(
  'ohne Netz kein Start',
  startBereitAus({ wach: true, netz: false, chrome: true }).grund === 'kein Netz',
)
check(
  'frisch aufgewacht wird zuerst genannt',
  startBereitAus({ wach: false, netz: false, chrome: true }).fehlt[0] === 'Mac gerade erst aufgewacht',
)
// Der Fehler aus dem ersten Live-Lauf: Solange die Karenz laeuft, wird das Netz
// gar nicht abgefragt — dann darf auch kein „kein Netz" im Log stehen.
check(
  'ungeprueftes Netz wird nicht gemeldet',
  startBereitAus({ wach: false, netz: false, chrome: true }).grund === 'Mac gerade erst aufgewacht',
)
check(
  'Chrome zählt nur, wenn der Agent ihn braucht',
  startBereitAus({ wach: true, netz: true, chrome: false, brauchtChrome: false }).bereit === true &&
    startBereitAus({ wach: true, netz: true, chrome: false, brauchtChrome: true }).bereit === false,
)

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
