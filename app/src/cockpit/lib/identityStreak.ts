/**
 * Serien („Streaks") für den Identitäts-Check-in.
 *
 * Blatt-Modul ohne React-/Supabase-Import — dasselbe Muster wie
 * `metrikFelder.ts` und `tagesFlow.ts`, damit `scripts/verify-identitaet.ts`
 * es ohne Vite-Umgebung laden kann.
 *
 * Zwei Fachregeln, an denen die Anzeige hängt. Beide sind bewusst so gewählt,
 * dass die Serie das Verhalten misst und nicht die Uhrzeit:
 *
 * 1. **Der laufende Tag bricht nichts.** Kevin liest die Morgenlese um sieben,
 *    abgehakt wird über den Tag verteilt. Zählte die Serie nur bis „heute
 *    abgehakt", stünde jeden Morgen eine 0 auf dem Bildschirm — die Zahl wäre
 *    genau dann am kleinsten, wenn sie tragen soll. Eine Serie darf deshalb
 *    heute ODER gestern enden. Erst wenn gestern fehlt, ist sie gerissen.
 *
 * 2. **Der Vertriebsblock kennt Werktage, Clean kennt jeden Tag.** Die Regel
 *    lautet „60–90 Minuten Outreach, jeden Werktag" (Visionmap, Regel 5) —
 *    ein Samstag ohne Block ist kein Rückschlag, sondern Samstag. Wochenenden
 *    werden bei `vertriebsblock` deshalb übersprungen: sie zählen nicht mit
 *    und brechen nicht ab. „Clean" gilt dagegen an jedem einzelnen Tag
 *    (Regel 4: „kein THC, kein Tabak") — hier zählt der Kalender lückenlos.
 */

/** Was die Serien-Rechnung von einer Check-in-Zeile braucht. */
export interface StreakTag {
  /** YYYY-MM-DD */
  datum: string
  vertriebsblock: boolean
  clean: boolean
  sport: boolean
}

export type StreakFeld = 'vertriebsblock' | 'clean' | 'sport'

export interface Streak {
  /** Länge der laufenden Serie in gezählten Tagen. */
  laenge: number
  /** Letzter Tag, der die Serie trägt (YYYY-MM-DD) — null, wenn keine läuft. */
  letzterTag: string | null
  /**
   * true, wenn der heutige Tag noch offen ist, die Serie aber über gestern
   * weiterläuft. Die Oberfläche sagt dann „heute noch offen" statt eine Zahl
   * zu zeigen, die schon erledigt aussieht.
   */
  heuteOffen: boolean
}

// ---------------------------------------------------------------------------
// Datums-Helfer. Alles über ISO-Strings und UTC-Mittag — so kann keine
// Sommerzeit-Verschiebung einen Tag verschlucken.
// ---------------------------------------------------------------------------

const TAG_MS = 86_400_000

function alsDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

export function isoTag(d: Date): string {
  const j = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const t = String(d.getUTCDate()).padStart(2, '0')
  return `${j}-${m}-${t}`
}

/** Der Tag davor, als ISO-String. */
export function tagDavor(iso: string): string {
  return isoTag(new Date(alsDate(iso).getTime() - TAG_MS))
}

/** Samstag oder Sonntag? */
export function istWochenende(iso: string): boolean {
  const wt = alsDate(iso).getUTCDay()
  return wt === 0 || wt === 6
}

/**
 * Zählt ein Feld an diesem Tag überhaupt mit?
 *
 * Nur `vertriebsblock` überspringt Wochenenden — siehe Fachregel 2 oben.
 * `sport` läuft bewusst über alle Tage: das Protokoll sagt „jede Woche nach
 * Trainings-/Reha-Protokoll", nicht „werktags".
 */
export function tagZaehlt(feld: StreakFeld, iso: string): boolean {
  if (feld !== 'vertriebsblock') return true
  return !istWochenende(iso)
}

// ---------------------------------------------------------------------------
// Die Serie
// ---------------------------------------------------------------------------

