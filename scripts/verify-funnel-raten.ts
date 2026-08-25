/**
 * Drift-Wache für die Conversion des Pipeline-Boards (25.08.2026, Zug 2).
 *
 * Die teuerste Zahl auf dieser Seite ist eine, die plausibel aussieht und
 * falsch ist. Sie kommt durch keinen Compiler-Fehler und durch keinen Build —
 * nur durch diese Prüfungen. Drei Fallen stehen namentlich in der Blaupause:
 *
 * - **Rate über 100 %** bei der Kohorte (Zähler und Nenner aus verschiedenen
 *   Mengen gerechnet).
 * - **0 % statt „keine Daten"** — sähe aus wie ein kaputter Funnel und
 *   schickte Kevin zur Optimierung ans falsche Ende.
 * - **Die Reifezeit greift nicht** — dann misst die Rate Kevins Volumen statt
 *   seiner Qualität.
 *
 * Start: npx tsx scripts/verify-funnel-raten.ts
 */
import {
  FENSTER_TAGE,
  FUNNEL_KANTEN,
  MINDEST_GRUNDGESAMTHEIT,
  funnelRaten,
  rateFuer,
  type RatenEingabe,
  type RatenEreignis,
} from '../app/src/cockpit/lib/funnelRaten'
import { FUNNEL_BAUPLAN } from '../app/src/cockpit/lib/funnelKarten'
import type { LeadEreignisTyp } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-08-25T12:00:00.000Z')
const TAG = 86_400_000
const vorTagen = (n: number) => new Date(JETZT.getTime() - n * TAG).toISOString()

function e(lead_id: string, typ: LeadEreignisTyp, tageHer: number): RatenEreignis {
  return { lead_id, typ, at: vorTagen(tageHer) }
}

function eingabe(teil: Partial<RatenEingabe> = {}): RatenEingabe {
  return { ereignisse: [], tageszeilen: [], netzwerk: [], jetzt: JETZT, ...teil }
}

/** Eine Kohorte aus n Leads, die vor `vorTagen` eingetreten sind. */
function kohortenLeads(n: number, typ: LeadEreignisTyp, tageHer: number, praefix = 'L'): RatenEreignis[] {
  return Array.from({ length: n }, (_, i) => e(`${praefix}${i}`, typ, tageHer))
}

/**
 * Belegtes Grundrauschen WEIT ausserhalb des Fensters.
 *
 * Seit der Paarungsprobe (25.08.) reicht es nicht mehr, eine Handvoll
 * Fixture-Leads hinzustellen: Eine Kante braucht erst den Nachweis, dass ihre
 * beiden Quellen sich überhaupt paaren lassen, bevor sie eine Rate liefert.
 * Diese Alt-Leads liefern genau diesen Nachweis — sie liegen 300 Tage zurück
 * und rühren das Kohortenfenster deshalb nicht an.
 */
function belegteQuelle(von: LeadEreignisTyp, nach: LeadEreignisTyp, n = MINDEST_GRUNDGESAMTHEIT + 5): RatenEreignis[] {
  return [
    ...Array.from({ length: n }, (_, i) => e(`BELEG${i}`, von, 300)),
    ...Array.from({ length: n }, (_, i) => e(`BELEG${i}`, nach, 290)),
  ]
}

/* ── Struktur: jede Kante genau einmal, jede Sorte zugewiesen ───────────── */

{
  const raten = funnelRaten(eingabe())
  check('jede Kante des Bauplans kommt im Ergebnis vor', raten.length === FUNNEL_KANTEN.length)
  const schluessel = raten.map((r) => `${r.von}>${r.nach}`)
  check('keine Kante doppelt', new Set(schluessel).size === schluessel.length, JSON.stringify(schluessel))
  check(
    'jede Kante hat genau eine Sorte',
    raten.every((r) => r.art === 'zeitreihe' || r.art === 'kohorte'),
  )
  const ids = new Set(FUNNEL_BAUPLAN.map((b) => b.id))
  check(
    'jede Kante verbindet zwei Karten, die es im Bauplan gibt',
    raten.every((r) => ids.has(r.von) && ids.has(r.nach)),
    JSON.stringify(raten.filter((r) => !ids.has(r.von) || !ids.has(r.nach)).map((r) => `${r.von}>${r.nach}`)),
  )
  check('keine Kante zeigt auf sich selbst', raten.every((r) => r.von !== r.nach))
  check(
    'ohne Daten steht nirgends 0 % — überall eine Begründung',
    raten.every((r) => r.rate === null && r.grund !== null),
    JSON.stringify(raten.filter((r) => r.rate !== null).map((r) => `${r.von}>${r.nach}=${r.rate}`)),
  )
  check(
    'Benchmarks sind überall null (kein erfundener Richtwert)',
    raten.every((r) => r.benchMin === null && r.benchMax === null),
  )
}

