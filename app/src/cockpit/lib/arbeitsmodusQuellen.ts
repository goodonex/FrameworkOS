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
import { echtOffeneErstnachrichten, profilNachName } from './erstnachrichtenOffen'
import { icpUrteil, istArbeitsVorrat } from './icp'
import { istKunde, kundenSchluessel, type KundenKontakt } from './kundenAbgleich'
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
 * Der Beginn der Makler-Akquise (18.08.2026).
 *
 * Kevin arbeitet erst seit Januar 2026 auf diese Zielgruppe. Was davor im
 * Postfach liegt, ist kein liegen gebliebener Lead, sondern Post von Leuten,
 * die IHN akquiriert haben — Closer-Anfragen, Recruiter, Agenturen aus einem
 * anderen Leben. Vier solche Threads aus April/Mai 2025 standen als „älteste
 * 492 Tage" ganz oben in der Antworten-Spur und schoben die echten Leads nach
 * unten.
 *
 * Das Datum gilt NUR für die Antworten-Spur. Für Threads, die Kevin selbst
 * angeschrieben hat, bleibt seine Regel „nichts, was liegen geblieben ist,
 * fällt weg" (linkedinFollowups.ts) unangetastet.
 */
export const AKQUISE_START = '2026-01-01'

/** Eingegangen, bevor Kevin auf Makler umgestellt hat — nicht seine Akquise. */
function vorDerAkquise(t: LinkedinThread): boolean {
  return t.last_message_at != null && t.last_message_at < AKQUISE_START
}

/**
 * Wartet dieser Thread wirklich auf eine Antwort von Kevin?
 *
 * `bucketOf === 'du_bist_dran'` allein reicht nicht — drei Sorten stehen dort
 * zu Unrecht (alle drei am 18.08.2026 an echten Daten belegt, 29 Einträge):
 *
 * - **Off-ICP** (nicht seine Zielgruppe) → `icp.ts`, siehe unten.
 * - **Loom zugesagt** (Stern + `loom_status: 'offen'`): Diese Leute warten
 *   nicht auf Text, sondern auf ein Video — sie stehen in der Loom-Spur.
 *   Bis hierher standen sie in BEIDEN Listen, 13 von 29. Kevins Satz dazu:
 *   „Die den muss ich ja nicht antworten, also müssen die da raus."
 *   Bewusst an `loom_status: 'offen'` geknüpft und nicht am Stern allein:
 *   Schreibt jemand NACH dem verschickten Loom nochmal, wartet er wieder auf
 *   eine Antwort und gehört zurück in diese Spur.
 * - **Vor der Akquise** eingegangen → `AKQUISE_START`.
 */
function wartetAufAntwort(t: LinkedinThread, heute: Date): boolean {
  if (bucketOf(t, heute) !== 'du_bist_dran') return false
  if (t.starred && t.loom_status === 'offen') return false
  if (vorDerAkquise(t)) return false
  return true
}

/**
 * Rang 3 — Lead hat geantwortet, wartet auf Kevin.
 * `text` bleibt die Nachricht des Leads (der Kontext), der Entwurf hängt daneben.
 *
 * **Ohne Off-ICP** (18.08.2026). Kevin fand in dieser Liste 52 Namen, von denen
 * über die Hälfte ihn akquirieren wollte — Coaches, Recruiter, KI-Verkäufer.
 * Seine Frage: „Wir haben doch extra einen ICP-Filter, den können wir doch auch
 * über die offenen Nachrichten laufen lassen." Konnten wir nicht: Der Filter
 * stand nur im Skill-Text, nicht im Code. Jetzt schon (`icp.ts`), und zwar
 * für die Anzeige und den Entwurfs-Agenten aus derselben Regel-Datei.
 *
 * `unklar` bleibt drin — die Headline ist Freitext, und ein übersehener Makler
 * ist teurer als ein Name zu viel in der Liste.
 */
export function antwortPosten(
  threads: LinkedinThread[],
  heute: Date,
  kontakte: KundenKontakt[] = [],
): Posten[] {
  const kunden = kundenSchluessel(kontakte)
  return threads
    .filter((t) => wartetAufAntwort(t, heute))
    .filter((t) => !istKunde(t.name, kunden))
    .filter((t) => istArbeitsVorrat(icpUrteil(t.company, t.name).urteil))
    .map((t) => ({
      ...threadZuPosten(t, 'antwort', 'thread', t.preview || `Antwort an ${t.name || 'den Lead'} vorbereiten.`),
      entwurf: entwurfVon(t),
    }))
}

/**
 * Die Gegenmenge: wer geantwortet hat, aber nicht in die Antworten-Spur gehört
 * — weil er nicht Kevins Zielgruppe ist oder aus der Zeit vor der Akquise
 * stammt.
 *
 * Bewusst abrufbar statt weggeworfen — die Zeile im Sales-Flow nennt die Zahl
 * („27 ausgeblendet") und macht sie auf Klick sichtbar. Ein Filter, den man
 * nicht prüfen kann, ist ein Filter, dem man nicht traut.
 *
 * Zugesagte Looms fehlen hier bewusst: die sind nicht ausgeblendet, sondern
 * eine Zeile weiter unten im Tages-Flow zu sehen.
 */
export function antwortPostenAusgeblendet(threads: LinkedinThread[], heute: Date): Posten[] {
  return threads
    .filter((t) => bucketOf(t, heute) === 'du_bist_dran')
    .filter((t) => !(t.starred && t.loom_status === 'offen'))
    .filter((t) => vorDerAkquise(t) || !istArbeitsVorrat(icpUrteil(t.company, t.name).urteil))
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
export function followupPosten(
  threads: LinkedinThread[],
  heute: Date,
  kontakte: KundenKontakt[] = [],
): Posten[] {
  const kunden = kundenSchluessel(kontakte)
  return threads
    .filter((t) => bucketOf(t, heute) === 'faellig')
    // Ein laufender Kunde bekommt kein Akquise-Follow-up (18.08.2026).
    .filter((t) => !istKunde(t.name, kunden))
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
export function erstnachrichtPosten(
  leads: Erstnachricht[],
  threads: LinkedinThread[] = [],
  netzwerk: { name: string; profile_url: string }[] = [],
): Posten[] {
  const profile = profilNachName(netzwerk)
  return echtOffeneErstnachrichten(leads, threads)
    // Reihenfolge aus der Quelldatei = Kevins Abarbeitungsreihenfolge (sort_index).
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((l): Posten => ({
      id: `erstnachricht:${l.id}`,
      spur: 'erstnachricht',
      name: l.name,
      firma: l.firma || undefined,
      website: l.website || undefined,
      profil: profile(l.name),
      text: l.nachricht,
      timestamp: null,
    }))
}

/** Strippt das Quell-Präfix (`thread:`, `loom:`, `erstnachricht:`) von einer Posten-ID. */
export function zeilenId(postenId: string): string {
  const idx = postenId.indexOf(':')
  return idx === -1 ? postenId : postenId.slice(idx + 1)
}