/**
 * Die laufende Serie eines Feldes, rückwärts ab `heute` gerechnet.
 *
 * `zeilen` darf Lücken haben und in beliebiger Reihenfolge kommen; ein
 * fehlender Tag ist ein Tag ohne Haken. Tage nach `heute` werden ignoriert —
 * ein versehentlich in die Zukunft geschriebener Eintrag soll keine Serie
 * erfinden.
 */
export function laufendeSerie(zeilen: StreakTag[], feld: StreakFeld, heute: string): Streak {
  const gesetzt = new Set<string>()
  for (const z of zeilen) {
    if (z.datum > heute) continue
    if (z[feld]) gesetzt.add(z.datum)
  }

  // Startpunkt: heute, wenn heute mitzählt — sonst der letzte zählende Tag
  // davor (Sonntagabend schaut die Vertriebs-Serie also auf den Freitag).
  let cursor = heute
  while (!tagZaehlt(feld, cursor)) cursor = tagDavor(cursor)

  // Fachregel 1: Ist der laufende Tag noch offen, beginnt die Zählung einen
  // zählenden Tag früher — statt die Serie auf 0 zu setzen.
  let heuteOffen = false
  if (!gesetzt.has(cursor)) {
    if (cursor === heute || istWochenende(heute)) heuteOffen = true
    cursor = tagDavor(cursor)
    while (!tagZaehlt(feld, cursor)) cursor = tagDavor(cursor)
    // Auch der Tag davor fehlt → keine laufende Serie.
    if (!gesetzt.has(cursor)) {
      return { laenge: 0, letzterTag: null, heuteOffen: false }
    }
  }

  const letzterTag = cursor
  let laenge = 0
  // Deckel: eine Serie ist nie länger als die geladenen Zeilen — ohne ihn
  // liefe die Schleife bei einem kaputten Datum ins Endlose.
  const deckel = gesetzt.size + 1
  while (gesetzt.has(cursor) && laenge < deckel) {
    laenge++
    do {
      cursor = tagDavor(cursor)
    } while (!tagZaehlt(feld, cursor))
  }

  return { laenge, letzterTag, heuteOffen }
}

/**
 * Der Rekord: die längste je erreichte Serie im geladenen Fenster.
 * Wird neben der laufenden gezeigt, damit ein Riss nicht alles Erreichte
 * unsichtbar macht.
 */
export function laengsteSerie(zeilen: StreakTag[], feld: StreakFeld): number {
  const tage = zeilen
    .filter((z) => z[feld] && tagZaehlt(feld, z.datum))
    .map((z) => z.datum)
    .sort()
  if (tage.length === 0) return 0

  let best = 1
  let lauf = 1
  for (let i = 1; i < tage.length; i++) {
    // Wie viele zählende Tage liegen zwischen den beiden Einträgen?
    let cursor = tage[i]
    do {
      cursor = tagDavor(cursor)
    } while (!tagZaehlt(feld, cursor))
    lauf = cursor === tage[i - 1] ? lauf + 1 : 1
    if (lauf > best) best = lauf
  }
  return best
}

/**
 * Wie viele der letzten `tage` zählenden Tage sind gesetzt — die kleine
 * Punktreihe unter der Zahl („never miss twice", 1%-Methode).
 * Neuester Tag zuletzt.
 */
export function letzteTage(
  zeilen: StreakTag[],
  feld: StreakFeld,
  heute: string,
  tage = 7,
): Array<{ datum: string; gesetzt: boolean; heute: boolean }> {
  const gesetzt = new Set(zeilen.filter((z) => z[feld]).map((z) => z.datum))
  const raus: Array<{ datum: string; gesetzt: boolean; heute: boolean }> = []
  let cursor = heute
  while (!tagZaehlt(feld, cursor)) cursor = tagDavor(cursor)
  for (let i = 0; i < tage; i++) {
    raus.push({ datum: cursor, gesetzt: gesetzt.has(cursor), heute: cursor === heute })
    do {
      cursor = tagDavor(cursor)
    } while (!tagZaehlt(feld, cursor))
  }
  return raus.reverse()
}
