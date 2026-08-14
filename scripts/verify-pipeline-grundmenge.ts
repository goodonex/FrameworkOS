/**
 * Drift-Wache: Kennzahl-Kacheln und Kanban rechnen auf DERSELBEN Grundmenge.
 *
 * Befund vom 14.08.2026: Über den Pipeline-Spalten stand „Gesamt in Pipeline
 * 44", die Spalten darunter ergaben zusammen 37. Die Differenz waren Kevins
 * sieben Ansprechpartner (Person mit `parent_company_id`): das Kanban lässt
 * sie über `applyCrmFilters` bewusst weg — sie gehören zu ihrer Firma —, die
 * Kachel zählte sie mit. Und weil dieselbe Kachel der
 * „Filter-zurücksetzen"-Knopf ist, versprach sie sieben Karten, die es nie zu
 * sehen gab.
 *
 * Gegen die echten Prod-Zahlen vom 14.08. gerechnet: 44 Kontakte, davon 7
 * Ansprechpartner (5x first_contact, 2x deal) → 37 Karten, Erstkontakt 31,
 * Deal 1.
 *
 * Start: npx tsx scripts/verify-pipeline-grundmenge.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { nurPipelineKontakte } from '../app/src/lib/crmFilters'
import type { Contact } from '../app/src/types/db'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(
      `FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`,
    )
  }
}

/** Minimal-Kontakt; nur die Felder, die die Regel liest. */
function k(
  id: string,
  contact_type: 'company' | 'person',
  parent_company_id: string | null,
  pipeline_stage = 'first_contact',
): Contact {
  return { id, contact_type, parent_company_id, pipeline_stage } as unknown as Contact
}

// --- Die Regel selbst -------------------------------------------------------
check('Firma zaehlt', nurPipelineKontakte([k('a', 'company', null)]).length, 1)
check('freistehende Person zaehlt', nurPipelineKontakte([k('b', 'person', null)]).length, 1)
check(
  'Ansprechpartner zaehlt NICHT',
  nurPipelineKontakte([k('c', 'person', 'firma-1')]).length,
  0,
)
check(
  'Firma mit parent bleibt drin (Tochterfirma ist eine eigene Karte)',
  nurPipelineKontakte([k('d', 'company', 'firma-1')]).length,
  1,
)
check('leere Liste', nurPipelineKontakte([]).length, 0)

// --- Kevins Bestand vom 14.08.2026 (Prod, per count=exact gegengeprueft) ----
const bestand: Contact[] = [
  ...Array.from({ length: 31 }, (_, i) => k(`f${i}`, 'company', null, 'first_contact')),
  ...Array.from({ length: 5 }, (_, i) => k(`fp${i}`, 'person', 'firma-x', 'first_contact')),
  ...Array.from({ length: 4 }, (_, i) => k(`g${i}`, 'company', null, 'conversation')),
  k('p0', 'company', null, 'proposal'),
  k('d0', 'company', null, 'deal'),
  ...Array.from({ length: 2 }, (_, i) => k(`dp${i}`, 'person', 'firma-y', 'deal')),
]
check('Bestand hat 44 Zeilen', bestand.length, 44)
const karten = nurPipelineKontakte(bestand)
check('Kanban-Grundmenge = 37', karten.length, 37)
check('Erstkontakt 31', karten.filter((c) => c.pipeline_stage === 'first_contact').length, 31)
check('Gespraech 4', karten.filter((c) => c.pipeline_stage === 'conversation').length, 4)
check('Pitch 1', karten.filter((c) => c.pipeline_stage === 'proposal').length, 1)
check('Deal 1', karten.filter((c) => c.pipeline_stage === 'deal').length, 1)
check(
  'Spaltensumme = Kachel',
  ['first_contact', 'conversation', 'proposal', 'deal'].reduce(
    (n, s) => n + karten.filter((c) => c.pipeline_stage === s).length,
    0,
  ),
  karten.length,
)

// --- Und die Kachel benutzt die Regel wirklich ------------------------------
const salesMode = readFileSync(join(wurzel, 'app/src/pages/sales/SalesMode.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
check(
  'pipelineStats rechnet auf der Kanban-Grundmenge',
  /const items = nurPipelineKontakte\(contacts\.items\)/.test(salesMode),
  true,
)
const crm = readFileSync(join(wurzel, 'app/src/lib/crmFilters.ts'), 'utf8')
check(
  'applyCrmFilters nutzt dieselbe Funktion (eine Wahrheit)',
  /const pipelineOnly = nurPipelineKontakte\(items\)/.test(crm),
  true,
)

console.log(`\nverify-pipeline-grundmenge: ${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
