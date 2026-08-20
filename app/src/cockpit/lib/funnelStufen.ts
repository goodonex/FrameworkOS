import type { Erstnachricht } from '../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../types/db'
import { bucketOf } from './linkedinFollowups'

/**
 * Die Stufen von Kevins LinkedIn-Trichter — als Namenslisten (12.08.2026).
 *
 * Der Tages-Flow (11.08.) zählt, WIE VIEL heute zu tun ist. Diese Datei sagt,
 * WER dahintersteckt: wen ich angeschrieben habe und der nicht antwortet, wem
 * ich ein Loom versprochen habe, wer angenommen hat und noch nie eine Nachricht
 * bekam, und wer die Einladung nie angenommen hat (die InMail-Welle).
 *
 * **Reine Funktionen, keine React-Importe** — prüfbar per
 * `npx tsx scripts/verify-funnel-stufen.ts`.
 *
 * **Es entsteht keine zweite Fälligkeits-Logik.** Wer „wartet" und wer „fällig"
 * ist, sagt weiterhin `linkedinFollowups.bucketOf` — hier wird nur gruppiert
 * und sortiert.
 */

/** Eine Zeile aus `linkedin_netzwerk` (Migration 0070). */
export interface NetzwerkEintrag {
  id: string
  profil_key: string
  name: string
  headline: string
  profile_url: string
  status: 'offen' | 'angenommen'
  eingeladen_at: string | null
  angenommen_at: string | null
  zuletzt_gesehen_at: string
  /** 0076: Verweis auf den Lead. */
  lead_id?: string | null
}

/** Eine Person in einer Funnel-Liste — das, was die Oberfläche zeigt. */
export interface FunnelPerson {
  /** Stabiler Schlüssel für React und zum Entdoppeln. */
  key: string
  name: string
  /** Headline oder Firma — was da ist. */
  info: string
  profileUrl: string
  /** Seit wann wartet die Person? ISO oder null. */
  seit: string | null
  /** Wie viele Tage das her ist — null, wenn kein Datum bekannt ist. */
  tage: number | null
  /**
   * Zuordnung unsicher: der Name kam mehrfach vor, und ohne Profil-URL ist
   * nicht zu entscheiden, wer gemeint war. Solche Einträge werden angezeigt,
   * aber markiert — still falsch zuzuordnen wäre schlimmer.
   */
  pruefen?: boolean
}

const TAG_MS = 86_400_000

function tageSeit(iso: string | null, jetzt: Date): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((jetzt.getTime() - t) / TAG_MS))
}

/**
 * Der Profil-Schlüssel aus einer LinkedIn-URL.
 *
 * Spiegelt `runner/linkedin/netzwerkParse.ts` — das Prüfskript vergleicht beide
 * gegeneinander, damit sie nicht auseinanderlaufen. (Der Runner liegt ausserhalb
 * von `app/src` und lässt sich von hier nicht importieren.)
 */
