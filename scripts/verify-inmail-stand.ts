/**
 * Drift-Wache für die InMail-Pool-Ableitung (18.08.2026).
 * Start: npx tsx scripts/verify-inmail-stand.ts
 */
import { ausAltemWert, poolAbleitung } from '../app/src/cockpit/lib/inmailStand'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const zeilen = [
  { datum: '2026-08-12', inmails: 5 },
  { datum: '2026-08-13', inmails: 3 },
  { datum: '2026-08-14', inmails: 0 },
  { datum: '2026-08-17', inmails: 4 },
]

const abgeleitet = poolAbleitung({ wert: 150, standVom: '2026-08-12' }, zeilen, 5)
check('nur Tage NACH dem Stempel zählen (3+0+4=7)', abgeleitet.seitherGebucht === 7)
check('der Pool sinkt mit den Buchungen (150−7=143)', abgeleitet.pool === 143)
check('die Reichweite rechnet in Arbeitstagen (143/5=28)', abgeleitet.reichtTage === 28)

const ohneStempel = poolAbleitung(ausAltemWert(150), zeilen, 5)
check('ein Alt-Bestand ohne Stempel zieht nichts ab', ohneStempel.pool === 150 && ohneStempel.seitherGebucht === 0)

check('der Pool geht nie unter 0', poolAbleitung({ wert: 3, standVom: '2026-08-12' }, zeilen, 5).pool === 0)
check('Ration 0 hat keine Reichweite', poolAbleitung({ wert: 150, standVom: null }, [], 0).reichtTage === null)
check(
  'kaputte Zeilen zählen als 0',
  poolAbleitung({ wert: 10, standVom: '2026-08-12' }, [{ datum: '2026-08-13', inmails: Number.NaN }], 5).pool === 10,
)

console.log(`\nverify-inmail-stand: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
