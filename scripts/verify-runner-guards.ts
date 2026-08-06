/**
 * Drift-Wache für O6 (docs/BACKLOG.md, 06.08.2026): Der LinkedIn-Sync darf nur
 * einmal gleichzeitig laufen — egal ob er über `POST /linkedin/sync` oder über
 * einen Auftrag aus `runner_jobs` kommt. Zwei parallele Voyager-Läufe auf
 * Kevins Konto sind das teuerste Risiko dieses Systems.
 *
 * Der Runner startet beim Import einen HTTP-Server und pollt Supabase; ein
 * echter Aufruf von `fuehreJobAus` ist von hier nicht ohne Seiteneffekte
 * möglich. Geprüft wird deshalb die Struktur — flach, aber sie schlägt an,
 * wenn der Guard aus einem der beiden Pfade verschwindet.
 *
 * Start: npx tsx scripts/verify-runner-guards.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const runner = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')

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

/** Schneidet den Rumpf einer Funktion bis zur passenden schließenden Klammer heraus. */
function rumpf(quelle: string, kopf: string): string {
  const start = quelle.indexOf(kopf)
  if (start < 0) return ''
  let tiefe = 0
  for (let i = quelle.indexOf('{', start); i < quelle.length; i++) {
    if (quelle[i] === '{') tiefe++
    else if (quelle[i] === '}' && --tiefe === 0) return quelle.slice(start, i + 1)
  }
  return quelle.slice(start)
}

const jobPfad = rumpf(runner, 'async function fuehreJobAus(job)')
check('0 fuehreJobAus gefunden', jobPfad.length > 0, true)

// 1. Der Job-Pfad prüft, setzt und räumt auf.
check('1 Job-Pfad prüft den Guard', jobPfad.includes('if (linkedinSyncRunning) throw'), true)
check('1b Job-Pfad setzt den Guard', jobPfad.includes('linkedinSyncRunning = true'), true)
check('1c Job-Pfad räumt in finally auf', /finally\s*\{\s*linkedinSyncRunning = false/.test(jobPfad), true)

// 2. Reihenfolge: erst Guard, dann Voyager. Andersherum wäre er wirkungslos.
const guardPos = jobPfad.indexOf('linkedinSyncRunning = true')
const syncPos = jobPfad.indexOf('syncThreads(')
check('2 Guard steht vor syncThreads', guardPos > -1 && guardPos < syncPos, true)

// 3. Der HTTP-Pfad hat ihn weiterhin.
check('3 HTTP-Pfad antwortet mit 409', runner.includes("json(res, 409, { error: 'LinkedIn-Sync läuft bereits' })"), true)

// 4. Beide Pfade teilen sich genau ein Flag — kein zweites daneben.
check('4 genau eine Deklaration', (runner.match(/let linkedinSyncRunning/g) ?? []).length, 1)

// 5. Der Agenten-Pfad behält seinen eigenen Guard (der war nie das Problem).
check('5 agent_run prüft weiterhin auf laufende Agenten', jobPfad.includes('läuft bereits`'), true)

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