/* ── DIE FALLE: nie über 100 % bei der Kohorte ──────────────────────────── */

{
  // 30 Leads treten ein. ALLE haben zusätzlich ein Ziel-Ereignis, das VOR dem
  // Eintritt liegt (alte Erstnachricht von vor einem Jahr) — plus 40 fremde
  // Leads, die nur ein Ziel-Ereignis haben und gar nicht in der Kohorte sind.
  const ereignisse: RatenEreignis[] = [
    ...belegteQuelle('angenommen', 'erstnachricht'),
    ...kohortenLeads(30, 'angenommen', 20),
    ...Array.from({ length: 30 }, (_, i) => e(`L${i}`, 'erstnachricht', 305)),
    ...Array.from({ length: 40 }, (_, i) => e(`FREMD${i}`, 'erstnachricht', 20)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check('Fremde Leads landen nicht im Zähler', r.angekommen === 0, JSON.stringify(r))
  check('Grundgesamtheit ist die Kohorte, nicht alle', r.grundgesamtheit === 30, String(r.grundgesamtheit))
  check('Rate ist 0, nicht über 100 %', r.rate === 0, String(r.rate))
}

{
  // Jetzt derselbe Fall, aber die Ziele liegen NACH dem Eintritt.
  const ereignisse: RatenEreignis[] = [
    ...belegteQuelle('angenommen', 'erstnachricht'),
    ...kohortenLeads(30, 'angenommen', 20),
    ...Array.from({ length: 15 }, (_, i) => e(`L${i}`, 'erstnachricht', 18)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check('Ziel nach Eintritt zählt', r.angekommen === 15, JSON.stringify(r))
  check('Rate ist 50 %', r.rate === 0.5, String(r.rate))
}

{
  // Mehrere Ziel-Ereignisse desselben Leads dürfen ihn nicht mehrfach zählen.
  const ereignisse: RatenEreignis[] = [
    ...belegteQuelle('angenommen', 'erstnachricht'),
    ...kohortenLeads(25, 'angenommen', 20),
    ...Array.from({ length: 25 }, (_, i) => e(`L${i}`, 'erstnachricht', 18)),
    ...Array.from({ length: 25 }, (_, i) => e(`L${i}`, 'erstnachricht', 17)),
    ...Array.from({ length: 25 }, (_, i) => e(`L${i}`, 'erstnachricht', 16)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check('drei Ziel-Ereignisse zählen den Lead einmal', r.angekommen === 25, JSON.stringify(r))
  check('Rate genau 100 %, nie darüber', r.rate === 1, String(r.rate))
}

{
  const alle = funnelRaten(
    eingabe({
      ereignisse: [
        ...belegteQuelle('angenommen', 'erstnachricht'),
        ...kohortenLeads(40, 'angenommen', 20),
        ...Array.from({ length: 40 }, (_, i) => e(`L${i}`, 'erstnachricht', 18)),
      ],
    }),
  )
  check(
    'INVARIANTE: bei jeder Kohorte gilt angekommen <= grundgesamtheit',
    alle.filter((r) => r.art === 'kohorte').every((r) => r.angekommen <= r.grundgesamtheit),
  )
  check(
    'INVARIANTE: jede Rate liegt zwischen 0 und 1 oder ist null',
    alle.filter((r) => r.art === 'kohorte').every((r) => r.rate === null || (r.rate >= 0 && r.rate <= 1)),
  )
}

/* ── DIE ZWEITE FALLE: „followup → followup" darf nie 100 % sein ────────── */

{
  // Beide Seiten derselbe Ereignis-Typ. Ohne echtes Später wäre jeder Lead sein
  // eigener Nachfolger — die Rate stünde konstant auf 100 % und wäre wertlos.
  const ereignisse = [...belegteQuelle('followup', 'followup'), ...kohortenLeads(30, 'followup', 20)]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'followup_0', 'followup_1')!
  check('ein einzelnes Follow-up ist NICHT sein eigener Nachfolger', r.angekommen === 0, JSON.stringify(r))
  check('Rate 0 statt 100 %', r.rate === 0, String(r.rate))
}

{
  const ereignisse: RatenEreignis[] = [
    ...belegteQuelle('followup', 'followup'),
    ...kohortenLeads(30, 'followup', 20),
    ...Array.from({ length: 12 }, (_, i) => e(`L${i}`, 'followup', 12)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'followup_0', 'followup_1')!
  check('ein späteres Follow-up zählt sehr wohl', r.angekommen === 12, JSON.stringify(r))
}

/* ── DIE DRITTE FALLE: die Reifezeit muss greifen ───────────────────────── */

{
  // Reife der Kante erstnachricht_faellig -> wartet_auf_antwort ist 14 Tage.
  // Wer gestern angenommen hat, darf NICHT in den Nenner.
  const frisch = [...belegteQuelle('angenommen', 'erstnachricht'), ...kohortenLeads(50, 'angenommen', 1)]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse: frisch })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check('DIE REIFEZEIT: Annahme von gestern zählt nicht in den Nenner', r.grundgesamtheit === 0, JSON.stringify(r))
}

{
  // Und wer vor dem Fenster liegt, auch nicht.
  const alt = [...belegteQuelle('angenommen', 'erstnachricht'), ...kohortenLeads(50, 'angenommen', 14 + FENSTER_TAGE + 5)]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse: alt })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check('zu alt fällt hinten aus dem Fenster', r.grundgesamtheit === 0, JSON.stringify(r))
}

{
  // Genau in der Mitte des Fensters: drin.
  const mittig = [...belegteQuelle('angenommen', 'erstnachricht'), ...kohortenLeads(30, 'angenommen', 14 + 15)]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse: mittig })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check('mitten im Fenster: drin', r.grundgesamtheit === 30, JSON.stringify(r))
}

