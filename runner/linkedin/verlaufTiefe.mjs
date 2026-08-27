/**
 * runner/linkedin/verlaufTiefe.mjs — den echten Gespraechsverlauf nachziehen.
 *
 * **Der Fehler, den das behebt (27.08.2026).** `sync.mjs` liest die
 * Postfach-LISTE, und die liefert je Konversation genau eine Nachricht: die
 * Vorschau. `verlaufAusMessages` filtert danach aus demselben Datensatz - mehr
 * als eine kann dabei nicht herauskommen. Der Befund an den echten Daten:
 * **261 Threads, davon 0 mit mehr als einer Nachricht.**
 *
 * Die Folge reichte bis in Kevins Zahlen: `leads-sync` leitet aus einem Thread
 * ohne Verlauf entweder `erstnachricht` ODER `antwort_erhalten` ab, nie beides.
 * 267 Erstnachrichten stehen 67 Antworten gegenueber, aber nur **9** Leads
 * tragen beide in der richtigen Reihenfolge. Deshalb zeigte das Pipeline-Board
 * an der Kante "Wartet auf Antwort -> Antwort da" 0,0 Prozent, obwohl in
 * dreissig Tagen 21 Leute geantwortet hatten.
 *
 * **Wie es geht.** Voyager hat eine eigene Query je Konversation. Sie am
 * 27.08. im laufenden Chrome mitgeschnitten:
 *
 *   queryId=messengerMessages.<hash>
 *   variables=(conversationUrn:<streng kodierter conversation-URN>)
 *
 * Zwei Dinge, an denen der erste Versuch scheiterte, beide teuer zu raten:
 *
 * 1. **Ohne `syncToken`.** Mit Token antwortet dieselbe Query mit dem Delta
 *    seit dem letzten Abruf - gemessen: 1 Nachricht. Ohne Token kommt der
 *    volle Verlauf - gemessen: 3.
 * 2. **Strenger kodiert als `encodeURIComponent`.** LinkedIn schickt auch
 *    `( ) ' ! *` in Prozentform. Laesst man die Klammern stehen, antwortet die
 *    Query mit HTTP 400. Genau daran hingen die ersten Versuche.
 *
 * Die queryId traegt einen Release-Hash und wechselt - deshalb wird sie wie in
 * `sync.mjs` aus den Requests der Seite gelesen und nur als Rueckfall
 * hartkodiert.
 */

/** Fallback, falls die Seite gerade keine eigene Anfrage gefeuert hat (Stand 27.08.2026). */
export const MESSAGES_QID_FALLBACK = 'messengerMessages.5846eeb71c981f11e0134cb6626cc314'

/**
 * LinkedIns Kodierung fuer Voyager-Variablen.
 *
 * `encodeURIComponent` laesst `! ' ( ) *` stehen, LinkedIn nicht. In einer
 * Variablenliste sind Klammern Syntax - eine unkodierte Klammer im Wert
 * beendet die Liste zu frueh, und die Query faellt auf 400.
 */
export function strengKodiert(text) {
  return encodeURIComponent(String(text ?? '')).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

/**
 * Aus dem `thread_key` der Datenbank den Teil ziehen, den der conversation-URN
 * braucht. Gespeichert ist `urn:li:messagingThread:2-NWU4...`, gebraucht wird
 * nur `2-NWU4...`.
 */
export function threadIdAus(threadKey) {
  return String(threadKey ?? '').split('messagingThread:').pop()
}

/** Der conversation-URN, wie Voyager ihn erwartet. */
export function conversationUrn(mailboxUrn, threadKey) {
  return `urn:li:msg_conversation:(${mailboxUrn},${threadIdAus(threadKey)})`
}

/**
 * Welche Threads brauchen einen Tiefenlauf?
 *
 * Nur die, deren Verlauf hoechstens eine Nachricht traegt. Ein Thread, bei dem
 * wirklich erst eine Nachricht existiert (frische Erstnachricht ohne Antwort),
 * wird dabei jedes Mal erneut abgefragt - das ist gewollt: genau dort kommt die
 * Antwort ja noch. Der Deckel begrenzt den Lauf, nicht die Auswahl.
 */
export function brauchtTiefe(thread) {
  const v = thread?.verlauf
  return !Array.isArray(v) || v.length <= 1
}
