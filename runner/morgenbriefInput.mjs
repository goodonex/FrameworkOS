/**
 * Input für den Routine-Morgenbrief (13.08.2026).
 *
 * Der Cockpit-Knopf liefert dem Morgenbrief-Skill CRM- und KPI-Daten mit
 * (CockpitHome.tsx, onRun 'morgenbrief'). Die Zeit-Routine im Runner startete
 * ihn dagegen mit `{}` — der Brief von 7:00 sagte deshalb jeden Morgen
 * „Blindflug, keine Vitals durchgereicht". Dieses Modul baut denselben Input
 * aus der Prod-DB; den service_role-Key hat der Runner ohnehin (Spiegel,
 * Heartbeat).
 *
 * **Gespiegelte Wahrheiten** — die App bleibt die Quelle, hier stehen Kopien,
 * und `scripts/verify-morgenbrief-input.ts` schlägt an, sobald sie driften:
 * - `WOCHEN_ZIELE` == `WEEK_TARGETS` (goals.ts)
 * - `MONATSZIELE`/`MONATSZIEL_STANDARD` == `MONTH_TARGETS`-Totals bzw.
 *   `LIFE_TARGET.umsatzMonat` (goals.ts)
 * - Vitals-Formeln == `metricsAggregate.ts` (anfragenSum, nachrichtenSum,
 *   termineVereinbartTotal)
 *
 * **`sollKumuliert` wird bewusst NICHT geliefert.** Die back-loaded
 * Wochen-Kurve lebt in goals.ts (`currentSoll`); sie hierher zu kopieren wäre
 * eine zweite, driftende Wahrheit für eine Zahl, die der Brief nur zur
 * Einordnung nutzt. Der Skill behandelt das Feld als optional und ordnet den
 * Ist-Umsatz dann gegen `monatsziel` ein.
 */

/** Spiegel von `WEEK_TARGETS` (goals.ts). Beim Justieren: beide Stellen. */
export const WOCHEN_ZIELE = {
  anfragen: 180,
  nachrichten: 40,
  looms: 10,
  termine: 5,
  abschluesse: 2,
}

/** Spiegel der `MONTH_TARGETS`-Totals (goals.ts). */
export const MONATSZIELE = {
  '2026-07': 30000,
  '2026-08': 50000,
}

/** Spiegel von `LIFE_TARGET.umsatzMonat` (goals.ts) — Default ab September. */
export const MONATSZIEL_STANDARD = 40000

const n = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)

