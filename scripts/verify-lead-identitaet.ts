/**
 * Drift-Wache für die Lead-Identität (20.08.2026, Migration 0076).
 *
 * Ein Fehler hier ist der teuerste im ganzen Lead-System: Werden zwei Personen
 * zu einem Lead verschmolzen, vermischt sich ihre Historie und niemand merkt
 * es. Wird eine Person auf zwei Leads verteilt, zählt die Pipeline sie doppelt
 * und beide Hälften wirken unbearbeitet.
 *
 * Start: npx tsx scripts/verify-lead-identitaet.ts
 */
import {
  baueIndex,
  findeLead,
  istOpakeId,
  normName,
  urlKern,
  type LeadKandidat,
} from '../app/src/cockpit/lib/leadIdentitaet'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

function lead(teil: Partial<LeadKandidat> & { id: string }): LeadKandidat {
  return { name: '', profil_key: '', li_urn: '', ...teil }
}

/* ── normName ──────────────────────────────────────────────────────────── */

check('Umlaute werden zerlegt', normName('Anton Bachhäubl') === 'anton bachhaubl')
check('Titel und Punkte fallen weg', normName('Dr. Katja Frontzkowski') === 'dr katja frontzkowski')
check('Mehrfache Leerzeichen kollabieren', normName('  Max   Mustermann  ') === 'max mustermann')
check('Emoji und Zusätze verschwinden', normName('Silvio Tantulli 🏠 | Makler') === 'silvio tantulli makler')
check('Leerer Name bleibt leer', normName(null) === '')

/* ── urlKern ───────────────────────────────────────────────────────────── */

check(
  'lesbarer Slug wird erkannt',
  urlKern('https://www.linkedin.com/in/anton-bachhaeubl-45a96920b/') === 'anton-bachhaeubl-45a96920b',
)
check(
  'opake Postfach-ID wird erkannt',
  urlKern('https://www.linkedin.com/in/ACoAACAUWC4BuMVJg4jiN3by3fe0AOX7y9uz4Fw') ===
    'acoaacauwc4bumvjg4jin3by3fe0aox7y9uz4fw',
)
check('Query und Anker stören nicht', urlKern('https://www.linkedin.com/in/max-mustermann?trk=abc#top') === 'max-mustermann')
check('URL ohne /in/ liefert leer', urlKern('https://www.linkedin.com/company/herrmann') === '')
check('Leere URL liefert leer', urlKern('') === '')

check('ACoAA-Präfix gilt als opak', istOpakeId('acoaacauwc4bumvjg4jin3by3fe0aox7y9uz4fw'))
check('lesbarer Slug gilt nicht als opak', !istOpakeId('anton-bachhaeubl-45a96920b'))

/* ── findeLead ─────────────────────────────────────────────────────────── */

const leads = [
  lead({ id: 'L1', name: 'Anton Bachhäubl', profil_key: 'anton-bachhaeubl-45a96920b' }),
  lead({ id: 'L2', name: 'Cassandra Skwar', profil_key: 'cassandra-skwar-9728b9262', li_urn: 'acoaaebjr_sbtyj0_guo8tg2psjvtdjb6509ndm' }),
  lead({ id: 'L3', name: 'Tobias Faulstroh', profil_key: 'tobias-faulstroh-1' }),
  lead({ id: 'L4', name: 'Tobias Faulstroh', profil_key: 'tobias-faulstroh-2' }),
  lead({ id: 'L5', name: 'Nur Im Postfach' }),
]
const index = baueIndex(leads)

{
  // Der wichtigste Fall: ein Thread, dessen opake ID schon einmal
  // festgeschrieben wurde, trifft direkt — ohne den Namen zu befragen.
  const t = findeLead(index, {
    name: 'Cassandra Skwar-Neuername',
    profileUrl: 'https://www.linkedin.com/in/ACoAAEbjr_sBtyJ0_gUO8TG2PSJvtdjB6509NdM',
  })
  check('festgeschriebene li_urn sticht den Namen', t.leadId === 'L2' && t.grund === 'li_urn', JSON.stringify(t))
}

{
  const t = findeLead(index, { name: 'Anton Bachhäubl', profilKey: 'anton-bachhaeubl-45a96920b' })
  check('profil_key trifft', t.leadId === 'L1' && t.grund === 'profil_key', JSON.stringify(t))
}

{
  // Der reale Alltagsfall: Thread mit opaker, noch unbekannter ID — nur der
  // Name kann die Brücke schlagen.
  const t = findeLead(index, {
    name: 'Anton Bachhäubl',
    profileUrl: 'https://www.linkedin.com/in/ACoAAUnbekannt123',
  })
  check('unbekannte opake ID fällt auf den Namen zurück', t.leadId === 'L1' && t.grund === 'name', JSON.stringify(t))
}

{
  const t = findeLead(index, { name: 'Tobias Faulstroh', profileUrl: 'https://www.linkedin.com/in/ACoAAUnbekannt456' })
  check('Namens-Kollision wählt niemanden', t.leadId === null && t.grund === 'mehrdeutig', JSON.stringify(t))
  check('Namens-Kollision nennt beide Kandidaten', (t.kandidaten ?? []).join(',') === 'L3,L4', JSON.stringify(t))
}

{
  const t = findeLead(index, { name: 'Wildfremde Person' })
  check('unbekannte Person ergibt kein_treffer', t.leadId === null && t.grund === 'kein_treffer', JSON.stringify(t))
}

{
  // Eine opake ID darf NIE als profil_key durchgehen — sonst stünde dieselbe
  // Person unter zwei Schlüsseln und die Teil-Unique-Indizes hielten sie für zwei.
  const t = findeLead(index, { name: 'Nur Im Postfach', profileUrl: 'https://www.linkedin.com/in/ACoAAFrisch999' })
  check('opake ID wird nicht als profil_key missdeutet', t.leadId === 'L5' && t.grund === 'name', JSON.stringify(t))
}

{
  const leer = baueIndex([])
  const t = findeLead(leer, { name: 'Irgendwer', profileUrl: 'https://www.linkedin.com/in/irgendwer' })
  check('leerer Index stürzt nicht ab', t.leadId === null && t.grund === 'kein_treffer')
}

console.log(`\nverify-lead-identitaet: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