/* ── Die drei Gründe sind unterscheidbar ────────────────────────────────── */

{
  // Gar keine Ereignisse dieses Typs im Bestand -> sammelt_noch, NICHT 0 %.
  const r = rateFuer(funnelRaten(eingabe()), 'wartet_auf_antwort', 'followup_0')!
  check('kein einziges Ereignis -> sammelt_noch', r.grund === 'sammelt_noch', String(r.grund))
  check('und ausdruecklich KEINE 0 %', r.rate === null, String(r.rate))
}

{
  // Ereignisse da, aber zu wenige im Fenster -> zu_wenig_daten.
  const knapp = MINDEST_GRUNDGESAMTHEIT - 1
  const ereignisse: RatenEreignis[] = [
    ...belegteQuelle('angenommen', 'erstnachricht'),
    ...kohortenLeads(knapp, 'angenommen', 20),
    ...Array.from({ length: knapp }, (_, i) => e(`L${i}`, 'erstnachricht', 18)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check(`${knapp} im Nenner -> zu_wenig_daten`, r.grund === 'zu_wenig_daten', String(r.grund))
  check('auch hier keine Zahl', r.rate === null)
}

{
  // Einer mehr, und die Rate erscheint.
  const genug = MINDEST_GRUNDGESAMTHEIT
  const ereignisse: RatenEreignis[] = [
    ...belegteQuelle('angenommen', 'erstnachricht'),
    ...kohortenLeads(genug, 'angenommen', 20),
    ...Array.from({ length: genug }, (_, i) => e(`L${i}`, 'erstnachricht', 18)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check(`${genug} im Nenner -> Rate da`, r.rate === 1 && r.grund === null, JSON.stringify(r))
}

{
  // Der stille Zweig: dauerhaft nicht erfasst, egal wie viele Daten kommen.
  const viele = [
    ...kohortenLeads(100, 'email', 20),
    ...Array.from({ length: 100 }, (_, i) => e(`L${i}`, 'postkarte', 18)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse: viele })), 'email_faellig', 'postkarte_still')!
  check('stiller Zweig bleibt nicht_erfasst', r.grund === 'nicht_erfasst', String(r.grund))
}

/* ── Die Zeitreihe: andere Regeln, ausdrücklich ─────────────────────────── */

{
  const tageszeilen = Array.from({ length: 20 }, (_, i) => ({
    datum: new Date(JETZT.getTime() - i * TAG).toISOString().slice(0, 10),
    li_anfragen: 18,
  }))
  const netzwerk = Array.from({ length: 74 }, (_, i) => ({ angenommen_at: vorTagen(i % 29) }))
  const r = rateFuer(funnelRaten(eingabe({ tageszeilen, netzwerk })), 'anfrage_offen', 'erstnachricht_faellig')!
  check('Zeitreihe: Nenner ist die Summe der Tageszeilen', r.grundgesamtheit === 360, String(r.grundgesamtheit))
  check('Zeitreihe: Zähler sind die Annahmen im Fenster', r.angekommen === 74, String(r.angekommen))
  check('Zeitreihe: Rate ist Zähler/Nenner', Math.abs((r.rate ?? 0) - 74 / 360) < 1e-9, String(r.rate))
}

{
  // Über 100 % ist hier LEGITIM und darf nicht abgeschnitten werden.
  const tageszeilen = [{ datum: JETZT.toISOString().slice(0, 10), li_anfragen: 25 }]
  const netzwerk = Array.from({ length: 40 }, () => ({ angenommen_at: vorTagen(3) }))
  const r = rateFuer(funnelRaten(eingabe({ tageszeilen, netzwerk })), 'anfrage_offen', 'erstnachricht_faellig')!
  check('Zeitreihe DARF über 100 % liegen', (r.rate ?? 0) > 1, String(r.rate))
  check('und wird dabei nicht zum Fehler', r.grund === null)
}

{
  // Tageszeilen ausserhalb des Fensters zählen nicht.
  const tageszeilen = [
    { datum: new Date(JETZT.getTime() - 90 * TAG).toISOString().slice(0, 10), li_anfragen: 500 },
    { datum: JETZT.toISOString().slice(0, 10), li_anfragen: 30 },
  ]
  const netzwerk = Array.from({ length: 10 }, () => ({ angenommen_at: vorTagen(2) }))
  const r = rateFuer(funnelRaten(eingabe({ tageszeilen, netzwerk })), 'anfrage_offen', 'erstnachricht_faellig')!
  check('Zeitreihe: alte Tageszeilen fallen raus', r.grundgesamtheit === 30, String(r.grundgesamtheit))
}

/* ── Randfälle ──────────────────────────────────────────────────────────── */

{
  const r = funnelRaten(eingabe())
  check('leere Eingabe stürzt nicht ab', r.length === FUNNEL_KANTEN.length)
  check('und erfindet keine Zahl', r.every((k) => k.rate === null))
}

{
  const kaputt: RatenEreignis[] = [
    ...belegteQuelle('angenommen', 'erstnachricht'),
    { lead_id: 'L1', typ: 'angenommen', at: 'kein-datum' },
    { lead_id: 'L2', typ: 'angenommen', at: '' },
    ...kohortenLeads(25, 'angenommen', 20),
    ...Array.from({ length: 25 }, (_, i) => e(`L${i}`, 'erstnachricht', 18)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse: kaputt })), 'erstnachricht_faellig', 'wartet_auf_antwort')!
  check('unlesbare Zeitstempel werden ignoriert statt zu vergiften', r.grundgesamtheit === 25, JSON.stringify(r))
  check('und die Rate bleibt eine Zahl', r.rate === 1, String(r.rate))
}