export function profilKeyAus(url: string | null | undefined): string | null {
  const m = String(url ?? '').match(/\/in\/([^/?#]+)/i)
  if (!m) return null
  const key = decodeURIComponent(m[1]).trim().toLowerCase()
  return key === '' ? null : key
}

/** Namen vergleichbar machen — dieselbe Regel wie `upsert.mjs`. */
export function normName(n: string | null | undefined): string {
  return String(n ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function personAus(e: NetzwerkEintrag, seit: string | null, jetzt: Date, pruefen = false): FunnelPerson {
  return {
    key: e.profil_key,
    name: e.name,
    info: e.headline,
    profileUrl: e.profile_url || `https://www.linkedin.com/in/${e.profil_key}/`,
    seit,
    tage: tageSeit(seit, jetzt),
    ...(pruefen ? { pruefen: true } : {}),
  }
}

function personAusThread(t: LinkedinThread, jetzt: Date): FunnelPerson {
  return {
    key: t.id,
    name: t.name,
    info: t.company,
    profileUrl: t.profile_url,
    seit: t.last_message_at,
    tage: tageSeit(t.last_message_at, jetzt),
  }
}

/**
 * **Stufe 1 — angenommen, aber noch nie angeschrieben.**
 *
 * Der eigentliche Arbeitsvorrat: diese Leute haben Ja gesagt und warten auf den
 * ersten Satz. Ausgeschlossen wird, wer schon einen Thread hat (dann läuft das
 * Gespräch) und wer eine als `gesendet` verbuchte Erstnachricht trägt.
 *
 * Threads werden über den Profil-Schlüssel abgeglichen, Erstnachrichten über
 * den Namen — sie haben keine URL (Migration 0060). Ist ein Name doppelt
 * vergeben, wird der Eintrag NICHT still ausgeschlossen, sondern als `pruefen`
 * markiert: lieber einmal zu viel hinsehen als jemanden verlieren.
 */
export function angenommenOhneErstnachricht(
  netzwerk: NetzwerkEintrag[],
  threads: LinkedinThread[],
  erstnachrichten: Erstnachricht[],
  jetzt: Date = new Date(),
): FunnelPerson[] {
  const threadKeys = new Set<string>()
  const threadNamen = new Map<string, number>()
  for (const t of threads) {
    const k = profilKeyAus(t.profile_url)
    if (k) threadKeys.add(k)
    const n = normName(t.name)
    if (n) threadNamen.set(n, (threadNamen.get(n) ?? 0) + 1)
  }

  const gesendeteNamen = new Map<string, number>()
  for (const e of erstnachrichten) {
    if (e.status !== 'gesendet') continue
    const n = normName(e.name)
    if (n) gesendeteNamen.set(n, (gesendeteNamen.get(n) ?? 0) + 1)
  }

  const raus: FunnelPerson[] = []
  for (const e of netzwerk) {
    if (e.status !== 'angenommen') continue
    // Ein Thread über die URL ist ein sicherer Ausschluss: hier wurde geredet.
    if (threadKeys.has(e.profil_key)) continue

    const n = normName(e.name)
    const perName = (threadNamen.get(n) ?? 0) + (gesendeteNamen.get(n) ?? 0)
    // Genau ein Namenstreffer ohne URL-Beleg: wahrscheinlich dieselbe Person,
    // aber nicht beweisbar → raus aus der Liste, denn „schon geschrieben" ist
    // die vorsichtigere Annahme. Mehrere Treffer: mehrdeutig → mit Markierung
    // anzeigen, statt jemanden auf Verdacht zu verlieren.
    if (perName === 1) continue

    raus.push(personAus(e, e.angenommen_at, jetzt, perName > 1))
  }

  // Die jüngste Annahme zuerst — dort ist die Erinnerung an das Profil frisch.
  return raus.sort((a, b) => String(b.seit ?? '').localeCompare(String(a.seit ?? '')))
}

/**
 * **Stufe 2 und 3 — angeschrieben, keine Antwort.**
 *
 * Getrennt nach „noch nie nachgefasst" (`followup_stage === 0`) und „schon
 * nachgefasst". Die Trennung ist Kevins: der erste Topf ist der größte Hebel
 * (Baseline 27.07.: 77 Leute, „größter Hebel, kostet nichts"), der zweite
 * braucht eine andere Nachricht.
 *
 * Wer geantwortet hat, steht in keinem der beiden Töpfe — dafür sorgt
 * `bucketOf`: `du_bist_dran` bedeutet, dass Kevin am Zug ist, nicht der Lead.
 */
export function ohneAntwort(
  threads: LinkedinThread[],
  jetzt: Date = new Date(),
): { erstkontakt: FunnelPerson[]; nachgefasst: FunnelPerson[] } {
  const erstkontakt: FunnelPerson[] = []
  const nachgefasst: FunnelPerson[] = []

  for (const t of threads) {
    const bucket = bucketOf(t, jetzt)
    // Nur wo Kevin geschrieben hat und nichts zurückkam. Altlasten sind seit
    // dem 14.08.2026 kein eigener Eimer mehr, sondern stecken in `faellig` —
    // sie waren hier immer schon mitgemeint.
    if (bucket !== 'wartet' && bucket !== 'faellig') continue
    if (t.last_from !== 'me') continue
    ;(t.followup_stage === 0 ? erstkontakt : nachgefasst).push(personAusThread(t, jetzt))
  }

  // Älteste zuerst — wer am längsten wartet, ist am dringendsten.
  const nachAlter = (a: FunnelPerson, b: FunnelPerson) => (b.tage ?? -1) - (a.tage ?? -1)
  return { erstkontakt: erstkontakt.sort(nachAlter), nachgefasst: nachgefasst.sort(nachAlter) }
}

/**
 * **Stufe 4 — Loom zugesagt, noch nicht verschickt.**
 *
 * Deckungsgleich mit `arbeitsmodusQuellen.loomPosten` (Stern = Ja zur Analyse,
 * `loom_status === 'offen'`). Hier als Personenliste, damit die Namen im
 * Funnel-Fenster stehen können — die Bedingung wird nicht neu erfunden.
 */
export function wartetAufLoom(threads: LinkedinThread[], jetzt: Date = new Date()): FunnelPerson[] {
  return threads
    .filter((t) => t.starred && t.loom_status === 'offen')
    .map((t) => personAusThread(t, jetzt))
    .sort((a, b) => (b.tage ?? -1) - (a.tage ?? -1))
}

/**
 * **Stufe 5 — die Einladung wurde nie angenommen (InMail-Kandidaten).**
 *
 * `letzterVollerLauf` ist die Schutzklausel (D4): Nur Einträge, die im letzten
 * VOLLSTÄNDIG gelesenen Einladungs-Lauf noch zu sehen waren, gelten als offen.
 * Ohne sie hätte ein abgebrochener Sync — der bei 882 Einladungen mit vier
 * Minuten Laufzeit realistisch ist — Hunderte Leute fälschlich als „wartet
 * noch" geführt, die längst angenommen haben.
 *
 * Fehlt der Zeitstempel (noch nie ein voller Lauf), kommt bewusst eine leere
 * Liste zurück. Die Oberfläche zeigt dann „Sync ausstehend" statt einer Zahl,
 * der niemand trauen kann.
 */
export function inmailKandidaten(
  netzwerk: NetzwerkEintrag[],
  letzterVollerLauf: string | null,
  jetzt: Date = new Date(),
): FunnelPerson[] {
  if (!letzterVollerLauf) return []
  const grenze = new Date(letzterVollerLauf).getTime()
  if (Number.isNaN(grenze)) return []

  return netzwerk
    .filter((e) => e.status === 'offen')
    .filter((e) => {
      const gesehen = new Date(e.zuletzt_gesehen_at).getTime()
      return !Number.isNaN(gesehen) && gesehen >= grenze
    })
    .map((e) => personAus(e, e.eingeladen_at, jetzt))
    // Älteste Einladung zuerst: wer am längsten wartet, ist am ehesten reif
    // für den zweiten Anlauf.
    .sort((a, b) => (b.tage ?? -1) - (a.tage ?? -1))
}

export interface FunnelStufen {
  angenommenOffen: FunnelPerson[]
  ohneAntwortErst: FunnelPerson[]
  ohneAntwortNachgefasst: FunnelPerson[]
  loomOffen: FunnelPerson[]
  inmail: FunnelPerson[]
}

/** Alle fünf Listen auf einmal — der eine Aufruf für die Oberfläche. */
export function funnelStufen(
  {
    netzwerk,
    threads,
    erstnachrichten,
    letzterVollerEinladungsLauf,
  }: {
    netzwerk: NetzwerkEintrag[]
    threads: LinkedinThread[]
    erstnachrichten: Erstnachricht[]
    letzterVollerEinladungsLauf: string | null
  },
  jetzt: Date = new Date(),
): FunnelStufen {
  const antwort = ohneAntwort(threads, jetzt)
  return {
    angenommenOffen: angenommenOhneErstnachricht(netzwerk, threads, erstnachrichten, jetzt),
    ohneAntwortErst: antwort.erstkontakt,
    ohneAntwortNachgefasst: antwort.nachgefasst,
    loomOffen: wartetAufLoom(threads, jetzt),
    inmail: inmailKandidaten(netzwerk, letzterVollerEinladungsLauf, jetzt),
  }
}
