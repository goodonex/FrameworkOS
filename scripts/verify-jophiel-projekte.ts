/**
 * Drift-Wache für die Klammer Uriel ↔ Jophiel (25.08.2026).
 *
 * Ein von Hand eingetippter `leadName` trifft auf einen Namen aus LinkedIn.
 * Zwei Fehler wären hier teuer, und sie sind nicht gleich teuer:
 *
 * - **Karte weglassen, weil kein Name passt** — Kevin hat die Seite bauen
 *   lassen und sieht sie nicht. Das darf nie passieren.
 * - **Karte falsch verknüpfen** — die Website hängt am falschen Menschen.
 *   Bei doppelten Namen (14 im Bestand) wird deshalb NICHT geraten.
 *
 * Start: npx tsx scripts/verify-jophiel-projekte.ts
 */
import {
  mitVorschau,
  verknuepfeProjekte,
  type JophielProjekt,
} from '../app/src/cockpit/lib/jophielProjekte'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

function projekt(teil: Partial<JophielProjekt> = {}): JophielProjekt {
  return {
    slug: 'staffel-immobilien',
    name: 'Staffel Immobilien',
    leadName: 'Hartmut Schneider',
    status: 'needs-review',
    createdAt: '2026-08-24T13:59:03.358Z',
    note: '',
    oldUrl: 'https://staffel-immobilien.de',
    hatShot: true,
    hatAltShot: true,
    vorschauUrl: 'http://127.0.0.1:4100/preview/staffel-immobilien',
    ...teil,
  }
}

/* ── Der Normalfall ────────────────────────────────────────────────────── */

{
  const v = verknuepfeProjekte([projekt()], [{ id: 'l1', name: 'Hartmut Schneider' }])
  check('gleicher Name trifft', v[0].leadId === 'l1' && v[0].leadName === 'Hartmut Schneider')
}

/* ── Schreibweisen, die in Handeinträgen wirklich vorkommen ────────────── */

for (const [beschreibung, geschrieben] of [
  ['Kleinschreibung', 'hartmut schneider'],
  ['GROSSSCHREIBUNG', 'HARTMUT SCHNEIDER'],
  ['Doppel-Leerzeichen', 'Hartmut  Schneider'],
  ['Leerzeichen aussen', '  Hartmut Schneider  '],
  ['Zeilenumbruch mittendrin', 'Hartmut\nSchneider'],
  ['ein Komma zu viel', 'Hartmut Schneider,'],
] as const) {
  const v = verknuepfeProjekte([projekt({ leadName: geschrieben })], [{ id: 'l1', name: 'Hartmut Schneider' }])
  check(`${beschreibung} trifft trotzdem`, v[0].leadId === 'l1', JSON.stringify(geschrieben))
}

{
  // Umlaute: Jophiels Feld tippt Kevin, Uriels Name kommt aus LinkedIn.
  const v = verknuepfeProjekte(
    [projekt({ leadName: 'Dario Scafaro Gücük' })],
    [{ id: 'l9', name: 'Dario Scafaro Gücük' }],
  )
  check('Umlaute treffen', v[0].leadId === 'l9')
}

/* ── Kein Treffer heisst „ohne Lead", NIE „weglassen" ──────────────────── */

{
  const v = verknuepfeProjekte([projekt({ leadName: 'Jemand Anders' })], [{ id: 'l1', name: 'Hartmut Schneider' }])
  check('ohne Treffer bleibt die Karte bestehen', v.length === 1)
  check('… und zwar unverknüpft', v[0].leadId === null && v[0].leadName === null)
}

{
  const v = verknuepfeProjekte([projekt({ leadName: '' })], [{ id: 'l1', name: 'Hartmut Schneider' }])
  check('leerer leadName: Karte bleibt, ohne Verknüpfung', v.length === 1 && v[0].leadId === null)
}

{
  const v = verknuepfeProjekte([projekt()], [])
  check('ohne einen einzigen Lead bleibt die Karte bestehen', v.length === 1 && v[0].leadId === null)
}

{
  const v = verknuepfeProjekte([], [{ id: 'l1', name: 'Hartmut Schneider' }])
  check('ohne Projekte stürzt nichts ab', v.length === 0)
}

/* ── Doppelte Namen: lieber unverknüpft als falsch ─────────────────────── */

{
  const v = verknuepfeProjekte(
    [projekt({ leadName: 'Michael Müller' })],
    [
      { id: 'l1', name: 'Michael Müller' },
      { id: 'l2', name: 'michael  müller' },
    ],
  )
  check(
    'bei zwei Leads gleichen Namens wird NICHT geraten',
    v[0].leadId === null,
    `verknüpft mit ${v[0].leadId}`,
  )
  check('die Karte verschwindet deswegen aber nicht', v.length === 1)
}

{
  // Derselbe Lead zweimal in der Liste ist keine Mehrdeutigkeit.
  const lead = { id: 'l1', name: 'Hartmut Schneider' }
  const v = verknuepfeProjekte([projekt()], [lead, lead])
  check('derselbe Lead doppelt in der Liste gilt nicht als mehrdeutig', v[0].leadId === 'l1')
}

{
  const v = verknuepfeProjekte(
    [projekt({ leadName: '   ' })],
    [
      { id: 'l1', name: '' },
      { id: 'l2', name: '  ' },
    ],
  )
  check('leere Namen bilden keinen gemeinsamen Schlüssel', v[0].leadId === null)
}

/* ── Nur zeigen, wo es etwas zu zeigen gibt ────────────────────────────── */

{
  const v = verknuepfeProjekte(
    [projekt({ slug: 'mit', hatShot: true }), projekt({ slug: 'ohne', hatShot: false })],
    [],
  )
  const sichtbar = mitVorschau(v)
  check('ohne Aufnahme keine Vorschau-Karte', sichtbar.length === 1 && sichtbar[0].projekt.slug === 'mit')
  check('die Reihenfolge bleibt, wie Jophiel sie liefert', mitVorschau(v).every((x, i) => x.projekt.slug === ['mit'][i]))
}

{
  // Ein Projekt ohne Shot verschwindet aus dem Streifen - aber der Lead
  // dahinter steht weiter im Funnel unter "Loom offen". Nichts geht verloren.
  const v = verknuepfeProjekte([projekt({ hatShot: false })], [{ id: 'l1', name: 'Hartmut Schneider' }])
  check('die Verknüpfung besteht auch ohne Bild', v[0].leadId === 'l1')
  check('sie taucht nur nicht im Vorschau-Streifen auf', mitVorschau(v).length === 0)
}

console.log(`\nverify-jophiel-projekte: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
