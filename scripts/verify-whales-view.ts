/**
 * Prüft den Tag-Filter der Whale-Bank (01.09.2026):
 *
 * 1. `filterPipelineContacts` mit `tag: 'whale'` liefert genau die Kontakte,
 *    die das Tag tragen — unabhängig von Stufe und Follow-up.
 * 2. Ohne `tag` bleibt das Verhalten unverändert (kein stiller Eingriff in die
 *    bestehenden Smart Views).
 * 3. Whales ohne Follow-up-Datum erscheinen NICHT im „Heute fällig"-Blick —
 *    das ist die Zusage „ruht, bis Kevin zugreift".
 *
 * Lauf: npx tsx scripts/verify-whales-view.ts
 */
import { filterPipelineContacts } from '../app/src/lib/salesPipelineFilters'
import type { Contact } from '../app/src/types/db'

function kontakt(teil: Partial<Contact>): Contact {
  return {
    id: teil.id ?? 'x',
    brand_id: 'b',
    contact_type: 'person',
    parent_company_id: null,
    contact_status: 'not_contacted',
    first_name: '',
    last_name: '',
    job_title: '',
    address: '',
    lead_source: 'cold',
    follow_up_type: '',
    name: teil.name ?? 'Test',
    email: '',
    phone: '',
    website: '',
    instagram: '',
    linkedin: '',
    company: teil.company ?? '',
    source_content_piece_id: null,
    source_campaign_id: null,
    source_funnel_id: null,
    lead_quality: 'unqualified',
    lead_value: null,
    pipeline_stage: teil.pipeline_stage ?? 'first_contact',
    last_contact_at: null,
    next_follow_up_at: teil.next_follow_up_at ?? null,
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
    tags: teil.tags,
  }
}

const whale = kontakt({ id: 'w1', name: 'Thomas Aigner', company: 'Aigner Immobilien', tags: ['whale', 'whale-p1'] })
const normalOhneTags = kontakt({ id: 'n1', name: 'Normaler Lead' })
const normalMitAnderemTag = kontakt({ id: 'n2', name: 'Anderer Lead', tags: ['messe'] })
const heuteFaellig = kontakt({ id: 'n3', name: 'Fälliger Lead', next_follow_up_at: new Date().toISOString() })
const alle = [whale, normalOhneTags, normalMitAnderemTag, heuteFaellig]

let fehler = 0
function pruefe(name: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) fehler++
}

const nurWhales = filterPipelineContacts(alle, { q: '', stage: 'all', follow: 'all', potenzial: 'all', tag: 'whale' })
pruefe('tag:whale liefert genau den Whale', nurWhales.length === 1 && nurWhales[0].id === 'w1')

const ohneTag = filterPipelineContacts(alle, { q: '', stage: 'all', follow: 'all', potenzial: 'all' })
pruefe('ohne tag bleibt alles wie bisher (4 von 4)', ohneTag.length === 4)

const heute = filterPipelineContacts(alle, { q: '', stage: 'all', follow: 'today', potenzial: 'all' })
pruefe('Whale ohne Follow-up-Datum taucht in „Heute fällig" nicht auf', heute.every((c) => c.id !== 'w1') && heute.some((c) => c.id === 'n3'))

const whaleUndSuche = filterPipelineContacts(alle, { q: 'aigner', stage: 'all', follow: 'all', potenzial: 'all', tag: 'whale' })
pruefe('Suche kombiniert mit tag', whaleUndSuche.length === 1)

if (fehler > 0) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('\nAlle Prüfungen bestanden.')
