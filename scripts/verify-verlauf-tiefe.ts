/**
 * Drift-Wache fuer den Verlauf-Tiefenlauf (27.08.2026).
 *
 * Der Lauf hat die teuerste stille Luecke des Systems geschlossen: 261 Threads
 * trugen einen Verlauf der Laenge 1, weil die Postfach-Liste je Gespraech nur
 * die letzte Nachricht liefert. Danach konnte leads-sync fuer denselben Lead nie
 * "Erstnachricht" UND "Antwort erhalten" ableiten - das Board zeigte an dieser
 * Kante 0,0 Prozent, obwohl jeder Vierte geantwortet hatte.
 *
 * Zwei Details haben den ersten Versuch gekostet, und genau sie werden hier
 * festgenagelt, weil sie beim naechsten Umbau still verschwinden koennten:
 *
 * 1. Die strenge Kodierung. `encodeURIComponent` laesst Klammern stehen, in
 *    einer Voyager-Variablenliste sind sie Syntax - HTTP 400.
 * 2. Kein syncToken. Mit Token liefert dieselbe Query nur das Delta.
 *
 * Start: npx tsx scripts/verify-verlauf-tiefe.ts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brauchtTiefe, conversationUrn, strengKodiert, threadIdAus } from '../runner/linkedin/verlaufTiefe.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0
const check = (was: string, ok: boolean, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${was}`) }
  else { fail++; console.log(`  FEHL ${was}${detail ? ' — ' + detail : ''}`) }
}

console.log('\nDie Kodierung, an der der erste Versuch scheiterte')
check('Klammern werden kodiert', strengKodiert('(a)') === '%28a%29', strengKodiert('(a)'))
check('Doppelpunkte werden kodiert', strengKodiert('urn:li') === 'urn%3Ali')
check('Komma wird kodiert', strengKodiert('a,b') === 'a%2Cb')
check('Gleichheitszeichen wird kodiert (Base64-Endung)', strengKodiert('2-ABC==').endsWith('%3D%3D'))
check(
  'strenger als encodeURIComponent',
  strengKodiert('(a)') !== encodeURIComponent('(a)'),
  'sonst antwortet Voyager mit HTTP 400',
)

console.log('\nDer conversation-URN')
check('thread_key-Praefix faellt weg', threadIdAus('urn:li:messagingThread:2-XYZ==') === '2-XYZ==')
check('ohne Praefix bleibt der Wert', threadIdAus('2-XYZ==') === '2-XYZ==')
{
  const urn = conversationUrn('urn:li:fsd_profile:AAA', 'urn:li:messagingThread:2-XYZ==')
  check('URN traegt Mailbox und Thread', urn === 'urn:li:msg_conversation:(urn:li:fsd_profile:AAA,2-XYZ==)', urn)
}

console.log('\nWer wird nachgezogen')
check('Verlauf mit einer Nachricht', brauchtTiefe({ verlauf: [{}] }) === true)
check('kein Verlauf', brauchtTiefe({}) === true)
check('Verlauf mit zweien bleibt liegen', brauchtTiefe({ verlauf: [{}, {}] }) === false)

console.log('\nDas Skript darf den syncToken nicht wieder einbauen')
{
  const quelle = readFileSync(join(wurzel, 'scripts/verlauf-nachziehen.mjs'), 'utf8')
  check(
    'kein syncToken in der Anfrage',
    !/syncToken:/.test(quelle.replace(/^\s*\*.*$/gm, '')),
    'mit Token liefert die Query nur das Delta statt des vollen Verlaufs',
  )
  check('die strenge Kodierung wird benutzt', /strengKodiert/.test(quelle))
  check('eine Pause zwischen den Anfragen', /setTimeout\(r, \d{3,}\)/.test(quelle))
}

console.log(`\nverify-verlauf-tiefe: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
