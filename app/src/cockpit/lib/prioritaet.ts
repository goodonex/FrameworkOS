/**
 * Prioritätenliste (Wargame docs/wargames/sales-arbeitsmodus.md, Zug 1).
 * Reine Funktionen, keine Netzwerkaufrufe — per `npx tsx scripts/verify-prioritaet.ts`
 * gegen Fixtures prüfbar.
 *
 * Beantwortet EINE Frage: in welcher Reihenfolge? Keine Gewichtung, kein
 * Punktesystem — die Rangfolge ist eine feste Liste (Kevins Gesetz: erst raus,
 * was Kunden schulden). Gibt IMMER alle Posten zurück, nie ein Tagespensum —
 * die Oberfläche kürzt selbst mit „weitere anzeigen".
 */

export type Spur =
  | 'kundenaufgabe'
  | 'kunde_liegt'
  | 'antwort'
  | 'loom'
  | 'erstnachricht'
  | 'followup'
  | 'anfrage'
  | 'inmail'

/** Fest verdrahtete Rangfolge — Rang 1 zuerst. Kein Ermessen für den Executor. */
export const RANGFOLGE: Spur[] = [
  'kundenaufgabe',
  'kunde_liegt',
  'antwort',
  'loom',
  'erstnachricht',
  'followup',
  'anfrage',
  'inmail',
]

/** Ein Arbeitsposten für den Arbeitsmodus (Zug 3). */
export interface Posten {
  /** eindeutig über alle Spuren hinweg (z. B. `thread:<id>`, `task:<id>`) */
  id: string
  spur: Spur
  name: string
  firma?: string
  website?: string
  /** Nachricht, Loom-Skript oder Aufgabenbeschreibung — white-space: pre-wrap in der UI */
  text: string
  /** ISO-Zeitstempel für die Alterssortierung; null sortiert ans Ende seiner Spur */
  timestamp: string | null
  /** LinkedIn-Stern (Loom zugesagt) — sticht innerhalb der Spur vor das Alter */
  starred?: boolean
}

/** Rohquellen je Spur — fehlt eine (Tabelle nicht migriert), fehlt nur diese Spur. */
export type PostenQuellen = Partial<Record<Spur, Posten[]>>

function dringlichkeit(a: Posten, b: Posten): number {
  const sternDiff = Number(b.starred ?? false) - Number(a.starred ?? false)
  if (sternDiff !== 0) return sternDiff
  const ta = a.timestamp ? new Date(a.timestamp).getTime() : Number.POSITIVE_INFINITY
  const tb = b.timestamp ? new Date(b.timestamp).getTime() : Number.POSITIVE_INFINITY
  return ta - tb
}

/**
 * Ordnet alle Posten über alle Spuren hinweg. `heute` fließt bewusst NICHT in
 * die Sortierung ein (die ist rein spuren- und alters-basiert) — der Parameter
 * steht hier, weil aufrufender Code (Kacheln, Arbeitsmodus) denselben
 * Zeitpunkt für „heute" braucht und ihn nicht zweimal herleiten soll.
 */
export function ordnePosten(quellen: PostenQuellen, _heute: Date): Posten[] {
  const out: Posten[] = []
  for (const spur of RANGFOLGE) {
    const bucket = quellen[spur] ?? []
    out.push(...[...bucket].sort(dringlichkeit))
  }
  return out
}

/** Kevins einzig echtes Tageslimit — Vernetzungsanfragen. Alles andere ist unbegrenzt. */
export const ANFRAGEN_LIMIT_TAG = 30

/**
 * RECON-1 (offen): Kevin ist unsicher, ob 150 ein Gesamtstand oder ein
 * Monatskontingent ist. Bis zur Klärung als neutraler Bestand geführt, nicht
 * als Tagesration erfunden.
 */
export const INMAIL_CREDITS_STAND = 150

export interface Tagesstand {
  anfragenHeute: number
  anfragenLimit: number
  inmailCredits: number
}

/**
 * Nur zum ANZEIGEN der Zähler — schneidet nie Listen ab. `inmailCredits` ist
 * kein Feld aus `daily_metrics` (das gibt es nicht, siehe RECON-1) und wird
 * deshalb separat übergeben statt erfunden.
 */
export function tagesstand(
  metrikZeile: { li_anfragen: number },
  inmailCredits: number = INMAIL_CREDITS_STAND,
): Tagesstand {
  return {
    anfragenHeute: metrikZeile.li_anfragen,
    anfragenLimit: ANFRAGEN_LIMIT_TAG,
    inmailCredits,
  }
}
