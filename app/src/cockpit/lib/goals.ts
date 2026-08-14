/**
 * Sales-Ziele (REBUILD-PLAN §9, Quelle: Kevins KPI-System).
 * Wochenziele + back-loaded Soll-Kurve Juli 2026. August analog generiert.
 * v1 fest verdrahtet — später konfigurierbar.
 */

/**
 * Die Wochenziele. **Auf Kevins Wort neu gesetzt am 12.08.2026** — die alten
 * Zahlen (75/75/25) stammten aus dem Split einer Sammel-150 und hatten mit dem
 * echten Rhythmus nichts mehr zu tun.
 *
 * Woher die neuen kommen:
 * - **Anfragen 180** — der reale Sende-Rhythmus, nicht 30/Tag: Blöcke von
 *   ~65–70 Einladungen an ~3 Tagen die Woche (Funnel-Baseline, 27.07.).
 * - **Nachrichten 40** — aus derselben Baseline gerechnet: 180 Anfragen bei
 *   ~16 % Annahme sind ~30 Kontakte, davon ~60 % ICP → ~20 Erstnachrichten,
 *   plus die Antworten darauf.
 * - **Looms 10** — zwei am Tag: proaktive Anbahnung plus die zugesagten
 *   Analysen. Die alten 25 hat Kevin nie erreicht und nie angestrebt.
 *
 * **Diese Zahlen steuern zwei Dinge:** die Vitals-Balken (`metricsAggregate`)
 * UND die Tagesziele im Zähl-Modus (`tagesFlow.ts` teilt durch
 * `ARBEITSTAGE_WOCHE`). Wer hier justiert, verschiebt beides — das ist
 * Absicht, es soll nur eine Zahlenreihe geben.
 *
 * Anfragen sind die Ausnahme: ihr Tagesziel bleibt `ANFRAGEN_LIMIT_TAG = 30`
 * aus `prioritaet.ts`, weil das Tageslimit eine andere Größe ist als das
 * Wochenziel — Kevin schickt in Blöcken, nicht gleichmäßig.
 */
export const WEEK_TARGETS = {
  // Anfragen = LI-Vernetzung + IG-Follows, Nachrichten = LI- + IG-Nachrichten
  // (beide Summen bildet `metricsAggregate`).
  anfragen: 180,
  nachrichten: 40,
  looms: 10,
  termine: 5, // neu vereinbarte Termine (alle Herkunfts-Kanäle)
  abschluesse: 2,
} as const

/** Kumulierte Umsatz-Soll-Werte je Kalenderwoche (back-loaded, Sales-Lag ~2 Wo). */
export interface WeekTarget {
  kw: number
  /** ISO-Montag der Woche */
  weekStart: string
  /** kumuliertes Umsatz-Soll in € zum Wochenende */
  sollKumuliert: number
}

export const JULY_2026_CURVE: WeekTarget[] = [
  { kw: 28, weekStart: '2026-07-06', sollKumuliert: 3000 },
  { kw: 29, weekStart: '2026-07-13', sollKumuliert: 11000 },
  { kw: 30, weekStart: '2026-07-20', sollKumuliert: 20000 },
  { kw: 31, weekStart: '2026-07-27', sollKumuliert: 30000 },
]

/**
 * **August-Ziel 15.000 € — auf Kevins Wort neu gesetzt am 14.08.2026.**
 *
 * Die alten 50.000 € waren zur Monatsmitte bei 0 € Ist nicht mehr erreichbar;
 * 15.000 € sind drei Erstaufträge à 5.000 € und damit eine Zahl, an der man
 * ablesen kann, ob der Monat läuft.
 *
 * Zweiter Fehler, der hier lag: die Kurve endete am **24.08.** — der Montag
 * 31.08. fehlte, obwohl er noch im August liegt. Das Ziel musste also faktisch
 * eine Woche früher stehen. Jetzt fünf ISO-Montage, back-loaded mit demselben
 * Exponenten wie `backLoadedCurve` (1.6), letzter Montag trifft den Total exakt.
 */
