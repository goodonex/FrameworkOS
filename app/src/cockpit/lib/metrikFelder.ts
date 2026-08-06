/**
 * Die zählbaren Felder von `daily_metrics` — Namen und deutsche Beschriftungen.
 *
 * Bewusst ein Blatt-Modul ohne React-/Supabase-Import (Muster wie
 * `metricsDates.ts`), damit sowohl `urielTools.ts` (Werkzeug-Schema) als auch
 * `scripts/verify-*.ts` es laden können, ohne den ganzen Hook mitzuziehen.
 * `useDailyMetrics` re-exportiert `METRIC_FIELDS`/`MetricField` — bestehende
 * Import-Pfade bleiben gültig.
 *
 * Am 06.08.2026 gegen die Prod-DB abgeglichen: alle 19 Felder existieren als
 * Spalte, und `daily_metrics` hat keine zählbare Spalte, die hier fehlt. Die vier
 * Legacy-Sammelfelder (`coldmails`, `followups`, `antworten_cold`,
 * `termine_vereinbart`) sind mit Migration 0066 gefallen.
 *
 * `umsatz` steht bewusst NICHT hier: er wird gesetzt, nicht hochgezählt
 * (`setUmsatz`/`setUmsatzOn`). Ein „+500" wäre bei Geld mehrdeutig.
 */

export const METRIC_FIELDS = [
  'li_anfragen',
  'li_nachrichten',
  'inmails',
  'looms',
  'ig_anfragen',
  'ig_nachrichten',
  'cold_calls',
  'li_followups',
  'ig_followups',
  'call_followups',
  'antworten_li',
  'antworten_inmail',
  'antworten_ig',
  'quali_termine',
  'sales_calls',
  'termine_li',
  'termine_ig',
  'termine_call',
  'abschluesse',
] as const

export type MetricField = (typeof METRIC_FIELDS)[number]

/**
 * Eindeutige Beschriftungen — anders als in `TrackingArea`, wo der Kanal aus der
 * Gruppen-Überschrift kommt und „Erstnachrichten" deshalb zweimal vorkommt. Hier
 * muss jedes Label für sich stehen, weil Uriel es in einem Satz zurückgibt.
 */
export const METRIK_LABEL: Record<MetricField, string> = {
  li_anfragen: 'Vernetzungsanfragen (LinkedIn)',
  li_nachrichten: 'Erstnachrichten (LinkedIn)',
  inmails: 'InMails (LinkedIn)',
  looms: 'Looms',
  ig_anfragen: 'Follows (Instagram)',
  ig_nachrichten: 'Erstnachrichten (Instagram)',
  cold_calls: 'Cold Calls',
  li_followups: 'Follow-ups (LinkedIn)',
  ig_followups: 'Follow-ups (Instagram)',
  call_followups: 'Follow-up-Calls (Telefon)',
  antworten_li: 'Antworten (LinkedIn)',
  antworten_inmail: 'Antworten (InMail)',
  antworten_ig: 'Antworten (Instagram)',
  quali_termine: 'Quali-Calls geführt',
  sales_calls: 'Sales-Calls geführt',
  termine_li: 'Termine vereinbart (LinkedIn)',
  termine_ig: 'Termine vereinbart (Instagram)',
  termine_call: 'Termine vereinbart (Cold Call)',
  abschluesse: 'Abschlüsse',
}

export function istMetrikFeld(wert: unknown): wert is MetricField {
  return typeof wert === 'string' && (METRIC_FIELDS as readonly string[]).includes(wert)
}

// ---------------------------------------------------------------------------
// Buchungs-Logik für das Uriel-Werkzeug `log_metric`.
// Rein gehalten (keine React-/Supabase-Berührung), damit
// scripts/verify-log-metric.ts sie prüfen kann — dieselbe Bauweise wie
// prioritaet.ts / linkedinFollowups.ts.
// ---------------------------------------------------------------------------

export type BuchungFehler =
  | 'unknown_field'
  | 'invalid_value'
  | 'bad_date'
  | 'future_date'
  | 'out_of_window'

export interface BuchungAbgelehnt {
  ok: false
  fehler: BuchungFehler
  text: string
}

export interface BuchungGeprueft {
  ok: true
  feld: MetricField
  datum: string
  wert: number
}

/**
 * Prüft die rohen Werkzeug-Eingaben. Lehnt alles ab, was nicht exakt passt —
 * lieber eine klare Absage als ein still falsch gebuchter Tag.
 */
export function pruefeBuchung(args: {
  feld: unknown
  wert: unknown
  datum?: unknown
  heute: string
  windowStart: string
}): BuchungAbgelehnt | BuchungGeprueft {
  const { feld, wert, heute, windowStart } = args

  if (!istMetrikFeld(feld)) {
    return { ok: false, fehler: 'unknown_field', text: `Unbekanntes Feld: ${String(feld)}` }
  }
  const zahl = Number(wert)
  if (!Number.isInteger(zahl) || zahl === 0) {
    return {
      ok: false,
      fehler: 'invalid_value',
      text: 'Wert muss eine ganze Zahl ungleich 0 sein',
    }
  }
  const datum = String(args.datum ?? heute)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { ok: false, fehler: 'bad_date', text: `Datum muss YYYY-MM-DD sein, war „${datum}"` }
  }
  if (datum > heute) {
    return { ok: false, fehler: 'future_date', text: 'In die Zukunft wird nichts getrackt' }
  }
  // Außerhalb des 45-Tage-Ladefensters liefe der Upsert zwar durch, die Zeile
  // wäre aber nirgends sichtbar und beim nächsten Laden wieder weg.
  if (datum < windowStart) {
    return {
      ok: false,
      fehler: 'out_of_window',
      text: `Zu weit zurück — es geht bis ${windowStart}`,
    }
  }
  return { ok: true, feld, datum, wert: zahl }
}

export interface Buchungsstand {
  vorher: number
  tagesstand: number
  wochenstand: number
  /** true, wenn die Null-Klammer gegriffen hat (mehr abgezogen als da war) */
  begrenzt: boolean
}

/**
 * Der Stand NACH der Buchung — bewusst hier gerechnet und nicht aus dem Hook
 * gelesen: `bumpOn` schreibt optimistisch und gebündelt, der React-State im
 * aufrufenden Closure ist noch der alte. Uriel bekäme sonst den Stand von vorher
 * zurückgemeldet — und genau der soll den Vertipper aufdecken.
 *
 * `Math.max(0, …)` spiegelt die Klammer in `bumpOn`; ohne sie meldete Uriel eine
 * negative Zahl, die so nie in der Datenbank landet.
 */
export function berechneStand(args: {
  vorher: number
  wert: number
  wochenstandVorher: number
  /** liegt das gebuchte Datum in der laufenden Woche? */
  inDieserWoche: boolean
}): Buchungsstand {
  const { vorher, wert, wochenstandVorher, inDieserWoche } = args
  const tagesstand = Math.max(0, vorher + wert)
  const echteAenderung = tagesstand - vorher
  return {
    vorher,
    tagesstand,
    wochenstand: inDieserWoche ? wochenstandVorher + echteAenderung : wochenstandVorher,
    begrenzt: tagesstand !== vorher + wert,
  }
}
