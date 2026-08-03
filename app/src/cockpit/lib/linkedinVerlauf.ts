import type { LinkedinNachricht, LinkedinThread } from '../../types/db'

/**
 * Zugriff auf den gespiegelten Gesprächsverlauf (Migration 0064).
 *
 * Die Spalte kann aus zwei Gründen fehlen: die Migration ist auf dieser DB noch
 * nicht gelaufen, oder der Sync hat für diesen Thread keine Nachricht
 * mitbekommen. Beides ist kein Fehler — es heißt nur: nur `preview` verfügbar.
 * Deshalb liest niemand `thread.verlauf` direkt.
 */

/** Normalisierter Verlauf, immer ein Array — kaputte/fremde Einträge fliegen raus. */
export function verlaufVon(thread: Pick<LinkedinThread, 'verlauf'>): LinkedinNachricht[] {
  // Bewusst über `unknown`: was aus JSONB kommt, ist zur Laufzeit beliebig —
  // der deklarierte Typ ist eine Erwartung, keine Garantie.
  const roh = thread.verlauf as unknown
  if (!Array.isArray(roh)) return []
  const out: LinkedinNachricht[] = []
  for (const e of roh as unknown[]) {
    if (!e || typeof e !== 'object') continue
    const rec = e as Record<string, unknown>
    const text = typeof rec.text === 'string' ? rec.text.trim() : ''
    if (!text) continue
    const sender = rec.sender === 'me' || rec.sender === 'them' ? rec.sender : 'unknown'
    out.push({ sender, text, ts: typeof rec.ts === 'string' ? rec.ts : null })
  }
  return out
}

/**
 * Gesprächsverlauf als lesbarer Block für den Entwürfe-Agenten: „Kevin: …" /
 * „<Name>: …", älteste Zeile zuerst. Ohne Verlauf greift `preview` als
 * einzige bekannte Nachricht — der Agent bekommt nie ein leeres Feld.
 */
export function verlaufAlsText(
  thread: Pick<LinkedinThread, 'verlauf' | 'preview' | 'name' | 'last_from'>,
): string {
  const eintraege = verlaufVon(thread)
  const gegenueber = thread.name.trim() || 'Lead'
  if (eintraege.length === 0) {
    const preview = thread.preview.trim()
    if (!preview) return ''
    const wer = thread.last_from === 'me' ? 'Kevin' : thread.last_from === 'them' ? gegenueber : '?'
    return `${wer}: ${preview}`
  }
  return eintraege
    .map((e) => `${e.sender === 'me' ? 'Kevin' : e.sender === 'them' ? gegenueber : '?'}: ${e.text}`)
    .join('\n')
}
