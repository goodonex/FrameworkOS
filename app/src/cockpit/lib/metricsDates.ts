/**
 * Datums-Helfer für die Tages-Metriken — bewusst ein Blatt-Modul ohne React-
 * oder Supabase-Import, damit die Wochen-/Monatslogik in scripts/verify-*.ts
 * ohne Vite-Umgebung geprüft werden kann.
 *
 * `useDailyMetrics` re-exportiert alles davon; bestehende Import-Pfade bleiben
 * gültig.
 */

/**
 * Der Metrik-Tag wechselt um 4 Uhr morgens, nicht um Mitternacht.
 *
 * Kevin arbeitet nachweislich nach Mitternacht (Commits um 01:25 sind im Log).
 * Ein Loom um 0:30 gehört zu seinem „gestern" — zählte er auf den Kalendertag,
 * stünde die Hälfte des Abends morgens als „heute schon erledigt" im Flow, und
 * die Tageszeile von gestern bliebe unvollständig. Die Grenze gilt überall,
 * wo `daily_metrics` gelesen oder geschrieben wird — EINE Tageswahrheit, kein
 * zweiter Kalender daneben.
 */
export const METRIK_TAG_WECHSEL_STUNDE = 4

/** Das Datum, auf das JETZT gebucht und gelesen wird — mit 4-Uhr-Grenze. */
export function heutigesMetrikDatum(jetzt: Date = new Date()): string {
  return toIsoDate(new Date(jetzt.getTime() - METRIK_TAG_WECHSEL_STUNDE * 60 * 60 * 1000))
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Montag der Woche von `d` (de: Woche beginnt Montag). */
export function mondayOf(d: Date): Date {
  const copy = new Date(d)
  const day = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/**
 * Zeilen der Woche von `now` (Mo–So) aus dem GANZEN Ladefenster.
 *
 * Bewusst NICHT aus `monthRows` gefiltert: eine Woche, die über die
 * Monatsgrenze läuft (z. B. Sa 01.08.2026 — Montag war der 27.07.), verlöre
 * sonst ihre Mo–Fr-Tage und die Vitals fielen auf ~0 zurück.
 */
export function weekRowsOf<T extends { datum: string }>(rows: T[], now: Date = new Date()): T[] {
  const monday = mondayOf(now)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const mondayIso = toIsoDate(monday)
  const sundayIso = toIsoDate(sunday)
  return rows.filter((r) => r.datum >= mondayIso && r.datum <= sundayIso)
}
