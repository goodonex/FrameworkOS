/**
 * Die Kadenz — alle Wartezeiten des Lead-Systems an einer Stelle
 * (25.08.2026, Blaupause `docs/wargames/pipeline-board.md`, Zug 5).
 *
 * **Bis hierher standen diese Zahlen als Konstanten in `leadStation.ts` und
 * `linkedinFollowups.ts`.** Kevin wollte sie justieren können — und das ist der
 * gefährlichste Eingriff dieser Runde: An `bucketOf` hängt jede Fälligkeit im
 * Cockpit. Eine falsche Zahl macht 600 Leute auf einen Schlag fällig oder
 * keinen mehr.
 *
 * Drei Dinge halten das zusammen:
 *
 * 1. **Der Vorgabewert IST das bisherige Verhalten.** Ohne gespeicherte
 *    Überschreibung rechnet alles exakt wie vorher — `verify-kadenz.ts` prüft
 *    das gegen feste Zahlen, nicht gegen diese Datei (sonst würde ein
 *    verrutschter Vorgabewert einfach mitgefeiert).
 * 2. **Jeder Wert wird geprüft, bevor er gilt.** Der Wert kommt aus einer
 *    Key-Value-Tabelle und war dort schon alles Mögliche. Muster:
 *    `gueltigesZiel` in `tagesFlow.ts`.
 * 3. **Die Oberfläche zeigt die Folge VOR dem Speichern.** Das ist der
 *    eigentliche Schutz — nicht diese Datei, sondern der Satz „heute fällig:
 *    163 → 412", den Kevin liest, solange die Änderung noch reversibel ist.
 *
 * **Warum ein Modul-Singleton (Route B der Blaupause).** Die Kadenz durch alle
 * Signaturen zu fädeln hätte `bucketOf`, `isDue`, `leadStation`,
 * `followupPosten`, `antwortPosten`, `funnelStufen` und deren sämtliche
 * Aufrufer erfasst — reine Funktionen tief in `arbeitsmodusQuellen`, die keinen
 * Zugang zu einem React-Hook haben. Also: ein Wert, einmal beim Laden gesetzt,
 * und überall als **Vorgabe** eines weiterhin explizit übergebbaren Parameters.
 * Die Prüfskripte reichen ihn ausdrücklich mit und bleiben damit rein.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-kadenz.ts`.
 */

export interface Kadenz {
  /** Die drei LinkedIn-Follow-up-Schwellen in Tagen, aufsteigend. */
  followupTage: readonly [number, number, number]
  /** Stiller Zweig: ab wann ein Nicht-Annehmer eine E-Mail bekommt. */
  stillEmailTage: number
  stillPostkarteTage: number
  stillAnrufTage: number
  /** Lauter Zweig: nach der dritten Follow-up-Stufe. */
  lautInstagramTage: number
  lautPdfTage: number
  lautPostkarteTage: number
  lautAnrufTage: number
  /** Mindestabstand zwischen zwei ausgehenden Kontakten, über alle Kanäle. */
  mindestabstandTage: number
  /** Wie lange ein durchlaufener Lead ruht, bevor er von selbst wiederkommt. */
  ruheMonate: number
}

/**
 * Die Werte, mit denen das System bis zum 25.08.2026 gerechnet hat.
 *
 * **Diese Zahlen sind die Wahrheit, nicht eine Kopie davon.**
 * `leadStation.ts` und `linkedinFollowups.ts` re-exportieren sie, damit die
 * bestehenden Importe und ihre Prüfskripte gültig bleiben.
 */
export const KADENZ_STANDARD: Kadenz = {
  followupTage: [3, 7, 14],
  stillEmailTage: 30,
  stillPostkarteTage: 7,
  stillAnrufTage: 7,
  lautInstagramTage: 7,
  lautPdfTage: 14,
  lautPostkarteTage: 21,
  lautAnrufTage: 7,
  mindestabstandTage: 7,
  ruheMonate: 4,
}

/** Grenzen je Feld. Ausserhalb → der Vorgabewert, nie ein halb gültiger Wert. */
const TAGE_MIN = 1
const TAGE_MAX = 365
const RUHE_MONATE_MIN = 1
const RUHE_MONATE_MAX = 24

function gueltigeTage(wert: unknown, min = TAGE_MIN, max = TAGE_MAX): wert is number {
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= min && wert <= max
}

/**
 * Eine gespeicherte Kadenz einlesen — feldweise, mit Rückfall auf die Vorgabe.
 *
 * **Feldweise und nicht als Ganzes:** Ein einzelner kaputter Wert soll nicht
 * neun gute mitreissen. Wer `ruheMonate: "vier"` in der Tabelle stehen hat,
 * bekommt vier Monate und behält seine geänderten Follow-up-Tage.
 *
 * Die Ausnahme ist `followupTage` — dort gilt zusätzlich die Monotonie, und die
 * ist eine Eigenschaft des Tripels, nicht der einzelnen Zahl.
 */
