/**
 * Verifikation für Wargame Zug 4 (docs/wargames/sales-arbeitsmodus.md) —
 * „die gefährlichste Stelle des Plans". Reine Logik, Supabase-Client ist im
 * Testlauf `null` (siehe app/src/lib/supabase.ts), daher kein Netzaufruf.
 * Start: npx tsx scripts/verify-arbeitsmodus-tracking.ts
 */
import { erledigePosten, metrikFeldFuer } from '../app/src/cockpit/lib/arbeitsmodusTracking'
import type { ArbeitsmodusTrackingDeps } from '../app/src/cockpit/lib/arbeitsmodusTracking'
import type { Posten } from '../app/src/cockpit/lib/prioritaet'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

function makePosten(overrides: Partial<Posten>): Posten {
  return {
    id: 'thread:t1',
    spur: 'antwort',
    name: 'Test',
    text: 'Text',
    timestamp: null,
    ...overrides,
  }
}

interface Aufruf {
  feld?: string
  delta?: number
  erstnachricht?: string
  followup?: string
  loom?: string
  task?: string
  dauerSekunden?: number
}

function makeDeps(): { deps: ArbeitsmodusTrackingDeps; aufrufe: Aufruf[] } {
  const aufrufe: Aufruf[] = []
  const deps: ArbeitsmodusTrackingDeps = {
    bump: (field, delta) => aufrufe.push({ feld: field, delta }),
    erstnachrichtGesendet: (id) => {
      aufrufe.push({ erstnachricht: id })
    },
    followupErledigt: (id) => {
      aufrufe.push({ followup: id })
    },
    loomVerschickt: (id) => {
      aufrufe.push({ loom: id })
    },
    taskErledigt: (id) => {
      aufrufe.push({ task: id })
    },
    schreibeDauer: ({ sekunden }) => {
      aufrufe.push({ dauerSekunden: sekunden })
    },
  }
  return { deps, aufrufe }
}

// 1. Mapping-Tabelle Spur → Feld, wörtlich aus dem Plan.
check('1a erstnachricht -> li_nachrichten', metrikFeldFuer('erstnachricht'), 'li_nachrichten')
check('1b followup -> li_followups', metrikFeldFuer('followup'), 'li_followups')
check('1c loom -> looms', metrikFeldFuer('loom'), 'looms')
check('1d anfrage -> li_anfragen', metrikFeldFuer('anfrage'), 'li_anfragen')
check('1e inmail -> inmails', metrikFeldFuer('inmail'), 'inmails')
check('1f antwort -> keins', metrikFeldFuer('antwort'), null)
check('1g kundenaufgabe -> keins', metrikFeldFuer('kundenaufgabe'), null)
check('1h kunde_liegt -> keins', metrikFeldFuer('kunde_liegt'), null)

// 2. erstnachricht: genau EIN Feld +1, Statuswechsel auf die richtige Zeile, Dauer immer geschrieben.
{
  const { deps, aufrufe } = makeDeps()
  await erledigePosten({ posten: makePosten({ id: 'erstnachricht:e1', spur: 'erstnachricht' }), sekunden: 12 }, deps)
  check('2a drei aufrufe (status + bump + dauer)', aufrufe.length, 3)
  check('2b erstnachricht-id ohne praefix', aufrufe[0]?.erstnachricht, 'e1')
  check('2c bump li_nachrichten +1', aufrufe[1], { feld: 'li_nachrichten', delta: 1 })
  check('2d dauer immer geschrieben', aufrufe[2]?.dauerSekunden, 12)
}

// 3. antwort: KEIN Feld-Bump, keine Statusaktion — nur die Dauer wird geschrieben (zählt für ALLE Posten).
{
  const { deps, aufrufe } = makeDeps()
  await erledigePosten({ posten: makePosten({ id: 'thread:t1', spur: 'antwort' }), sekunden: 5 }, deps)
  check('3a nur die dauer', aufrufe.length, 1)
  check('3b dauer korrekt', aufrufe[0]?.dauerSekunden, 5)
}

// 4. kundenaufgabe: Task wird erledigt, aber KEIN Metrik-Bump.
{
  const { deps, aufrufe } = makeDeps()
  await erledigePosten({ posten: makePosten({ id: 'task:tk1', spur: 'kundenaufgabe' }), sekunden: 30 }, deps)
  check('4a zwei aufrufe (task + dauer, kein bump)', aufrufe.length, 2)
  check('4b task-id ohne praefix', aufrufe[0]?.task, 'tk1')
}

// 5. kunde_liegt: kein Status/Bump — nur die Dauer.
{
  const { deps, aufrufe } = makeDeps()
  await erledigePosten({ posten: makePosten({ id: 'liegt:p1', spur: 'kunde_liegt' }), sekunden: 8 }, deps)
  check('5 kunde_liegt nur dauer', aufrufe.length, 1)
}

// 6. loom: Statuswechsel auf die richtige Thread-ID + genau EIN Bump auf 'looms'.
{
  const { deps, aufrufe } = makeDeps()
  await erledigePosten({ posten: makePosten({ id: 'loom:t9', spur: 'loom' }), sekunden: 90 }, deps)
  check('6a drei aufrufe (status + bump + dauer)', aufrufe.length, 3)
  check('6b loom-id ohne praefix', aufrufe[0]?.loom, 't9')
  check('6c bump looms +1', aufrufe[1], { feld: 'looms', delta: 1 })
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