{
  const kaputteZeilen = [
    { datum: JETZT.toISOString().slice(0, 10), li_anfragen: Number.NaN },
    { datum: JETZT.toISOString().slice(0, 10), li_anfragen: -5 },
    { datum: JETZT.toISOString().slice(0, 10), li_anfragen: 40 },
  ]
  const netzwerk = [{ angenommen_at: vorTagen(1) }, { angenommen_at: null }, { angenommen_at: 'kaputt' }]
  const r = rateFuer(
    funnelRaten(eingabe({ tageszeilen: kaputteZeilen, netzwerk })),
    'anfrage_offen',
    'erstnachricht_faellig',
  )!
  check('NaN und negative Werte vergiften den Nenner nicht', r.grundgesamtheit === 40, String(r.grundgesamtheit))
  check('kaputte Annahme-Daten zählen nicht', r.angekommen === 1, String(r.angekommen))
}

{
  check('rateFuer findet eine bekannte Kante', rateFuer(funnelRaten(eingabe()), 'anfrage_offen', 'email_faellig') !== null)
  check(
    'rateFuer gibt null für eine Kante, die es nicht gibt',
    rateFuer(funnelRaten(eingabe()), 'kunde', 'disqualifiziert') === null,
  )
}

/* ── DIE FALLE, DIE ERST ECHTE DATEN ZEIGTEN: paarung_fehlt ─────────────
 *
 * Beide Ereignis-Typen haben reichlich Zeilen, aber sie stehen fast nie am
 * SELBEN Lead in der richtigen Reihenfolge. Am 25.08. in Prod gemessen:
 * `erstnachricht` 267 Zeilen, `antwort_erhalten` 67 — und nur NEUN Leads mit
 * beidem in der Reihenfolge. Ursache in `scripts/leads-sync.ts`: Ein Thread
 * ohne gespiegelten Verlauf bekommt ENTWEDER `erstnachricht` ODER
 * `antwort_erhalten`, nie beides.
 *
 * Ohne die Paarungsprobe stand dort „0,0 %" — die Behauptung, niemand
 * antworte, während in denselben 30 Tagen 21 Antworten eingingen. Alle 42
 * Prüfungen gegen Fixtures waren zu dem Zeitpunkt grün.
 */