/** Lokales YYYY-MM-DD — bewusst nicht `toISOString()` (UTC-Verschiebung). */
export function toIsoDatum(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${t}`
}

/** Montag der Woche von `d` (Sonntag gehört zur Vorwoche, wie `mondayOf`). */
export function montagVon(d) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  const tag = out.getDay()
  out.setDate(out.getDate() + (tag === 0 ? -6 : 1 - tag))
  return out
}

/** 'YYYY-MM' — gleicher Schlüssel wie `goals.monthTargetFor`. */
export function monatsSchluessel(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Monatsziel: Kevin-Override aus `month_goals` schlägt die feste Kurve,
 * unbekannte Monate fallen auf den Planungs-Default.
 */
export function monatszielFuer(schluessel, override) {
  if (typeof override === 'number' && override > 0) return override
  return MONATSZIELE[schluessel] ?? MONATSZIEL_STANDARD
}

/**
 * Die fünf Wochen-Vitals in der Form, die der Skill erwartet
 * (`{label, current, target}`) — Formeln wortgleich zu `metricsAggregate.ts`.
 */
export function baueVitals(wochenZeilen) {
  const sum = (pick) => wochenZeilen.reduce((a, r) => a + pick(r), 0)
  return [
    { label: 'Anfragen', current: sum((r) => n(r.li_anfragen) + n(r.ig_anfragen)), target: WOCHEN_ZIELE.anfragen },
    { label: 'Nachrichten', current: sum((r) => n(r.li_nachrichten) + n(r.ig_nachrichten)), target: WOCHEN_ZIELE.nachrichten },
    { label: 'Looms', current: sum((r) => n(r.looms)), target: WOCHEN_ZIELE.looms },
    { label: 'Termine', current: sum((r) => n(r.termine_li) + n(r.termine_ig) + n(r.termine_call)), target: WOCHEN_ZIELE.termine },
    { label: 'Abschlüsse', current: sum((r) => n(r.abschluesse)), target: WOCHEN_ZIELE.abschluesse },
  ]
}

/**
 * Überfällige und heutige Follow-ups — dieselbe Teilung wie der Cockpit-Knopf:
 * alles mit `next_follow_up_at` außer `paused`, geschnitten an der lokalen
 * Mitternacht. (Die O2-Grenze der Freigaben-Queue gilt hier nicht: der Brief
 * LISTET nur, er versendet nichts — und der Knopf-Pfad listet genauso.)
 */
export function teileFollowups(kontakte, jetzt) {
  const startHeute = new Date(jetzt)
  startHeute.setHours(0, 0, 0, 0)
  const endeHeute = new Date(jetzt)
  endeHeute.setHours(23, 59, 59, 999)
  const mit = kontakte.filter((k) => k.next_follow_up_at && k.pipeline_stage !== 'paused')
  const zeit = (k) => new Date(k.next_follow_up_at).getTime()
  const mapK = (k) => ({
    name: k.name,
    company: k.company,
    stage: k.pipeline_stage,
    nextFollowUp: k.next_follow_up_at,
  })
  return {
    overdue: mit.filter((k) => zeit(k) < startHeute.getTime()).map(mapK),
    today: mit
      .filter((k) => zeit(k) >= startHeute.getTime() && zeit(k) <= endeHeute.getTime())
      .map(mapK),
  }
}

/**
 * Der komplette Skill-Input aus der Prod-DB.
 *
 * Wirft bei Netz-/DB-Fehlern — der Aufrufer entscheidet, ob der Brief dann
 * ohne Daten läuft (heutiges Verhalten) oder wartet.
 */
export async function baueMorgenbriefInput({ supabaseUrl, serviceKey, jetzt = new Date(), fetchImpl = fetch }) {
  const kopf = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }
  const hole = async (pfad) => {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/${pfad}`, {
      headers: kopf,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Supabase ${res.status} bei ${pfad.split('?')[0]}`)
    return res.json()
  }

  const montag = toIsoDatum(montagVon(jetzt))
  const monatsanfang = `${monatsSchluessel(jetzt)}-01`
  const heute = toIsoDatum(jetzt)
  const ab = montag < monatsanfang ? montag : monatsanfang
  const schluessel = monatsSchluessel(jetzt)

  // Es gibt nur eine Brand (Umschalter am 10.08. entfernt) — kein brand-Filter,
  // die Summen wären mit ihm identisch.
  const [kontakte, zeilen, ziele] = await Promise.all([
    hole('contacts?select=name,company,pipeline_stage,next_follow_up_at&next_follow_up_at=not.is.null&pipeline_stage=neq.paused'),
    hole(`daily_metrics?select=*&datum=gte.${ab}&datum=lte.${heute}&order=datum.asc&limit=100`),
    hole(`month_goals?select=month_key,total&month_key=eq.${schluessel}&limit=1`),
  ])

  const wochenZeilen = zeilen.filter((r) => r.datum >= montag)
  const monatsZeilen = zeilen.filter((r) => r.datum >= monatsanfang)
  const { overdue, today } = teileFollowups(kontakte, jetzt)

  return {
    weekday: jetzt.toLocaleDateString('de-DE', { weekday: 'long' }),
    date: jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
    overdueFollowUps: overdue,
    todayFollowUps: today,
    weekVitals: baueVitals(wochenZeilen),
    monthRevenue: monatsZeilen.reduce((a, r) => a + n(r.umsatz), 0),
    monatsziel: monatszielFuer(schluessel, ziele[0]?.total),
  }
}