export const AUGUST_2026_CURVE: WeekTarget[] = [
  { kw: 32, weekStart: '2026-08-03', sollKumuliert: 1143 },
  { kw: 33, weekStart: '2026-08-10', sollKumuliert: 3462 },
  { kw: 34, weekStart: '2026-08-17', sollKumuliert: 6626 },
  { kw: 35, weekStart: '2026-08-24', sollKumuliert: 10496 },
  { kw: 36, weekStart: '2026-08-31', sollKumuliert: 15000 },
]

export const MONTH_TARGETS: Record<string, { label: string; total: number; curve: WeekTarget[] }> = {
  '2026-07': { label: 'Juli 2026', total: 30000, curve: JULY_2026_CURVE },
  '2026-08': { label: 'August 2026', total: 15000, curve: AUGUST_2026_CURVE },
}

// CHANNEL_BENCHMARKS entfernt (ohne Importeur): die Benchmark-Bänder leben
// bereits in metricsAggregate.channelRates — zwei Quellen für dieselbe Zahl
// waren eine Drift-Falle.

/**
 * Conversion-Zielquoten des Coachings (Agentur Inkubator / Marcel Steljes,
 * Outreach-Tracker). „min" = Zielband-Untergrenze, „great" = „sehr gut".
 */
export const CONVERSION_TARGETS = {
  nachrichtLoom: { label: 'Nachricht → Loom', min: 0.1, max: 0.2, great: 0.2 },
  loomQuali: { label: 'Loom → Quali-Call', min: 0.1, max: 0.3, great: 0.3 },
  qualiKunde: { label: 'Quali → Kunde', min: 0.25, max: 0.5, great: 0.5 },
} as const

/**
 * Nordstern / Traumleben (Zielplanung 2026, Interview 09.07.2026).
 * Netto-Wunsch → nötiger Agentur-Umsatz (Faustregel Faktor ~2) → getragen aus zwei Töpfen:
 * Neukunden-Cash (Projekt + Setup) + Retainer-MRR (Leadgen, kumulativ).
 * Kernmeilenstein: 20 aktive Leadgen-Retainer = 10.000 € MRR → „Freundin/Familie kann aufhören".
 */
export const LIFE_TARGET = {
  nettoMonat: 20000,
  umsatzMonat: 40000, // ≈ netto × Faktor 2,0 (Steuern/Abgaben/Betrieb/Reinvest)
  cashProKunde: 5500, // Branding & Website 3.500 + Leadgen Setup 2.000 (einmalig)
  mrrProKunde: 500, // Leadgen-Retainer (+ Beteiligung, hier nicht beziffert)
  neukundenProMonat: 5,
  mrrMeilenstein: 10000, // Freundin/Familie kann aufhören zu arbeiten
  retainerKundenZiel: 20, // = mrrMeilenstein / mrrProKunde
} as const

// RETAINER_KUNDEN_KEY entfernt (ohne Importeur): die Retainer-Zahl kommt aus
// dem CRM (computeMrrMetrics), nicht mehr aus einem localStorage-Handstand.

