import type { Vital } from '../components/VitalsPanel'
import type { DailyMetricsRow } from './useDailyMetrics'
import { toIsoDate } from './metricsDates'
import { CONVERSION_TARGETS, WEEK_TARGETS } from './goals'

export function sumField(rows: DailyMetricsRow[], field: keyof DailyMetricsRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0)
}

/**
 * Kontaktanfragen (Erstkontakt): LinkedIn-Vernetzung + Instagram-Follows.
 * Im Outcome dasselbe („jemanden neu ansprechen"), darum EIN Topf.
 */
export function anfragenSum(row: DailyMetricsRow): number {
  return row.li_anfragen + row.ig_anfragen
}

/** Erstnachrichten (DMs) über beide Kanäle — Nachrichten sind Nachrichten. */
export function nachrichtenSum(row: DailyMetricsRow): number {
  return row.li_nachrichten + row.ig_nachrichten
}

/**
 * Alle Erst-Aktionen eines Tages (Anfragen + Nachrichten + InMails + Cold Calls).
 * NICHT für die Vitals-Kategorien — dort sind Anfragen/Nachrichten getrennt —,
 * sondern als Nenner für Funnel-Quoten & Termin-Attribution.
 * Cold-Mail (coldmails) bewusst raus — Kanal aus dem Tracking genommen.
 */
export function aktionenTotal(row: DailyMetricsRow): number {
  return (
    row.li_anfragen +
    row.li_nachrichten +
    row.inmails +
    row.ig_anfragen +
    row.ig_nachrichten +
    row.cold_calls
  )
}

// antwortenTotal entfernt (ohne Importeur): Antworten werden je Kanal gelesen
// (channelRates), eine Sammelzahl über alle Kanäle brauchte niemand.

/** Geführte Calls (Coach-Funnel: Quali + Sales). */
export function termineTotal(row: DailyMetricsRow): number {
  return row.quali_termine + row.sales_calls
}

/** Heute NEU vereinbarte Termine, über alle Herkunfts-Kanäle (0055). */
export function termineVereinbartTotal(row: DailyMetricsRow): number {
  return row.termine_li + row.termine_ig + row.termine_call
}

