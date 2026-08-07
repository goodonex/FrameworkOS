/**
 * Verifikation für O17 Schritt 4 (docs/BACKLOG.md): Der Tages-Guard der
 * Routinen und die Sichtbarkeit eines Fehlschlags im Cockpit.
 *
 * Der Kern in einem Satz: **Ein gescheiterter Lauf darf nicht als „heute schon
 * gelaufen" gelten** — genau daran hat sich der Fehler neun Tage lang selbst
 * zugedeckt.
 *
 * Start: npx tsx scripts/verify-routine-guard.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { bewerteTagesLaeufe, darfRoutineStarten } from '../runner/routineGuard.mjs'
import { agentenBefund, istWerktag, tagesStempel } from '../app/src/cockpit/lib/agentenGesundheit'
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

// ---- 1. Tagesbilanz aus den Frontmatter-Köpfen ----
{
  const metas = [
    { agent: 'morgenbrief', status: 'error' },
    { agent: 'morgenbrief', status: 'done' },
    { agent: 'dream-check', status: 'error' },
    { agent: 'morgenbrief', status: 'running' },
  ]
  check('1 Erfolg erkannt', bewerteTagesLaeufe(metas, 'morgenbrief'), { erfolg: true, fehlschlaege: 1 })
  check('1b fremder Agent zählt nicht mit', bewerteTagesLaeufe(metas, 'dream-check'), {
    erfolg: false,
    fehlschlaege: 1,
  })
  check('1c unbekannter Agent', bewerteTagesLaeufe(metas, 'gibtsnicht'), { erfolg: false, fehlschlaege: 0 })
  check('1d leere Liste', bewerteTagesLaeufe([], 'morgenbrief'), { erfolg: false, fehlschlaege: 0 })
  check('1e undefined überlebt', bewerteTagesLaeufe(undefined, 'morgenbrief'), { erfolg: false, fehlschlaege: 0 })
  check(
    '1f laufender Lauf ist weder Erfolg noch Fehlschlag',
    bewerteTagesLaeufe([{ agent: 'x', status: 'running' }], 'x'),
    { erfolg: false, fehlschlaege: 0 },
  )
  // Die Falle des alten Guards: Namens-Teilstring. `includes('antwort-entwuerfe')`
  // hätte `linkedin-antwort-entwuerfe` mitgezählt.
  check(
    '1g exakter Name, kein Teilstring',
    bewerteTagesLaeufe([{ agent: 'linkedin-antwort-entwuerfe', status: 'done' }], 'antwort-entwuerfe'),
    { erfolg: false, fehlschlaege: 0 },
  )
}

// ---- 2. Die Startfreigabe ----
{
  const basis = { erfolg: false, fehlschlaege: 0, laeuft: false, maxVersuche: 2 }
  check('2 nichts gelaufen → starten', darfRoutineStarten(basis), true)
  check('2b DER FALL: ein Fehlschlag → erneut versuchen', darfRoutineStarten({ ...basis, fehlschlaege: 1 }), true)
  check('2c Deckel erreicht → schweigen', darfRoutineStarten({ ...basis, fehlschlaege: 2 }), false)
  check('2d über dem Deckel', darfRoutineStarten({ ...basis, fehlschlaege: 5 }), false)
  check('2e Erfolg heute → fertig', darfRoutineStarten({ ...basis, erfolg: true }), false)
  check('2f läuft gerade → kein zweiter', darfRoutineStarten({ ...basis, laeuft: true }), false)
  check(
    '2g Erfolg schlägt offenen Versuchsstand',
    darfRoutineStarten({ ...basis, erfolg: true, fehlschlaege: 1 }), false,
  )
  check('2h Vorgabe zwei Versuche ohne maxVersuche', darfRoutineStarten({ erfolg: false, fehlschlaege: 2, laeuft: false }), false)
}

// ---- 3. Sichtbarkeit im Cockpit ----
const heute = tagesStempel(new Date('2026-08-07T09:00:00Z'))
const run = (id: string, agent: string, status: RunSummary['status'], started: string): RunSummary => ({
  id,
  agent,
  status,
  started,
  finished: '',
  preview: '',
})

{
  const jetzt = new Date('2026-08-07T09:00:00Z')
  const runs = [
    run(`${heute}-070346-morgenbrief`, 'morgenbrief', 'error', '2026-08-07T05:03:46Z'),
    run(`${heute}-060301-linkedin-antwort-entwuerfe`, 'linkedin-antwort-entwuerfe', 'error', '2026-08-07T04:03:01Z'),
    run(`${heute}-111609-dream-check`, 'dream-check', 'done', '2026-08-07T09:16:09Z'),
    run('2026-08-06-070008-morgenbrief', 'morgenbrief', 'error', '2026-08-06T05:00:08Z'),
  ]
  const b = agentenBefund(runs, jetzt)
  check('3 nur heutige Fehlschläge', b.fehlschlaege.length, 2)
  check('3b gestern bleibt draußen', b.fehlschlaege.some((r) => r.id.startsWith('2026-08-06')), false)
  check('3c jüngster zuerst', b.fehlschlaege[0].agent, 'morgenbrief')
  check('3d Erfolge', b.erfolgreich, ['dream-check'])
  check('3e nichts ausstehend', b.ausstehend, [])
  check('3f Meldung nennt beide', b.meldung, '2 Agenten sind heute gescheitert: morgenbrief, linkedin-antwort-entwuerfe')
}

{
  // Ein einzelner Fehlschlag — die häufigste Lage.
  const b = agentenBefund(
    [run(`${heute}-070346-morgenbrief`, 'morgenbrief', 'error', '2026-08-07T05:03:46Z')],
    new Date('2026-08-07T09:00:00Z'),
  )
  check('4 Einzahl-Formulierung', b.meldung, 'morgenbrief ist heute gescheitert')
  check('4b zwei fehlen noch', b.ausstehend, ['linkedin-antwort-entwuerfe', 'dream-check'])
}

{
  // Alles gut → keine Zeile. Das ist der Normalfall und darf nicht nerven.
  const b = agentenBefund(
    [run(`${heute}-070346-morgenbrief`, 'morgenbrief', 'done', '2026-08-07T05:03:46Z')],
    new Date('2026-08-07T09:00:00Z'),
  )
  check('5 keine Meldung ohne Fehlschlag', b.meldung, null)
}

{
  // Derselbe Agent zweimal gescheitert = ein Name in der Meldung, nicht zwei.
  const b = agentenBefund(
    [
      run(`${heute}-070346-morgenbrief`, 'morgenbrief', 'error', '2026-08-07T05:03:46Z'),
      run(`${heute}-073000-morgenbrief`, 'morgenbrief', 'error', '2026-08-07T05:30:00Z'),
    ],
    new Date('2026-08-07T09:00:00Z'),
  )
  check('6 zwei Läufe, ein Name', b.meldung, 'morgenbrief ist heute gescheitert')
  check('6b beide Läufe gezählt', b.fehlschlaege.length, 2)
}

{
  check('7 leere Liste bleibt still', agentenBefund([], new Date('2026-08-07T09:00:00Z')).meldung, null)
  check('7b Werktag', istWerktag(new Date('2026-08-07T09:00:00Z')), true)
  check('7c Samstag', istWerktag(new Date('2026-08-08T09:00:00Z')), false)
  check('7d Sonntag', istWerktag(new Date('2026-08-09T09:00:00Z')), false)
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
