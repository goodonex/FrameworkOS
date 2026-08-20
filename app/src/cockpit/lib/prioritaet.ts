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
  | 'aufgabe'
  | 'anfrage'
  | 'inmail'

/**
 * Fest verdrahtete Rangfolge — Rang 1 zuerst. Kein Ermessen für den Executor.
 *
 * `aufgabe` (eigene Aufgabe ohne Projekt) steht bewusst HINTER allen
 * LinkedIn-Spuren: Kevin am 14.08.2026 — „Priorität hat jetzt LinkedIn." Vorher
 * tauchten diese Aufgaben überhaupt nicht auf, weil `kundenaufgabenPosten` auf
 * `project_id` filtert; eine seit 73 Tagen überfällige lag damit unsichtbar im
 * System. Sichtbar ja, aber nicht vor dem Vertrieb.
 */
export const RANGFOLGE: Spur[] = [
  'kundenaufgabe',
  'kunde_liegt',
  'antwort',
  'loom',
  'erstnachricht',
  'followup',
  'aufgabe',
  'anfrage',
  'inmail',
]

/**
 * Vorbereiteter, versandfertiger Text am Posten (Etappe 3, Schritt 3) — heute
 * der Antwort-Entwurf des Nacht-Agenten. Liegt einer an, gilt das Kopier-Gesetz:
 * die Oberfläche zeigt „Nachricht kopieren".
 */
export interface PostenEntwurf {
  text: string
  /** Der Lead hat NACH dem Entwurf erneut geschrieben — nicht blind verschicken. */
  veraltet: boolean
  /** Wann der Entwurf entstand (ISO), für die Zeile am Posten. */
  erstelltAm: string | null
}

/** Ein Arbeitsposten für den Arbeitsmodus (Zug 3). */
export interface Posten {
  /** eindeutig über alle Spuren hinweg (z. B. `thread:<id>`, `task:<id>`) */
  id: string
  spur: Spur
  name: string
  firma?: string
  website?: string
  /**
   * LinkedIn-Profil des Leads. Bei Threads steckt es in `website` (dort ist es
   * das einzige Ziel); Erstnachrichten brauchen beides — die Firmenseite zum
   * Recherchieren und das Profil zum Anschreiben. Kevin sucht sonst von Hand
   * nach dem Namen, und genau das scheitert, wenn LinkedIn ihn zerschossen
   * ausliefert („Maurice Jnglin", 18.08.2026).
   */
  profil?: string
  /** Nachricht, Loom-Skript oder Aufgabenbeschreibung — white-space: pre-wrap in der UI */
  text: string
  /** ISO-Zeitstempel für die Alterssortierung; null sortiert ans Ende seiner Spur */
  timestamp: string | null
  /** LinkedIn-Stern (Loom zugesagt) — sticht innerhalb der Spur vor das Alter */
  starred?: boolean
  /** Vorbereitete Nachricht, die hier nur noch kopiert werden muss */
  entwurf?: PostenEntwurf
  /**
   * Erinnerungs-Posten ohne eigene Zeile in einer Tabelle (O7 / Wargame Zug 8):
   * Die Wahrheit steht woanders — beim Anfragen-Posten im Zaehler. Solche
   * Posten haben GENAU EINE Aktion und duerfen **nie** durch `erledigePosten`
   * laufen: `metrikFeldFuer('anfrage')` ist `li_anfragen`, ein Haken wuerde
   * also oben drauf zaehlen. Sie verschwinden von selbst, wenn die Quelle es
   * sagt.
   */
  nurZaehler?: true
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
    out.push(...[...bucket].sort(spur === 'loom' ? frischeZuerst : dringlichkeit))
  }
  return out
}

/**
 * Looms drehen die Alters-Regel um (19.08.2026, Kevins Ansage).
 *
 * Überall sonst gilt: was am längsten liegt, ist am dringendsten. Bei einer
 * zugesagten Analyse ist es andersherum — wer gestern „ja, schick rüber"
 * geschrieben hat, wartet gerade darauf; wer das vor zwei Monaten schrieb, hat
 * es vergessen. Die frischeste Zusage konvertiert am besten, die alten stehen
 * unten und zeigen ehrlich, was liegen geblieben ist.
 */
function frischeZuerst(a: Posten, b: Posten): number {
  const ta = a.timestamp ? new Date(a.timestamp).getTime() : Number.NEGATIVE_INFINITY
  const tb = b.timestamp ? new Date(b.timestamp).getTime() : Number.NEGATIVE_INFINITY
  return tb - ta
}

/**
 * „vor 5 Tagen · 14.08." — der Stand einer Nachricht am Posten. Ohne
 * Zeitstempel bleibt die Zeile leer, statt ein Datum zu erfinden.
 */
export function nachrichtStand(iso: string | null, jetzt: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const tage = Math.floor((jetzt.getTime() - d.getTime()) / 86_400_000)
  const datum = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  const wann = tage <= 0 ? 'heute' : tage === 1 ? 'gestern' : `vor ${tage} Tagen`
  return `${wann} · ${datum}`
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