/** Aktuelles Soll für "heute" aus einer Kurve interpolieren (Wochenende = voller Wert). */
export function currentSoll(curve: WeekTarget[], today = new Date()): number {
  let soll = 0
  for (const w of curve) {
    const start = new Date(`${w.weekStart}T00:00:00`)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    if (today >= end) soll = w.sollKumuliert
  }
  return soll
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

// ---------------------------------------------------------------------------
// Monatsziel für JEDEN Monat (nicht mehr nur Juli/Aug 2026 hartverdrahtet).
// Juli/August bleiben exakt wie oben; alle anderen Monate werden generiert:
// Total = localStorage-Override (`cockpit.monthTarget.<YYYY-MM>`) oder ein
// Planungs-Default; Kurve back-loaded über die ISO-Montage des Monats.
// ---------------------------------------------------------------------------

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const

/** Planungs-Default, bis Kevin für den Monat ein echtes Ziel setzt. */
export const DEFAULT_MONTH_TOTAL = LIFE_TARGET.umsatzMonat

export interface MonthTarget {
  label: string
  total: number
  curve: WeekTarget[]
  /** true, wenn die Kurve generiert wurde (kein hartverdrahteter Monat). */
  generated: boolean
}

function goalYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** ISO-Montage, deren Datum in den Monat fällt (wie die hartverdrahteten Kurven). */
function isoMondaysOfMonth(year: number, monthIndex: number): Date[] {
  const mondays: Date[] = []
  const d = new Date(year, monthIndex, 1)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  while (d.getMonth() === monthIndex) {
    mondays.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return mondays
}

/** Back-loaded kumulierte Kurve (Sales-Lag): letzter Montag trifft den Total exakt. */
function backLoadedCurve(mondays: Date[], total: number): WeekTarget[] {
  const n = mondays.length || 1
  return mondays.map((m, i) => ({
    kw: isoWeek(m),
    weekStart: goalYmd(m),
    sollKumuliert: Math.round(total * Math.pow((i + 1) / n, 1.6)),
  }))
}

/**
 * Optionales, vom Nutzer gesetztes Monats-Total (localStorage).
 *
 * Nur noch Rückfallebene: die führende Quelle ist die Tabelle `month_goals`
 * (Migration 0062, Hook useMonthGoal) — localStorage divergierte zwischen Mac
 * und Handy. Greift, solange die Migration nicht eingespielt ist.
 */
export function monthTotalOverride(monthKey: string): number | null {
  try {
    const raw = localStorage.getItem(`cockpit.monthTarget.${monthKey}`)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function setMonthTotalOverride(monthKey: string, total: number | null): void {
  try {
    if (total && total > 0) {
      localStorage.setItem(`cockpit.monthTarget.${monthKey}`, String(Math.round(total)))
    } else {
      localStorage.removeItem(`cockpit.monthTarget.${monthKey}`)
    }
  } catch {
    /* ignore */
  }
}

/**
 * Monatsziel für einen Schlüssel `YYYY-MM` — hartverdrahtet (Juli/Aug 2026)
 * oder generiert. Gibt null nur bei kaputtem Schlüssel zurück.
 *
 * `overrideTotal` kommt aus `month_goals` (useMonthGoal) und schlägt alles
 * andere — auch die hartverdrahteten Monate, deren Kurve dann proportional
 * mitskaliert. `undefined` heißt „nichts gesetzt", nicht „auf 0 setzen".
 */
export function monthTargetFor(
  monthKey: string,
  overrideTotal?: number | null,
): MonthTarget | null {
  const fixed = MONTH_TARGETS[monthKey]
  if (fixed) {
    if (overrideTotal && overrideTotal > 0 && overrideTotal !== fixed.total) {
      const faktor = overrideTotal / fixed.total
      return {
        label: fixed.label,
        total: overrideTotal,
        curve: fixed.curve.map((w) => ({ ...w, sollKumuliert: Math.round(w.sollKumuliert * faktor) })),
        generated: false,
      }
    }
    return { ...fixed, generated: false }
  }

  const [ys, ms] = monthKey.split('-')
  const year = Number(ys)
  const monthIndex = Number(ms) - 1
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null

  const total = overrideTotal ?? monthTotalOverride(monthKey) ?? DEFAULT_MONTH_TOTAL
  return {
    label: `${MONTHS_DE[monthIndex]} ${year}`,
    total,
    curve: backLoadedCurve(isoMondaysOfMonth(year, monthIndex), total),
    // „geplant" heißt: niemand hat für diesen Monat ein Ziel gesetzt.
    generated: overrideTotal == null,
  }
}

/** Monatsschlüssel `YYYY-MM` für ein Datum (überall derselbe Schlüssel). */
export function monthKeyOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