export function gueltigeKadenz(roh: unknown): Kadenz {
  if (typeof roh !== 'object' || roh === null) return KADENZ_STANDARD
  const q = roh as Record<string, unknown>

  const zahl = (feld: keyof Kadenz, min?: number, max?: number): number => {
    const wert = q[feld]
    return gueltigeTage(wert, min, max) ? wert : (KADENZ_STANDARD[feld] as number)
  }

  /**
   * `[14, 7, 3]` würde die Stufen gegeneinander laufen lassen: Stufe 2 wäre vor
   * Stufe 1 fällig, und `isDue` liefe für dieselbe Person mehrfach an. Nicht
   * aufsteigend heisst deshalb: das ganze Tripel zurück auf die Vorgabe.
   */
  const rohTage = q.followupTage
  let followupTage = KADENZ_STANDARD.followupTage
  if (Array.isArray(rohTage) && rohTage.length === 3 && rohTage.every((t) => gueltigeTage(t))) {
    const [a, b, c] = rohTage as [number, number, number]
    if (a < b && b < c) followupTage = [a, b, c]
  }

  return {
    followupTage,
    stillEmailTage: zahl('stillEmailTage'),
    stillPostkarteTage: zahl('stillPostkarteTage'),
    stillAnrufTage: zahl('stillAnrufTage'),
    lautInstagramTage: zahl('lautInstagramTage'),
    lautPdfTage: zahl('lautPdfTage'),
    lautPostkarteTage: zahl('lautPostkarteTage'),
    lautAnrufTage: zahl('lautAnrufTage'),
    mindestabstandTage: zahl('mindestabstandTage'),
    ruheMonate: zahl('ruheMonate', RUHE_MONATE_MIN, RUHE_MONATE_MAX),
  }
}

/** Der Schlüssel in `ui_settings` (Migration 0068). */
export const KADENZ_SCHLUESSEL = 'kadenz'

let aktiv: Kadenz = KADENZ_STANDARD

/**
 * Die gerade geltende Kadenz — Vorgabe aller Rechenfunktionen.
 *
 * Wer sie explizit übergibt (Prüfskripte, die Vorschau in der Oberfläche),
 * umgeht dieses Singleton vollständig. Es ist eine Voreinstellung, kein
 * versteckter Zustand.
 */
export function aktiveKadenz(): Kadenz {
  return aktiv
}

/**
 * Einmal beim Laden aus `ui_settings` setzen (`useKadenz`).
 *
 * Läuft ausdrücklich durch `gueltigeKadenz`: Auch ein direkter Aufruf mit
 * Unsinn kann die Fälligkeit nicht vergiften.
 */
export function setzeAktiveKadenz(roh: unknown): void {
  aktiv = gueltigeKadenz(roh)
}

/** Für Prüfskripte: zurück auf den Auslieferungszustand. */
export function setzeKadenzZurueck(): void {
  aktiv = KADENZ_STANDARD
}

/**
 * Die Felder für die Oberfläche — Beschriftung, Bereich und was daran hängt.
 *
 * Steht hier und nicht im Markup, damit ein neues Kadenz-Feld an EINER Stelle
 * entsteht und die Oberfläche es von selbst zeigt.
 */
export interface KadenzFeld {
  schluessel: Exclude<keyof Kadenz, 'followupTage'>
  titel: string
  hinweis: string
  min: number
  max: number
  einheit: 'Tage' | 'Monate'
}

export const KADENZ_FELDER: readonly KadenzFeld[] = [
  {
    schluessel: 'stillEmailTage',
    titel: 'Bis zur E-Mail',
    hinweis: 'Wer die Anfrage nie angenommen hat, bekommt nach so vielen Tagen eine E-Mail.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'stillPostkarteTage',
    titel: 'E-Mail → Postkarte',
    hinweis: 'Stiller Zweig.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'stillAnrufTage',
    titel: 'Postkarte → Anruf',
    hinweis: 'Stiller Zweig.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'lautInstagramTage',
    titel: 'Letztes Follow-up → Instagram',
    hinweis: 'Der Kanalwechsel nach der dritten LinkedIn-Nachricht.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'lautPdfTage',
    titel: 'Instagram → Analyse-PDF',
    hinweis: 'Lauter Zweig.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'lautPostkarteTage',
    titel: 'PDF → Postkarte',
    hinweis: 'Lauter Zweig.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'lautAnrufTage',
    titel: 'Postkarte → Anruf',
    hinweis: 'Lauter Zweig. Die Karte ist der Aufhänger.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'mindestabstandTage',
    titel: 'Mindestabstand',
    hinweis: 'Zwischen zwei ausgehenden Kontakten, über alle Kanäle hinweg.',
    min: TAGE_MIN,
    max: TAGE_MAX,
    einheit: 'Tage',
  },
  {
    schluessel: 'ruheMonate',
    titel: 'Ruhe nach der Kette',
    hinweis: 'Danach kommt der Lead mit neuem Aufhänger von selbst wieder.',
    min: RUHE_MONATE_MIN,
    max: RUHE_MONATE_MAX,
    einheit: 'Monate',
  },
]