/** Letzte `days` Kalendertage als Werte-Reihe (fehlende Tage = 0) für Sparklines. */
export function historySeries(
  rows: DailyMetricsRow[],
  pick: (row: DailyMetricsRow) => number,
  days = 14,
  now: Date = new Date(),
): number[] {
  const byDate = new Map(rows.map((r) => [r.datum, r]))
  const out: number[] = []
  const d = new Date(now)
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const row = byDate.get(toIsoDate(d))
    out.push(row ? pick(row) : 0)
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * Wochen-Vitals in der Form, die VitalsPanel erwartet (ersetzt Mock).
 *
 * `historyRows` speist nur die 14-Tage-Sparklines und muss darum das ganze
 * Ladefenster sein (`metrics.windowRows`), nicht der laufende Monat — sonst
 * ist der Verlauf an jedem Monatsersten bis auf einen Balken leer.
 */
export function weekVitals(
  weekRows: DailyMetricsRow[],
  historyRows: DailyMetricsRow[],
  now: Date = new Date(),
): Vital[] {
  return [
    {
      key: 'anfragen',
      label: 'Anfragen',
      current: weekRows.reduce((a, r) => a + anfragenSum(r), 0),
      target: WEEK_TARGETS.anfragen,
      history: historySeries(historyRows, anfragenSum, 14, now),
    },
    {
      key: 'nachrichten',
      label: 'Nachrichten',
      current: weekRows.reduce((a, r) => a + nachrichtenSum(r), 0),
      target: WEEK_TARGETS.nachrichten,
      history: historySeries(historyRows, nachrichtenSum, 14, now),
    },
    {
      key: 'looms',
      label: 'Looms',
      current: sumField(weekRows, 'looms'),
      target: WEEK_TARGETS.looms,
      history: historySeries(historyRows, (r) => r.looms, 14, now),
    },
    {
      key: 'termine',
      label: 'Termine',
      current: weekRows.reduce((a, r) => a + termineVereinbartTotal(r), 0),
      target: WEEK_TARGETS.termine,
      history: historySeries(historyRows, termineVereinbartTotal, 14, now),
    },
    {
      key: 'abschluesse',
      label: 'Abschlüsse',
      current: sumField(weekRows, 'abschluesse'),
      target: WEEK_TARGETS.abschluesse,
      history: historySeries(historyRows, (r) => r.abschluesse, 14, now),
    },
  ]
}

/**
 * Funnel-Conversions + „Wert pro Aktion" nach dem Coach-Modell (Agentur
 * Inkubator). Conversions über den laufenden Monat (stabiler als eine
 * einzelne Woche — der Coach liest Quoten bewusst über mehrere Wochen).
 */
export interface FunnelKpi {
  key: keyof typeof CONVERSION_TARGETS
  label: string
  rate: number | null
  min: number
  great: number
  /** 'great' ≥ „sehr gut" · 'ok' im Zielband · 'low' darunter · null ohne Daten */
  state: 'great' | 'ok' | 'low' | null
}

export interface FunnelKpis {
  conv: FunnelKpi[]
  /** € Umsatz je aufgenommenem Loom bzw. je Erstnachricht (laufender Monat) */
  perLoom: number | null
  perNachricht: number | null
}

export function funnelKpis(monthRows: DailyMetricsRow[], monthRevenue: number): FunnelKpis {
  // Nenner „Nachricht → Loom" = alle Erst-Aktionen des Monats (unverändert).
  const nachrichten = monthRows.reduce((a, r) => a + aktionenTotal(r), 0)
  const looms = sumField(monthRows, 'looms')
  const quali = sumField(monthRows, 'quali_termine')
  const kunden = sumField(monthRows, 'abschluesse')

  const build = (key: keyof typeof CONVERSION_TARGETS, num: number, den: number): FunnelKpi => {
    const t = CONVERSION_TARGETS[key]
    const rate = den > 0 ? num / den : null
    const state: FunnelKpi['state'] =
      rate == null ? null : rate >= t.great ? 'great' : rate >= t.min ? 'ok' : 'low'
    return { key, label: t.label, rate, min: t.min, great: t.great, state }
  }

  return {
    conv: [
      build('nachrichtLoom', looms, nachrichten),
      build('loomQuali', quali, looms),
      build('qualiKunde', kunden, quali),
    ],
    perLoom: looms > 0 ? monthRevenue / looms : null,
    perNachricht: nachrichten > 0 ? monthRevenue / nachrichten : null,
  }
}

export interface ChannelRate {
  key: string
  label: string
  anfragen: number
  antworten: number
  rate: number | null // null solange keine Anfragen
  benchMin: number
  benchMax: number
}

/** Antwortrate je Kanal über die übergebenen Zeilen (typisch: laufender Monat). */
export function channelRates(rows: DailyMetricsRow[]): ChannelRate[] {
  // `a` = Anfrage-Felder, die auf dieselbe Antwort-Zahl einzahlen (LinkedIn:
  // Vernetzungen + Nachrichten, Instagram: Follows + Nachrichten). Cold Calls
  // haben kein eigenes Antwort-Feld und tauchen daher hier nicht auf.
  const defs = [
    { key: 'li', label: 'LinkedIn', a: ['li_anfragen', 'li_nachrichten'], r: 'antworten_li', min: 0.15, max: 0.25 },
    { key: 'inmail', label: 'InMail', a: ['inmails'], r: 'antworten_inmail', min: 0.1, max: 0.25 },
    { key: 'ig', label: 'Instagram', a: ['ig_anfragen', 'ig_nachrichten'], r: 'antworten_ig', min: 0.1, max: 0.15 },
  ] as const

  return defs.map((d) => {
    const anfragen = d.a.reduce((acc, f) => acc + sumField(rows, f as keyof DailyMetricsRow), 0)
    const antworten = sumField(rows, d.r as keyof DailyMetricsRow)
    return {
      key: d.key,
      label: d.label,
      anfragen,
      antworten,
      rate: anfragen > 0 ? antworten / anfragen : null,
      benchMin: d.min,
      benchMax: d.max,
    }
  })
}

export interface TermineAttribution {
  li: number
  ig: number
  call: number
  total: number
  /** Aktionen (Input, ohne Follow-ups) im selben Zeitraum — Nenner der Quote. */
  aktionen: number
  /** Termine ÷ Aktionen — „wie hart arbeitet der Input" (null ohne Aktionen). */
  proAktion: number | null
}

/** Termine je Herkunfts-Kanal + Conversion Termine÷Aktionen über die Zeilen (0055). */
export function termineAttribution(rows: DailyMetricsRow[]): TermineAttribution {
  const li = sumField(rows, 'termine_li')
  const ig = sumField(rows, 'termine_ig')
  const call = sumField(rows, 'termine_call')
  const total = li + ig + call
  const aktionen = rows.reduce((a, r) => a + aktionenTotal(r), 0)
  return { li, ig, call, total, aktionen, proAktion: aktionen > 0 ? total / aktionen : null }
}

/** Kumulierte Ist-Umsatz-Punkte je Tag des Monats (für die Kurve). */
export function cumulativeRevenue(monthRows: DailyMetricsRow[]): Array<{ datum: string; kumuliert: number }> {
  let acc = 0
  return monthRows.map((r) => {
    acc += Number(r.umsatz) || 0
    return { datum: r.datum, kumuliert: acc }
  })
}
