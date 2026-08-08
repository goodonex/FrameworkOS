/**
 * Verifikation für die Kachel-Reihenfolge des Homescreens (O18 v2 d + e).
 *
 * Die gefährliche Stelle ist nicht das Sortieren, sondern die Drift: eine
 * gespeicherte Reihenfolge ist älter als die Registry. Wenn `ordneNach` einen
 * neuen Bereich nicht durchlässt, fehlt er auf dem Homescreen — und niemand
 * merkt es, weil nichts kaputtgeht, nur etwas fehlt.
 *
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-kachel-reihenfolge.ts
 */
import { PALETTEN_BEREICHE } from '../app/src/cockpit/lib/bereiche'
import { kontextReihenfolge, ordneNach, verschiebeVor } from '../app/src/cockpit/lib/kachelReihenfolge'

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

const b = (...pfade: string[]) => pfade.map((path) => ({ path }))
const pfade = (liste: Array<{ path: string }>) => liste.map((x) => x.path)

// --- ordneNach --------------------------------------------------------------
check('leere Reihenfolge lässt alles, wie es ist', pfade(ordneNach(b('/a', '/b', '/c'), [])), ['/a', '/b', '/c'])
check('gespeicherte Reihenfolge gewinnt', pfade(ordneNach(b('/a', '/b', '/c'), ['/c', '/a', '/b'])), ['/c', '/a', '/b'])
check(
  'neuer Bereich fehlt nicht, sondern landet hinten',
  pfade(ordneNach(b('/a', '/b', '/neu'), ['/b', '/a'])),
  ['/b', '/a', '/neu'],
)
check(
  'zwei neue behalten untereinander ihre Registry-Reihenfolge',
  pfade(ordneNach(b('/a', '/neu1', '/b', '/neu2'), ['/b', '/a'])),
  ['/b', '/a', '/neu1', '/neu2'],
)
check(
  'verschwundener Bereich stört nicht',
  pfade(ordneNach(b('/a', '/b'), ['/weg', '/b', '/a'])),
  ['/b', '/a'],
)

// --- verschiebeVor ----------------------------------------------------------
check('nach vorn', verschiebeVor(['/a', '/b', '/c'], '/c', '/a'), ['/c', '/a', '/b'])
check('nach hinten', verschiebeVor(['/a', '/b', '/c'], '/a', '/c'), ['/b', '/a', '/c'])
check('auf sich selbst ändert nichts', verschiebeVor(['/a', '/b'], '/a', '/a'), ['/a', '/b'])
check('unbekanntes Ziel hängt hinten an', verschiebeVor(['/a', '/b'], '/a', '/x'), ['/b', '/a'])
check('Länge bleibt erhalten', verschiebeVor(['/a', '/b', '/c'], '/b', '/a').length, 3)

// --- kontextReihenfolge -----------------------------------------------------
// Jede Stunde muss auf Pfade zeigen, die es wirklich gibt — sonst schiebt die
// Tageszeit ins Leere und die Reihenfolge bleibt still bei Registry-Standard.
const bekannt = new Set(PALETTEN_BEREICHE.map((x) => x.path))
for (const stunde of [0, 8, 10, 11, 14, 17, 18, 23]) {
  const front = kontextReihenfolge(stunde)
  check(`${stunde} Uhr: drei Ziele`, front.length, 3)
  check(`${stunde} Uhr: alle Ziele existieren`, front.filter((p) => !bekannt.has(p)), [])
}
check('morgens stehen die Freigaben vorn', kontextReihenfolge(7)[0], '/freigaben')
check('tagsüber steht Sales vorn', kontextReihenfolge(13)[0], '/sales')
check('abends steht Tracking vorn', kontextReihenfolge(20)[0], '/tracking')

// Die Tageszeit darf nur die ersten drei bewegen, nie etwas verschlucken.
const alle = PALETTEN_BEREICHE.filter((x) => x.path !== '/cockpit')
for (const stunde of [7, 13, 20]) {
  check(
    `${stunde} Uhr: keine Kachel geht verloren`,
    ordneNach(alle, kontextReihenfolge(stunde)).length,
    alle.length,
  )
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
