/**
 * Verifikation für Wargame Zug 6 (docs/wargames/sales-arbeitsmodus.md).
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-kundenarbeit.ts
 */
import { kundeLiegtPosten, kundenaufgabenPosten, liegendeProjekte } from '../app/src/cockpit/lib/kundenarbeit'
import type { Contact, DeliverProject, Task } from '../app/src/types/db'

const NOW = new Date('2026-07-29T12:00:00Z')
const dayAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    brand_id: 'brand-1',
    contact_id: null,
    project_id: null,
    title: 'Aufgabe',
    notes: '',
    due_at: null,
    status: 'open',
    priority: 2,
    source: 'manual',
    completed_at: null,
    created_at: dayAgo(1),
    updated_at: dayAgo(1),
    ...overrides,
  }
}

function makeProject(overrides: Partial<DeliverProject>): DeliverProject {
  return {
    id: 'project-1',
    brand_id: 'brand-1',
    name: 'Testprojekt',
    client_name: 'Test Kunde',
    client_email: '',
    client_contact_id: null,
    status: 'active',
    internal_stage: 'discover',
    client_stage: 'discover',
    internal_notes_doc: {},
    internal_file_links: [],
    team_notes: '',
    client_welcome_text: '',
    client_documents: [],
    deliverables: [],
    booking_url: '',
    stage_durations: {
      onboarding: '',
      discover: '',
      inner_world: '',
      visual_world: '',
      execute: '',
    },
    deleted_at: null,
    updated_at: dayAgo(1),
    ...overrides,
  }
}

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: 'contact-1',
    brand_id: 'brand-1',
    contact_type: 'person',
    parent_company_id: null,
    contact_status: 'in_contact',
    first_name: 'Test',
    last_name: 'Kontakt',
    job_title: '',
    address: '',
    lead_source: 'referral',
    follow_up_type: '',
    name: 'Test Kontakt',
    email: '',
    phone: '',
    website: 'testkunde.de',
    instagram: '',
    linkedin: '',
    company: '',
    source_content_piece_id: null,
    source_campaign_id: null,
    source_funnel_id: null,
    lead_quality: 'good',
    lead_value: null,
    pipeline_stage: 'conversation',
    last_contact_at: null,
    next_follow_up_at: null,
    notes: '',
    call_notes: '',
    activity_log: [],
    bedarf: '',
    ansprechpartner: '',
    aktuelle_situation: '',
    hauptproblem: '',
    timeline: '',
    budget: '',
    ist_entscheider: false,
    entscheider_name: '',
    einwaende: '',
    naechste_schritte: '',
    abschluss_wahrscheinlichkeit: 0,
    potenzial_betrag: 0,
    potenzial_typ: 'einmalig',
    potenzial_notiz: '',
    custom_fields: {},
    stage_changed_at: dayAgo(1),
    updated_at: dayAgo(1),
    ...overrides,
  }
}

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

// 1. Offene Aufgabe MIT project_id wird zum kundenaufgabe-Posten.
{
  const tasks = [makeTask({ id: 't1', project_id: 'p1', title: 'Website-Texte final' })]
  const projekte = [makeProject({ id: 'p1', name: 'CoLective', client_name: 'Solmaz' })]
  const posten = kundenaufgabenPosten(tasks, projekte, [])
  check('1a genau ein posten', posten.length, 1)
  check('1b spur kundenaufgabe', posten[0]?.spur, 'kundenaufgabe')
  check('1c firma aus projekt', posten[0]?.firma, 'CoLective')
}

// 2. Offene Aufgabe OHNE project_id zählt NICHT als Kundenarbeit.
{
  const tasks = [makeTask({ id: 't2', project_id: null })]
  const posten = kundenaufgabenPosten(tasks, [], [])
  check('2 ohne project_id kein posten', posten.length, 0)
}

// 3. Erledigte Aufgabe (status done) zählt nicht als offen.
{
  const tasks = [makeTask({ id: 't3', project_id: 'p1', status: 'done', completed_at: dayAgo(0) })]
  const posten = kundenaufgabenPosten(tasks, [makeProject({ id: 'p1' })], [])
  check('3 erledigte aufgabe zaehlt nicht', posten.length, 0)
}

// 4. Projekt seit > 14 Tagen ohne Stage-Wechsel UND ohne erledigte Aufgabe → liegt.
{
  const projekte = [makeProject({ id: 'p1', client_contact_id: 'c1' })]
  const kontakte = [makeContact({ id: 'c1', stage_changed_at: dayAgo(20) })]
  const liegend = liegendeProjekte(projekte, [], kontakte, NOW)
  check('4a ein liegendes projekt', liegend.length, 1)
  check('4b alter in tagen', liegend[0]?.tage, 20)
}

// 5. Kürzlicher Stage-Wechsel schützt das Projekt, auch ohne erledigte Aufgabe.
{
  const projekte = [makeProject({ id: 'p1', client_contact_id: 'c1' })]
  const kontakte = [makeContact({ id: 'c1', stage_changed_at: dayAgo(2) })]
  const liegend = liegendeProjekte(projekte, [], kontakte, NOW)
  check('5 kuerzlicher stage-wechsel schuetzt', liegend.length, 0)
}

// 6. Alter Stage-Wechsel, aber kürzlich erledigte Aufgabe → schützt ebenfalls.
{
  const projekte = [makeProject({ id: 'p1', client_contact_id: 'c1' })]
  const kontakte = [makeContact({ id: 'c1', stage_changed_at: dayAgo(30) })]
  const tasks = [makeTask({ id: 't1', project_id: 'p1', status: 'done', completed_at: dayAgo(1) })]
  const liegend = liegendeProjekte(projekte, tasks, kontakte, NOW)
  check('6 kuerzlich erledigte aufgabe schuetzt', liegend.length, 0)
}

// 7. Abgeschlossenes Projekt liegt nie, egal wie alt.
{
  const projekte = [makeProject({ id: 'p1', client_contact_id: 'c1', status: 'completed' })]
  const kontakte = [makeContact({ id: 'c1', stage_changed_at: dayAgo(90) })]
  const liegend = liegendeProjekte(projekte, [], kontakte, NOW)
  check('7 abgeschlossenes projekt liegt nie', liegend.length, 0)
}

// 8. kundeLiegtPosten spiegelt die Regel als Posten mit Alter im Text.
{
  const projekte = [makeProject({ id: 'p1', name: 'Reichentrog', client_contact_id: 'c1' })]
  const kontakte = [makeContact({ id: 'c1', name: 'KP Reichentrog', stage_changed_at: dayAgo(21) })]
  const posten = kundeLiegtPosten(projekte, [], kontakte, NOW)
  check('8a ein posten', posten.length, 1)
  check('8b spur kunde_liegt', posten[0]?.spur, 'kunde_liegt')
  check('8c text enthaelt alter', posten[0]?.text.includes('21 Tagen'), true)
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
