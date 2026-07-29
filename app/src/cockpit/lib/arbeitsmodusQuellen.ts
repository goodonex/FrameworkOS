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
import { bucketOf } from './linkedinFollowups'
import type { Posten } from './prioritaet'

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

/** Rang 3 — Lead hat geantwortet, wartet auf Kevin (bucketOf === 'du_bist_dran'). */
export function antwortPosten(threads: LinkedinThread[], heute: Date): Posten[] {
  return threads
    .filter((t) => bucketOf(t, heute) === 'du_bist_dran')
    .map((t) => threadZuPosten(t, 'antwort', 'thread', t.preview || `Antwort an ${t.name || 'den Lead'} vorbereiten.`))
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
    .map((t) => threadZuPosten(t, 'followup', 'thread', t.preview || `Follow-up an ${t.name || 'den Lead'}.`))
}

/** Rang 5 — versandfertige Erstnachrichten (Migration 0060). */
export function erstnachrichtPosten(leads: Erstnachricht[]): Posten[] {
  return leads
    .filter((l) => l.status === 'offen')
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
