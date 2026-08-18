/**
 * Übersetzt bestehende Domänen-Listen (LinkedIn-Threads, Erstnachrichten) in
 * Posten für die Prioritätenliste (Wargame docs/wargames/sales-arbeitsmodus.md,
 * Zug 1/3/5). Reine Funktionen — verwendet ausschließlich die bereits
 * bestehende Bucket-Logik aus `linkedinFollowups.ts`, modelliert nichts neu.
 *
 * ID-Konvention: `<quelle>:<id-der-zugrunde-liegenden-zeile>` — Zug 4 liest
 * daraus beim Abhaken zurück, welche Zeile geschrieben werden muss.
 */
import type { Erstnachricht } from '../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../types/db'
import { echtOffeneErstnachrichten } from './erstnachrichtenOffen'
import { bucketOf } from './linkedinFollowups'
import type { Posten, PostenEntwurf } from './prioritaet'

/**
 * Entwurf des Nacht-Agenten am Thread (Migration 0065), sofern einer anliegt.
 *
 * `veraltet` ist die eine Sicherung, die es hier braucht: hat der Lead nach dem
 * Entwurf erneut geschrieben, antwortet der Text auf eine überholte Nachricht.
 * Der Entwurf wird dann angezeigt, aber markiert — verworfen wird er nicht,
 * denn oft trägt er trotzdem.
 */
function entwurfVon(t: LinkedinThread): PostenEntwurf | undefined {
  const text = typeof t.entwurf === 'string' ? t.entwurf.trim() : ''
  if (!text) return undefined
  const erstelltAm = t.entwurf_at ?? null
  const veraltet =
    erstelltAm != null &&
    t.last_message_at != null &&
    new Date(t.last_message_at).getTime() > new Date(erstelltAm).getTime()
  return { text, veraltet, erstelltAm }
}

function threadZuPosten(t: LinkedinThread, spur: Posten['spur'], praefix: string, text: string): Posten {
  return {
    id: `${praefix}:${t.id}`,
    spur,
    name: t.name || 'Unbekannt',
    firma: t.company || undefined,
    // Bei Threads ist der nützliche Link das LinkedIn-Profil — dort findet
    // die eigentliche Arbeit (antworten, Loom verschicken) statt.
    website: t.profile_url || undefined,
    text,
    timestamp: t.last_message_at,
    starred: t.starred,
  }
}

/**
 * Rang 3 — Lead hat geantwortet, wartet auf Kevin (bucketOf === 'du_bist_dran').
 * `text` bleibt die Nachricht des Leads (der Kontext), der Entwurf hängt daneben.
 */
export function antwortPosten(threads: LinkedinThread[], heute: Date): Posten[] {
  return threads
    .filter((t) => bucketOf(t, heute) === 'du_bist_dran')
    .map((t) => ({
      ...threadZuPosten(t, 'antwort', 'thread', t.preview || `Antwort an ${t.name || 'den Lead'} vorbereiten.`),
      entwurf: entwurfVon(t),
    }))
}

/** Rang 4 — Lead hat Ja zum Loom gesagt, Skript/Aufnahme steht noch aus. */
export function loomPosten(threads: LinkedinThread[]): Posten[] {
  return threads
    .filter((t) => t.starred && t.loom_status === 'offen')
    .map((t) =>
      threadZuPosten(t, 'loom', 'loom', `Loom-Analyse für ${t.name || 'den Lead'} aufnehmen und verschicken.`),
    )
}

/** Rang 6 — fällige Follow-ups (bucketOf === 'faellig'). */
export function followupPosten(threads: LinkedinThread[], heute: Date): Posten[] {
  return threads
    .filter((t) => bucketOf(t, heute) === 'faellig')
    .map((t) => ({
      ...threadZuPosten(t, 'followup', 'thread', t.preview || `Follow-up an ${t.name || 'den Lead'}.`),
      entwurf: entwurfVon(t),
    }))
}

/**
 * Rang 5 — versandfertige Erstnachrichten (Migration 0060).
 *
 * Der Haken im Cockpit ist NICHT die einzige Wahrheit: Wer die Nachricht vom
 * Handy verschickt hat, hat einen Thread im Postfach — der zählt genauso
 * (17.08.2026, siehe `erstnachrichtenOffen`). Ohne `threads` verhält sich die
 * Funktion wie vorher.
 */
export function erstnachrichtPosten(leads: Erstnachricht[], threads: LinkedinThread[] = []): Posten[] {
  return echtOffeneErstnachrichten(leads, threads)
    // Reihenfolge aus der Quelldatei = Kevins Abarbeitungsreihenfolge (sort_index).
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((l): Posten => ({
      id: `erstnachricht:${l.id}`,
      spur: 'erstnachricht',
      name: l.name,
      firma: l.firma || undefined,
      website: l.website || undefined,
      text: l.nachricht,
      timestamp: null,
    }))
}

/** Strippt das Quell-Präfix (`thread:`, `loom:`, `erstnachricht:`) von einer Posten-ID. */
export function zeilenId(postenId: string): string {
  const idx = postenId.indexOf(':')
  return idx === -1 ? postenId : postenId.slice(idx + 1)
}
