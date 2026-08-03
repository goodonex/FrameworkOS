import type { Posten, Spur } from './prioritaet'

/**
 * Tagesansage (Etappe 3, Schritt 4): „12 offen · ≈ 1 h 40 · um 13:25 durch".
 *
 * Rechnet ausschließlich mit Kevins eigenen gemessenen Dauern aus
 * `arbeits_dauern` (Migration 0061, geschrieben seit dem Arbeitsmodus). Es wird
 * NICHTS geschätzt: fehlt für eine Spur ein Messwert, greift der Median über
 * alle gemessenen Spuren; fehlt jeder Messwert, gibt es keine Zeitangabe statt
 * einer erfundenen. Reine Funktionen — `npx tsx scripts/verify-tagesansage.ts`.
 */

/** Eine gemessene Arbeitseinheit, wie sie in `arbeits_dauern` steht. */
export interface DauerZeile {
  spur: string
  sekunden: number
}

export interface Dauern {
  /** Median in Sekunden je Spur, nur für tatsächlich gemessene Spuren. */
  jeSpur: Partial<Record<Spur, number>>
  /**
   * Wie viele Messwerte hinter jedem Spur-Median stehen. Optional, damit
   * von Hand gebaute `Dauern` (Tests, ältere Aufrufer) gültig bleiben — fehlt
   * der Zähler, gilt der Spur-Median als zu dünn und der Gesamt-Median trägt.
   */
  zaehlerJeSpur?: Partial<Record<Spur, number>>
  /** Median über alle Messwerte — Rückfall für ungemessene Spuren. */
  gesamt: number | null
  /** Wie viele Messwerte dahinterstehen (für „noch zu dünn"-Entscheidungen). */
  messwerte: number
}

function median(werte: number[]): number {
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  // Bei gerader Anzahl der Mittelwert der beiden mittleren — sonst springt der
  // Median bei jedem neuen Messwert um einen ganzen Fall.
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** Median je Spur. Unbrauchbare Zeilen (0 oder negativ) fliegen raus. */
export function medianeJeSpur(zeilen: DauerZeile[]): Dauern {
  const nachSpur = new Map<string, number[]>()
  const alle: number[] = []
  for (const z of zeilen) {
    if (!Number.isFinite(z.sekunden) || z.sekunden <= 0) continue
    const bucket = nachSpur.get(z.spur)
    if (bucket) bucket.push(z.sekunden)
    else nachSpur.set(z.spur, [z.sekunden])
    alle.push(z.sekunden)
  }
  const jeSpur: Partial<Record<Spur, number>> = {}
  const zaehlerJeSpur: Partial<Record<Spur, number>> = {}
  for (const [spur, werte] of nachSpur) {
    jeSpur[spur as Spur] = median(werte)
    zaehlerJeSpur[spur as Spur] = werte.length
  }
  return { jeSpur, zaehlerJeSpur, gesamt: alle.length ? median(alle) : null, messwerte: alle.length }
}

export interface Restarbeit {
  offen: number
  /** Geschätzte Restdauer in Sekunden, null wenn nichts gemessen ist. */
  sekunden: number | null
  /** Wie viele der offenen Posten eine eigene Spur-Messung haben. */
  gemessen: number
}

/**
 * Ab wie vielen Messwerten eine Zahl belastbar ist.
 *
 * Ohne Schwelle sagt eine einzige Messung die Uhrzeit an — die ersten Zeilen in
 * `arbeits_dauern` stammen aus Klick-Tests (11 s, 20 s) und würden einen ganzen
 * Vormittag als „≈ 4 min" ausweisen: eine erfundene Prognose im Gewand einer
 * gemessenen. Lieber die halbe Ansage, bis echte Arbeit gezählt wurde.
 */
export const MIN_MESSWERTE_SPUR = 3
export const MIN_MESSWERTE_GESAMT = 5

/** Summiert die Mediane über die offene Liste. */
export function restarbeit(posten: Posten[], dauern: Dauern): Restarbeit {
  if (posten.length === 0) return { offen: 0, sekunden: null, gemessen: 0 }
  if (dauern.gesamt == null || dauern.messwerte < MIN_MESSWERTE_GESAMT) {
    return { offen: posten.length, sekunden: null, gemessen: 0 }
  }

  let sekunden = 0
  let gemessen = 0
  for (const p of posten) {
    const eigen = dauern.jeSpur[p.spur]
    // Ein Spur-Median aus ein, zwei Messungen ist Rauschen — dann lieber den
    // breiteren Gesamt-Median, der auf mehr Fällen steht.
    if (eigen != null && (dauern.zaehlerJeSpur?.[p.spur] ?? 0) >= MIN_MESSWERTE_SPUR) {
      sekunden += eigen
      gemessen++
    } else {
      sekunden += dauern.gesamt
    }
  }
  return { offen: posten.length, sekunden, gemessen }
}

/** „45 min" / „1 h 40" / „2 h" — kurz genug für eine Unterzeile. */
export function formatDauer(sekunden: number): string {
  const min = Math.max(1, Math.round(sekunden / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`
}

function uhrzeit(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Die Zeile unter „Jetzt dran". Ohne Messwerte bleibt es bei der Zahl — lieber
 * eine halbe Ansage als eine erfundene Uhrzeit.
 */
export function tagesansage(posten: Posten[], dauern: Dauern, jetzt: Date = new Date()): string {
  const r = restarbeit(posten, dauern)
  if (r.offen === 0) return 'Liste leer'
  if (r.sekunden == null) return `${r.offen} offen · noch keine Messwerte`
  const fertig = new Date(jetzt.getTime() + r.sekunden * 1000)
  return `${r.offen} offen · ≈ ${formatDauer(r.sekunden)} · um ${uhrzeit(fertig)} durch`
}
