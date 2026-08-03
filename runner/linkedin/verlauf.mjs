/**
 * runner/linkedin/verlauf.mjs — Gesprächsverlauf aus dem Voyager-included-Array.
 *
 * Bisher hat sync.mjs pro Konversation alle Messages bis auf die neueste
 * weggeworfen (`preview`). Der Antwort-Entwürfe-Agent kennt das Gespräch damit
 * nicht — er sieht nur den letzten Satz. Diese Datei zieht aus DEMSELBEN
 * included-Array, das der Sync ohnehin schon geholt hat, die letzten Nachrichten
 * heraus. KEINE zusätzliche Voyager-Abfrage: rein lokale Auswertung.
 *
 * ACHTUNG — `verlaufAusMessages` wird per `.toString()` in den Seitenkontext von
 * linkedin.com injiziert (sync.mjs, buildSyncExpr). Deshalb muss sie
 * selbstgenügsam sein: keine Imports, keine Closure-Variablen, keine
 * Modul-Konstanten im Rumpf. Alles, was sie braucht, kommt über Parameter.
 * Genau deshalb steht sie hier eigenständig und ist per
 * `npx tsx scripts/verify-linkedin-verlauf.ts` gegen Fixtures prüfbar.
 */

/** Wie viele Nachrichten je Thread mitwandern. Kevins Vorgabe: die letzten ~10. */
export const VERLAUF_MAX = 10

/** Deckel je Nachricht — ein Roman im Thread soll die JSONB-Zeile nicht sprengen. */
export const VERLAUF_TEXT_MAX = 2000

/**
 * Die letzten `max` Nachrichten einer Konversation, chronologisch (älteste zuerst),
 * als `{ sender, text, ts }`. Chronologisch, weil der Agent das Gespräch von oben
 * nach unten liest — die Reihenfolge im included-Array ist nicht garantiert.
 *
 * @param {Array<Record<string, any>>} messages  alle Message-Objekte der Seite
 * @param {string} conversationUrn               `entityUrn` der Konversation
 * @param {(urn: string) => boolean} isSelf      erkennt Kevins eigene Teilnehmer-URNs
 * @param {number} [max]                         Standard 10
 * @param {number} [textMax]                     Standard 2000 Zeichen je Nachricht
 */
export function verlaufAusMessages(messages, conversationUrn, isSelf, max, textMax) {
  var grenzeAnzahl = max || 10
  var grenzeText = textMax || 2000
  var eigene = []
  var alle = messages || []
  for (var i = 0; i < alle.length; i++) {
    if (alle[i] && alle[i]['*conversation'] === conversationUrn) eigene.push(alle[i])
  }
  eigene.sort(function (a, b) {
    return (a.deliveredAt || 0) - (b.deliveredAt || 0)
  })

  var out = []
  for (var j = 0; j < eigene.length; j++) {
    var m = eigene[j]
    var roh = m.body && typeof m.body.text === 'string' ? m.body.text : ''
    var text = roh.trim()
    // Anhänge, Reaktionen und Systemzeilen ohne Text tragen zum Gespräch nichts
    // bei — sie würden dem Agenten nur leere Sprecherwechsel vorspielen.
    if (!text) continue
    if (text.length > grenzeText) text = text.slice(0, grenzeText) + ' …'

    // Ohne Absender wird NICHT geraten (gleiche Regel wie bei `last_from`).
    var sender = 'unknown'
    if (m['*sender']) sender = isSelf(m['*sender']) ? 'me' : 'them'

    var ts = null
    if (typeof m.deliveredAt === 'number' && isFinite(m.deliveredAt) && m.deliveredAt > 0) {
      var d = new Date(m.deliveredAt)
      ts = isNaN(d.getTime()) ? null : d.toISOString()
    }

    out.push({ sender: sender, text: text, ts: ts })
  }

  // Die NEUESTEN `max` — abschneiden am Anfang, nicht am Ende.
  return out.slice(-grenzeAnzahl)
}
