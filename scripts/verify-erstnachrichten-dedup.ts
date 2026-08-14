/**
 * Drift-Wache für die Entdopplung der Erstnachrichten (14.08.2026).
 *
 * Der Fehler, der das nötig gemacht hat, war leise und teuer: Eine umformulierte
 * Gruppen-Überschrift im Vault ließ den Spiegel 27 Leads ein zweites Mal
 * anlegen — die Kachel meldete 144 statt 117 offene Erstnachrichten, und ein
 * längst abgehakter Kontakt stand wieder als frischer Lead in der Liste.
 *
 * Geprüft wird deshalb beides: dass eine Person nur einmal übrig bleibt, und
 * dass der abgehakte Stand dabei nicht verloren geht.
 *
 * Start: npx tsx scripts/verify-erstnachrichten-dedup.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  entdoppleErstnachrichten,
  namensSchluessel,
  type EntdoppelbareZeile,
} from '../app/src/cockpit/lib/erstnachrichtenDedup'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

interface Zeile extends EntdoppelbareZeile {
  gruppe: string
  nachricht: string
}

function zeile(teil: Partial<Zeile> & { id: string; name: string }): Zeile {
  return {
    status: 'offen',
    sent_at: null,
    sort_index: 0,
    last_synced_at: '2026-08-14T09:00:00.000Z',
    gruppe: '',
    nachricht: '',
    ...teil,
  }
}

// --- Der reale Fall: dieselbe Person, zwei Gruppen-Schreibweisen -------------
{
  const alt = zeile({
    id: 'a',
    name: 'Steven Koller',
    gruppe: 'Gruppe 1 — Erste Charge · 27 Kontakte (raus am 13.07., nur Sabine Keulertz noch offen)',
    nachricht: 'alt',
    last_synced_at: '2026-08-12T10:40:40.907Z',
  })
  const neu = zeile({
    id: 'b',
    name: 'Steven Koller',
    gruppe: 'Gruppe 1 — Erste Charge · 27 Kontakte (raus 13./14.07.)',
    nachricht: 'neu',
    last_synced_at: '2026-08-14T09:13:51.424Z',
  })

  const raus = entdoppleErstnachrichten([alt, neu])
  check('eine Person, eine Zeile', raus.length === 1, `bekam ${raus.length}`)
  check('der frischere Spiegel-Stand gewinnt den Inhalt', raus[0]?.nachricht === 'neu', `bekam "${raus[0]?.nachricht}"`)
}

// --- Der teure Fall: abgehakt darf nicht zurückfallen ------------------------
{
  const abgehakt = zeile({
    id: 'a',
    name: 'Roland Wettstein',
    status: 'gesendet',
    sent_at: '2026-07-29T15:36:33.433Z',
    last_synced_at: '2026-08-12T10:40:40.907Z',
  })
  const frisch = zeile({ id: 'b', name: 'Roland Wettstein', last_synced_at: '2026-08-14T09:13:51.424Z' })

  const raus = entdoppleErstnachrichten([abgehakt, frisch])
  check('der weiteste Stand überlebt', raus[0]?.status === 'gesendet', `bekam "${raus[0]?.status}"`)
  check('das Versanddatum kommt mit', raus[0]?.sent_at === '2026-07-29T15:36:33.433Z')
  check('die überlebende Zeile ist die frisch gespiegelte', raus[0]?.id === 'b', `bekam "${raus[0]?.id}"`)
}

// --- Was NICHT passieren darf: Zusammenlegen fremder Leute -------------------
{
  const raus = entdoppleErstnachrichten([
    zeile({ id: 'a', name: 'Michaela Beer', sort_index: 0 }),
    zeile({ id: 'b', name: 'Michael Beer', sort_index: 1 }),
    zeile({ id: 'c', name: '  michaela   beer ', sort_index: 2 }),
  ])
  check('ähnliche Namen bleiben getrennt', raus.length === 2, `bekam ${raus.length}`)
  check('Groß-/Kleinschreibung und Leerraum zählen nicht', namensSchluessel('  Michaela   BEER ') === 'michaela beer')
}

// --- Reihenfolge und Unversehrtheit -----------------------------------------
{
  const eingabe = [
    zeile({ id: 'a', name: 'Erste', sort_index: 0 }),
    zeile({ id: 'b', name: 'Zweite', sort_index: 1 }),
    zeile({ id: 'c', name: 'Dritte', sort_index: 2 }),
  ]
  const raus = entdoppleErstnachrichten(eingabe)
  check('ohne Doppel bleibt die Liste unverändert', raus.map((r) => r.id).join(',') === 'a,b,c')
  check('ohne Doppel werden keine Kopien erzeugt', raus[0] === eingabe[0])
}

// --- Die Verdrahtung: greift die Entdopplung überhaupt? ----------------------
{
  const hook = readFileSync(join(wurzel, 'app/src/hooks/useErstnachrichten.ts'), 'utf8')
  check(
    'der Hook entdoppelt, bevor irgendeine Kachel zählt',
    /setItems\(entdoppleErstnachrichten\(/.test(hook),
    'Alle Verbraucher (Kachel, Fenster, Arbeitsmodus, Funnel-Stufen) hängen an items.',
  )

  const runner = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')
  check(
    'der Spiegel schreibt nicht mehr gegen die Gruppen-Überschrift',
    /on_conflict=\$\{konflikt\}/.test(runner) && /spiegle\('brand_id,name'\)/.test(runner),
  )

  const migration = readFileSync(
    join(wurzel, 'supabase/migrations/0071_erstnachrichten_schluessel_ohne_gruppe.sql'),
    'utf8',
  )
  check(
    'Migration 0071 legt den gruppen-freien Schlüssel an',
    /unique index if not exists linkedin_erstnachrichten_brand_name_key/.test(migration),
  )
}

console.log(`\nverify-erstnachrichten-dedup: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
