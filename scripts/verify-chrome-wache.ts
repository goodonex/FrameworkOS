/**
 * Drift-Wache fuer die Chrome-Wache (27.08.2026).
 *
 * Der Umbau kehrt das bisherige Verhalten um: Der Runner startet Chrome NICHT
 * mehr selbst, sondern meldet sich und holt nach. Zwei Fehler wuerden Kevin
 * genau da treffen, wo er es erst am naechsten Morgen merkt:
 *
 * 1. Eine Meldung, die im Minutentakt kommt, statt einmal pro Kaffee. Das war
 *    die urspruengliche Beschwerde ("jede Stunde geht Chrome auf") in neuer Form.
 * 2. Ein verpasster Uebergang: Chrome laeuft, aber nichts holt nach. Dann sitzt
 *    Kevin vor einem laufenden Chrome und einer stehenden Warteschlange.
 *
 * Zusaetzlich festgenagelt: der Autostart bleibt aus. Ein `!== '0'` an dieser
 * Stelle wuerde das alte Verhalten still zurueckholen.
 *
 * Start: npx tsx scripts/verify-chrome-wache.ts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ERINNERUNG_ABSTAND_MS,
  WACHE_AB_STUNDE,
  WACHE_BIS_STUNDE,
  beurteileWache,
  meldungsText,
} from '../runner/chromeWache.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0

function check(was: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ok   ${was}`)
  } else {
    fail++
    console.log(`  FEHL ${was}${detail ? ' — ' + detail : ''}`)
  }
}

const STUNDE = 9
const JETZT = 1_800_000_000_000

console.log('\nUebergaenge')
{
  const r = beurteileWache({ chromeDa: true, warVorherDa: false, jetzt: JETZT, stunde: STUNDE })
  check('Chrome erscheint -> aufholen', r.aufholen === true && r.erinnern === false, r.grund)
}
{
  const r = beurteileWache({ chromeDa: true, warVorherDa: true, jetzt: JETZT, stunde: STUNDE })
  check('Chrome laeuft weiter -> nichts tun', r.aufholen === false && r.erinnern === false, r.grund)
}
{
  const r = beurteileWache({ chromeDa: false, warVorherDa: true, letzteErinnerung: 0, jetzt: JETZT, stunde: STUNDE })
  check('Chrome fehlt, nie erinnert -> erinnern', r.erinnern === true, r.grund)
}

console.log('\nDie Meldung kommt einmal, nicht im Minutentakt')
{
  const eben = JETZT - 60_000
  const r = beurteileWache({ chromeDa: false, warVorherDa: false, letzteErinnerung: eben, jetzt: JETZT, stunde: STUNDE })
  check('eine Minute nach der Meldung -> Ruhe', r.erinnern === false, r.grund)
}
{
  const lange = JETZT - ERINNERUNG_ABSTAND_MS - 1000
  const r = beurteileWache({ chromeDa: false, warVorherDa: false, letzteErinnerung: lange, jetzt: JETZT, stunde: STUNDE })
  check('nach dem vollen Abstand -> wieder erinnern', r.erinnern === true, r.grund)
}
check('der Abstand ist mindestens eine halbe Stunde', ERINNERUNG_ABSTAND_MS >= 30 * 60 * 1000)

console.log('\nRuhezeiten gelten nur fuer die Meldung, nicht fuers Nachholen')
{
  const r = beurteileWache({ chromeDa: false, warVorherDa: false, letzteErinnerung: 0, jetzt: JETZT, stunde: 3 })
  check('nachts um drei -> keine Meldung', r.erinnern === false, r.grund)
}
{
  const r = beurteileWache({ chromeDa: true, warVorherDa: false, jetzt: JETZT, stunde: 23 })
  check('Chrome erscheint um 23 Uhr -> trotzdem aufholen', r.aufholen === true, r.grund)
}
check('Wachfenster deckt Kevins Arbeitstag ab', WACHE_AB_STUNDE <= 6 && WACHE_BIS_STUNDE >= 21)

console.log('\nDer Text muss Kevin sagen, was er tippen soll')
check('Meldung nennt den Befehl', meldungsText().includes('chrome-sync'))
check('Meldung nennt offene Vorgaenge, wenn es welche gibt', meldungsText(12).includes('12'))

console.log('\nDer Autostart bleibt aus')
{
  const quelle = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')
  check(
    'CHROME_AUTOSTART ist opt-in, nicht opt-out',
    /const CHROME_AUTOSTART = process\.env\.CHROME_AUTOSTART === '1'/.test(quelle),
  )
  check(
    'der Selbststart haengt am Schalter',
    /if \(CHROME_AUTOSTART && wach && netz && brauchtChrome && !chrome\)/.test(quelle),
  )
  check('die Wache tickt im Minutentakt', /setInterval\(\(\) => void chromeWacheTick\(\), WACH_TICK_MS\)/.test(quelle))
  check('beim Erscheinen wird das Postfach angestossen', /markeSchreib\('letzter-postfach-sync', 0\)/.test(quelle))
}

console.log(`\nverify-chrome-wache: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
