import type { Erstnachricht } from '../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../types/db'
import { angenommenOhneErstnachricht, type NetzwerkEintrag } from './funnelStufen'
import { icpUrteil, istArbeitsVorrat } from './icp'

/**
 * Die Wochenkontrolle (19.08.2026) — die Gegenprobe zu allen Filtern.
 *
 * Kevins Bauchschmerz, wörtlich: „Wir entwickeln viele Regeln, die die falschen
 * Leute aus der Liste raushalten. Aber ich bin mir nicht zu hundert Prozent
 * sicher, ob die Leute, die in die Liste rein müssen, auch wirklich
 * reingekommen sind."
 *
 * Jede andere Ansicht in Uriel zeigt, WER DRIN ist. Diese hier zeigt, wer
 * **nicht** angeschrieben wurde und warum — sortiert nach dem einzigen Grund,
 * der ein Fehler sein kann: aussortiert. Kevin überfliegt diese Liste am
 * Freitag; steht dort ein Makler, hat der Filter danebengegriffen.
 *
 * **Keine zweite Wahrheit.** „Wurde die Person angeschrieben?" beantwortet
 * weiterhin `angenommenOhneErstnachricht` (Namens- und URL-Abgleich inklusive
 * Mehrdeutigkeits-Markierung), „ist sie Zielgruppe?" weiterhin `icp.ts`. Hier
 * wird nur auf ein Zeitfenster geschnitten und einsortiert.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-wochenkontrolle.ts`.
 */

export type WochenLage = 'angeschrieben' | 'offen' | 'aussortiert'

export interface WochenEintrag {
  /** `profil_key` — stabil über Namensänderungen hinweg. */
  key: string
  name: string
  /** Die LinkedIn-Headline, an der der Filter entschieden hat. */
  headline: string
  profileUrl: string
  angenommenAt: string | null
  lage: WochenLage
  /**
   * Bei `aussortiert`: das Wort aus `icpRegeln.json`, das die Entscheidung
   * ausgelöst hat. Genau dieses Wort ist der Hebel, wenn Kevin widerspricht.
   */
  grund: string | null
  /** Zuordnung war mehrdeutig (gleicher Name mehrfach, keine Profil-URL). */
  pruefen: boolean
}

export interface Wochenkontrolle {
  /** Erster Tag des Fensters, ISO-Datum. */
  von: string
  /** Letzter Tag des Fensters (heute), ISO-Datum. */
  bis: string
  /** Alle in diesem Fenster angenommenen Kontakte, jüngste zuerst. */
  alle: WochenEintrag[]
  angeschrieben: WochenEintrag[]
  /** Angenommen, Zielgruppe, aber noch ohne Erstnachricht — Kevins Rückstand. */
  offen: WochenEintrag[]
  /** Vom ICP-Filter aussortiert — die einzige Liste, die ein Fehler sein kann. */
  aussortiert: WochenEintrag[]
}

const TAG_MS = 86_400_000

function isoTag(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * @param tage Wie weit zurück gezählt wird. 7 = die letzten sieben Tage
 *   einschliesslich heute; bewusst ein rollendes Fenster und keine
 *   Kalenderwoche, damit die Ansicht am Mittwoch nicht fast leer ist.
 */
export function wochenkontrolle(
  netzwerk: NetzwerkEintrag[],
  threads: LinkedinThread[],
  erstnachrichten: Erstnachricht[],
  jetzt: Date = new Date(),
  tage = 7,
): Wochenkontrolle {
  const bis = isoTag(jetzt)
  const von = isoTag(new Date(jetzt.getTime() - (Math.max(1, tage) - 1) * TAG_MS))

  // Wer laut der EINEN Zuordnungslogik noch keine Erstnachricht hat.
  const nochOffen = new Map(
    angenommenOhneErstnachricht(netzwerk, threads, erstnachrichten, jetzt).map((p) => [
      p.key,
      Boolean(p.pruefen),
    ]),
  )

  const alle: WochenEintrag[] = []
  for (const e of netzwerk) {
    if (e.status !== 'angenommen') continue
    // Ohne Datum ist der Eintrag nicht datierbar und gehört in kein Fenster —
    // er taucht in der Gesamtliste der Funnel-Stufen weiterhin auf.
    if (!e.angenommen_at) continue
    const tag = e.angenommen_at.slice(0, 10)
    if (tag < von || tag > bis) continue

    const offen = nochOffen.has(e.profil_key)
    const urteil = icpUrteil(e.headline, e.name)
    // Reihenfolge mit Absicht: Wer angeschrieben wurde, ist erledigt — auch
    // wenn der Filter ihn heute aussortieren würde. Die Frage lautet „wer
    // wurde NICHT angeschrieben und warum", nicht „wen würde der Filter
    // heute nehmen".
    const lage: WochenLage = !offen
      ? 'angeschrieben'
      : istArbeitsVorrat(urteil.urteil)
        ? 'offen'
        : 'aussortiert'

    alle.push({
      key: e.profil_key,
      name: e.name,
      headline: e.headline ?? '',
      profileUrl: e.profile_url || `https://www.linkedin.com/in/${e.profil_key}/`,
      angenommenAt: e.angenommen_at,
      lage,
      grund: lage === 'aussortiert' ? urteil.grund : null,
      pruefen: nochOffen.get(e.profil_key) ?? false,
    })
  }

  alle.sort((a, b) => String(b.angenommenAt ?? '').localeCompare(String(a.angenommenAt ?? '')))

  return {
    von,
    bis,
    alle,
    angeschrieben: alle.filter((e) => e.lage === 'angeschrieben'),
    offen: alle.filter((e) => e.lage === 'offen'),
    aussortiert: alle.filter((e) => e.lage === 'aussortiert'),
  }
}