{
  // 60 Leads mit Erstnachricht, 60 ANDERE mit Antwort. Beide Typen haben satt
  // Zeilen, aber kein einziger Lead trägt beides — exakt Kevins Datenlage.
  const ereignisse: RatenEreignis[] = [
    ...kohortenLeads(60, 'erstnachricht', 20, 'A'),
    ...kohortenLeads(60, 'antwort_erhalten', 18, 'B'),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'wartet_auf_antwort', 'antwort_da')!
  check('getrennte Lead-Mengen -> paarung_fehlt statt 0 %', r.grund === 'paarung_fehlt', String(r.grund))
  check('und ausdruecklich KEINE Zahl', r.rate === null, String(r.rate))
  check('der Nenner ist trotzdem sichtbar', r.grundgesamtheit === 60, String(r.grundgesamtheit))
}

{
  // Dieselbe Menge, aber die Paarung existiert: dann gibt es eine Rate.
  const ereignisse: RatenEreignis[] = [
    ...kohortenLeads(60, 'erstnachricht', 20, 'A'),
    ...Array.from({ length: 25 }, (_, i) => e(`A${i}`, 'antwort_erhalten', 18)),
    ...kohortenLeads(60, 'antwort_erhalten', 18, 'B'),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'wartet_auf_antwort', 'antwort_da')!
  check('mit echter Paarung entsteht eine Rate', r.grund === null && r.rate !== null, JSON.stringify(r))
  check('und sie zaehlt nur die gepaarten', r.angekommen === 25, String(r.angekommen))
}

{
  // Grenzfall: genau MINDEST_GRUNDGESAMTHEIT Paarungen reichen.
  const ereignisse: RatenEreignis[] = [
    ...kohortenLeads(60, 'erstnachricht', 20, 'A'),
    ...Array.from({ length: MINDEST_GRUNDGESAMTHEIT }, (_, i) => e(`A${i}`, 'antwort_erhalten', 18)),
    ...kohortenLeads(60, 'antwort_erhalten', 18, 'B'),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'wartet_auf_antwort', 'antwort_da')!
  check(`genau ${MINDEST_GRUNDGESAMTHEIT} Paarungen reichen`, r.grund === null, String(r.grund))
}

{
  // Eine unter der Schwelle: gesperrt.
  const ereignisse: RatenEreignis[] = [
    ...kohortenLeads(60, 'erstnachricht', 20, 'A'),
    ...Array.from({ length: MINDEST_GRUNDGESAMTHEIT - 1 }, (_, i) => e(`A${i}`, 'antwort_erhalten', 18)),
    ...kohortenLeads(60, 'antwort_erhalten', 18, 'B'),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'wartet_auf_antwort', 'antwort_da')!
  check(`${MINDEST_GRUNDGESAMTHEIT - 1} Paarungen sind zu wenig`, r.grund === 'paarung_fehlt', String(r.grund))
}

{
  // Die Paarungsprobe schaut ueber ALLE Zeiten, nicht nur ins Fenster:
  // Paarungen von vor einem Jahr belegen, dass die Quellen zusammenpassen.
  const ereignisse: RatenEreignis[] = [
    ...kohortenLeads(30, 'erstnachricht', 20, 'A'),
    ...kohortenLeads(40, 'erstnachricht', 300, 'ALT'),
    ...Array.from({ length: 40 }, (_, i) => e(`ALT${i}`, 'antwort_erhalten', 290)),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'wartet_auf_antwort', 'antwort_da')!
  check('alte Paarungen belegen die Quelle', r.grund !== 'paarung_fehlt', String(r.grund))
  check('das Fenster bleibt trotzdem das Fenster', r.grundgesamtheit === 30, String(r.grundgesamtheit))
}

/* ── sammelt_noch schlaegt paarung_fehlt ────────────────────────────────── */

{
  // Wenig Historie ueberhaupt: dann ist "die Uhr laeuft" die richtige Aussage,
  // nicht "die Quellen passen nicht".
  const ereignisse: RatenEreignis[] = [
    ...kohortenLeads(60, 'erstnachricht', 20, 'A'),
    ...kohortenLeads(3, 'followup', 18, 'C'),
  ]
  const r = rateFuer(funnelRaten(eingabe({ ereignisse })), 'wartet_auf_antwort', 'followup_0')!
  check('drei Ziel-Ereignisse -> sammelt_noch, nicht paarung_fehlt', r.grund === 'sammelt_noch', String(r.grund))
}

console.log(`\nverify-funnel-raten: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
