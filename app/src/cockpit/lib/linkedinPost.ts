/**
 * Die Rechenregeln für LinkedIn-Beiträge (Phase 2, Zug C1 · D10).
 *
 * Reine Funktionen, absichtlich ohne React — damit `scripts/verify-linkedin-content.ts`
 * sie ohne Vite-Umgebung laden kann (Zug C2), so wie `metrikFelder.ts` und
 * `metricsDates.ts` es vormachen.
 */

/**
 * Ab hier klappt LinkedIn den Beitrag zusammen („…mehr"). Was danach kommt,
 * liest nur, wer klickt — deshalb ist das die Marke, die im Editor sichtbar
 * ist, nicht das harte Limit.
 */
export const SICHTBARE_MARKE = 1300

/** Das harte Limit eines LinkedIn-Beitrags. */
export const MAX_ZEICHEN = 3000

export interface Zeichenstand {
  /** Zeichen insgesamt (so, wie LinkedIn selbst zählt: Zeichen, nicht Bytes). */
  gesamt: number
  /** Wie viele davon vor dem Zusammenklappen stehen. */
  sichtbar: number
  /** Wie viele bis zum harten Limit noch frei sind (nie negativ). */
  frei: number
  /** Über der sichtbaren Marke — nur ein Hinweis, kein Fehler. */
  ueberMarke: boolean
  /** Über dem harten Limit — das lässt LinkedIn nicht durch. */
  ueberLimit: boolean
}

/**
 * Zählt einen Beitrag aus.
 *
 * Gezählt wird mit dem Spread-Operator statt `.length`: `.length` liefert
 * UTF-16-Code-Units, ein Emoji zählte damit doppelt. LinkedIn zählt Zeichen.
 */
export function zeichenstand(text: string): Zeichenstand {
  const gesamt = [...text].length
  return {
    gesamt,
    sichtbar: Math.min(gesamt, SICHTBARE_MARKE),
    frei: Math.max(0, MAX_ZEICHEN - gesamt),
    ueberMarke: gesamt > SICHTBARE_MARKE,
    ueberLimit: gesamt > MAX_ZEICHEN,
  }
}

/**
 * Die Vorschau-Zeile in der Liste: erste sinnvolle Zeile, gekürzt.
 * Leerzeilen und reine Hashtag-Zeilen taugen nicht als Titel.
 */
export function vorschauZeile(text: string, laenge = 90): string {
  const zeile = text
    .split('\n')
    .map((z) => z.trim())
    .find((z) => z.length > 0 && !z.startsWith('#'))
  if (!zeile) return ''
  return [...zeile].length <= laenge ? zeile : `${[...zeile].slice(0, laenge - 1).join('')}…`
}

/**
 * Der Ordner-Hinweis für Bild-Beiträge: LinkedIn-Bilder lädt Kevin von Hand
 * hoch, die App kann das nicht. Sie kann aber sagen, wo die Dateien liegen.
 * Gibt den gemeinsamen Ordner der Slides zurück — oder null, wenn es keine
 * gibt (dann ist es ein reiner Text-Beitrag und der Hinweis wäre Lärm).
 */
export function slidesOrdner(pfade: string[]): string | null {
  if (pfade.length === 0) return null
  // `lastIndexOf` liefert bei einer Datei ohne Ordner -1 — `slice(0, -1)` haette
  // daraus „1.pn" gemacht. Der eigene Test hat das gefunden (Zug C2).
  const ordner = pfade.map((p) => {
    const i = p.lastIndexOf('/')
    return i < 0 ? '' : p.slice(0, i).replace(/\/+$/, '')
  })
  const erster = ordner[0] ?? ''
  return ordner.every((o) => o === erster) && erster !== '' ? erster : null
}
