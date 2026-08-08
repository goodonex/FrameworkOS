/**
 * Die Reihenfolge der App-Kacheln auf dem Homescreen (O18 v2 d + e).
 *
 * Bewusst ohne React und ohne Supabase: reine Funktionen, die
 * `scripts/verify-kachel-reihenfolge.ts` ohne Browser prüfen kann — dasselbe
 * Muster wie `prioritaet.ts` und `tagesansage.ts`. Wo die Reihenfolge
 * gespeichert wird, entscheidet `uiSettings.ts`.
 */

/** Der eine Schlüssel, den v2 (d) benutzt. */
export const KACHEL_REIHENFOLGE = 'home.kachelReihenfolge'

/**
 * Gespeicherte Reihenfolge auf die tatsächlich vorhandenen Bereiche anwenden.
 *
 * Robust gegen beide Richtungen von Drift: ein Bereich, der aus der Registry
 * verschwindet, fällt raus; ein neuer, den die gespeicherte Liste nicht kennt,
 * landet hinten statt zu fehlen. Ohne das würde eine alte Anordnung neue
 * Bereiche unsichtbar machen — der Fehler, den man erst Wochen später merkt.
 */
export function ordneNach<T extends { path: string }>(bereiche: T[], reihenfolge: string[]): T[] {
  const rang = new Map(reihenfolge.map((p, i) => [p, i]))
  return [...bereiche].sort((a, b) => {
    const ra = rang.get(a.path)
    const rb = rang.get(b.path)
    if (ra == null && rb == null) return 0
    if (ra == null) return 1
    if (rb == null) return -1
    return ra - rb
  })
}

/**
 * Reihenfolge nach Tageszeit (v2 e) — **nur als Standard**.
 *
 * Der Vorbehalt gehört zur Funktion: ein Grid, das sich selbst umsortiert,
 * kostet Muskelgedächtnis, und Muskelgedächtnis ist auf einem Homescreen die
 * halbe Geschwindigkeit. Deshalb zwei Grenzen:
 *
 * 1. Sie greift **nur, solange niemand selbst angeordnet hat**. Ein einziges
 *    „Anordnen" friert die Reihenfolge für immer ein (v2 d gewinnt).
 * 2. Sie schiebt nur drei Kacheln nach vorn und lässt den Rest in
 *    Registry-Reihenfolge. Drei Wechsel am Tag, keine Kachel-Lotterie.
 *
 * Reine Funktion der Stunde — keine Daten, keine Abfrage.
 */
export function kontextReihenfolge(stunde: number): string[] {
  // Morgens liegen die Entwürfe der Nacht da und die Akquise steht an.
  if (stunde < 11) return ['/freigaben', '/sales', '/linkedin']
  // Tagsüber: Termine stehen fest, dazwischen Kundenarbeit.
  if (stunde < 18) return ['/sales', '/termine', '/projekte']
  // Abends wird eingetragen und der nächste Content vorbereitet.
  return ['/tracking', '/content', '/projekte']
}

/** Einen Bereich vor einen anderen setzen (Ergebnis der Tipp-Tipp-Geste). */
export function verschiebeVor(reihenfolge: string[], was: string, vor: string): string[] {
  if (was === vor) return reihenfolge
  const ohne = reihenfolge.filter((p) => p !== was)
  const i = ohne.indexOf(vor)
  if (i === -1) return [...ohne, was]
  return [...ohne.slice(0, i), was, ...ohne.slice(i)]
}
