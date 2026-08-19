import { isoTag, istWochenende, tagDavor } from './identityStreak'
import type { MetricField } from './metrikFelder'
import { PORTION_STUFEN, type Stufe } from './tagesFlow'

/**
 * Serien („Streaks") für die Sales-Flow-Zeilen (18.08.2026).
 *
 * Blatt-Modul ohne React-/Supabase-Import — dasselbe Muster wie
 * `identityStreak.ts`, dessen Datums-Helfer hier wiederverwendet werden.
 * Prüfbar per `npx tsx scripts/verify-sales-streak.ts`.
 *
 * Drei Fachregeln:
 *
 * 1. **Akquise kennt Werktage.** Ein Samstag ohne Anfragen ist kein
 *    Rückschlag, sondern Samstag — Wochenenden zählen nicht mit und brechen
 *    nicht (wie `vertriebsblock` in der Identitäts-Serie).
 *
 * 2. **Der laufende Tag bricht nichts.** Morgens um sieben ist noch nichts
 *    abgearbeitet — zählte die Serie nur bis „heute geschafft", stünde jeden
 *    Morgen eine 0 da. Die Serie darf heute ODER am letzten Werktag davor
 *    enden; erst wenn beide fehlen, ist sie gerissen.
 *
 * 3. **Ein Freeze pro Woche.** Ein einzelner verpasster Werktag je
 *    Kalenderwoche friert die Serie ein, statt sie zu reissen (der
 *    Duolingo-Griff): der Tag zählt nicht mit, aber die Serie läuft weiter.
 *    Ohne das bestraft die Zahl einen Freitag beim Kunden — und eine Streak,
 *    die unfair reisst, wird ignoriert statt gejagt.
 *
 * **Woher die Urteile kommen:** Für Stufen mit festem Ziel (Anfragen,
 * InMails) reicht die `daily_metrics`-Historie. Für Aus-den-Daten-Stufen
 * braucht es das EINGEFRORENE Soll des Tages (`sales_tagesportionen`) — was
 * an einem Dienstag vor drei Wochen fällig war, weiss keine Live-Liste mehr.
 * Ein Tag ohne Portion ist darum KEIN Urteil (null): vor Einführung der
 * Tabelle beginnt die Serie dieser Stufen einfach bei ihrer Einführung.
 * Die Frische-Stufe (Antworten) hat keine rekonstruierbare Historie und
 * damit keine Serie.
 */

/** Eine daily_metrics-Zeile, soweit die Serie sie braucht. */
export type MetrikTag = { datum: string } & Partial<Record<MetricField, number>>

/** Eine sales_tagesportionen-Zeile, strukturell (kein Hook-Import). */
export interface PortionsTag {
  datum: string
  stufe: string
  soll: number
  /**
   * 0075: Der Tag, an dem die Stufe stand — auch ohne erreichten Zähler.
   * `null`/fehlend heisst nur „kein Vermerk", nicht „nicht geschafft".
   */
  erledigtAt?: string | null
}

export interface SalesStreak {
  /** Länge der laufenden Serie in gezählten Werktagen. */
  laenge: number
  /** true, wenn heute noch offen ist, die Serie aber über den Vortag läuft. */
  heuteOffen: boolean
}

const TAG_MS = 86_400_000

/**
 * ISO-8601-Wochen-Schlüssel (z. B. „2026-W34") — die Einheit, in der Freezes
 * budgetiert sind. Über den Donnerstag gerechnet, damit Jahreswechsel-Wochen
 * dem richtigen Jahr zufallen.
 */
export function isoWoche(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  const tag = (d.getUTCDay() + 6) % 7 // Mo = 0
  d.setUTCDate(d.getUTCDate() - tag + 3) // Donnerstag dieser Woche
  const jahr = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(jahr, 0, 4, 12))
  const jan4Tag = (jan4.getUTCDay() + 6) % 7
  const wochenStart = jan4.getTime() - jan4Tag * TAG_MS
  const woche = Math.round((d.getTime() - wochenStart) / (7 * TAG_MS)) + 1
  return `${jahr}-W${String(woche).padStart(2, '0')}`
}

/** Nachschlagbar aufbereitete Historie. */
export interface StreakDaten {
  metrikJeTag: Map<string, MetrikTag>
  sollJeTagUndStufe: Map<string, number>
  /** Schlüssel `datum|stufe` aller Tage mit gesetztem `erledigt_at`. */
  erledigtJeTagUndStufe: Set<string>
}

export function bereiteDatenVor(metriken: MetrikTag[], portionen: PortionsTag[]): StreakDaten {
  const metrikJeTag = new Map<string, MetrikTag>()
  for (const m of metriken) metrikJeTag.set(m.datum, m)
  const sollJeTagUndStufe = new Map<string, number>()
  const erledigtJeTagUndStufe = new Set<string>()
  for (const p of portionen) {
    sollJeTagUndStufe.set(`${p.datum}|${p.stufe}`, p.soll)
    if (p.erledigtAt) erledigtJeTagUndStufe.add(`${p.datum}|${p.stufe}`)
  }
  return { metrikJeTag, sollJeTagUndStufe, erledigtJeTagUndStufe }
}

/**
 * War die Stufe an diesem Tag grün? `null` heisst: kein Urteil möglich —
 * Aus-den-Daten-Stufe ohne eingefrorene Portion (Tag vor der Einführung,
 * oder die App wurde an dem Tag nie geöffnet).
 */
export function stufeGruenAnTag(stufe: Stufe, datum: string, daten: StreakDaten): boolean | null {
  if (stufe.art === 'frische' || stufe.feld === null) return null

  /**
   * Der Vermerk sticht jeden Zähler (0075, 19.08.2026).
   *
   * Die Oberfläche kennt drei Wege zu grün — Soll erreicht, Soll war 0, oder
   * die LISTE IST LEER (`offenJetzt === 0`). Die Streak kannte nur die ersten
   * beiden und riss deshalb genau dort, wo Kevin sauber gearbeitet hatte: am
   * 18.08. standen 37 von 39 Erstnachrichten im Zähler, weil er zwei verworfen
   * hat statt sie zu senden. Zeile grün, Serie kaputt — und eine Serie, die
   * unfair reisst, wird ignoriert statt gejagt.
   *
   * Rückwirkend ist „war die Liste leer?" nicht rekonstruierbar. Also hält die
   * Oberfläche den Moment fest, in dem die Stufe stand, und hier wird er
   * gelesen.
   */
  if (daten.erledigtJeTagUndStufe.has(`${datum}|${stufe.id}`)) return true

  const wertRoh = daten.metrikJeTag.get(datum)?.[stufe.feld]
  const wert = typeof wertRoh === 'number' && Number.isFinite(wertRoh) ? wertRoh : 0

  if ((PORTION_STUFEN as readonly string[]).includes(stufe.id)) {
    const soll = daten.sollJeTagUndStufe.get(`${datum}|${stufe.id}`)
    if (soll == null) return null
    // Soll 0 ist eine Aussage: nichts war fällig, die Pflicht ist erfüllt.
    return wert >= soll
  }

  // Festes Ziel. Die Historie der ui_settings-Überschreibungen gibt es nicht —
  // rückwirkend zählt der Standard. Ehrlich genug: die Serie misst das Ritual,
  // nicht die Feinjustierung.
  const ziel = stufe.standardZiel ?? 0
  return ziel <= 0 ? true : wert >= ziel
}

/**
 * Die laufende Serie einer Stufe, rückwärts ab `heute`.
 *
 * `freezesJeWoche` verpasste Werktage je ISO-Woche frieren ein statt zu
 * reissen — aber nur INNERHALB der Serie: der Kopf (heute bzw. der letzte
 * Werktag davor) muss aus eigener Kraft grün sein, sonst gibt es nichts
 * einzufrieren. Ein Tag ohne Urteil (null) verhält sich wie ein verpasster:
 * er kostet einen Freeze oder beendet die Serie — so beginnt die Zählung
 * neuer Stufen sauber bei ihrer Einführung.
 */
export function salesSerie(
  stufe: Stufe,
  heute: string,
  daten: StreakDaten,
  freezesJeWoche = 1,
): SalesStreak {
  // Startpunkt: heute, wenn heute ein Werktag ist — sonst der Freitag davor.
  let cursor = heute
  while (istWochenende(cursor)) cursor = tagDavor(cursor)

  // Regel 2: der laufende Tag bricht nichts — ist er noch nicht grün, beginnt
  // die Zählung einen Werktag früher, und die Oberfläche sagt „heute offen".
  let heuteOffen = false
  if (stufeGruenAnTag(stufe, cursor, daten) !== true) {
    heuteOffen = true
    do {
      cursor = tagDavor(cursor)
    } while (istWochenende(cursor))
  }

  // Rückwärts, mit Freeze-Budget je ISO-Woche. Auch der KOPF darf ein
  // Freeze-Tag sein (Freitag beim Kunden, Montag früh geöffnet) — sonst
  // risse die Serie genau in dem Fall, für den der Freeze da ist. Deckel:
  // nie weiter zurück als Urteile da sind, sonst liefe die Schleife bei
  // einem kaputten Datum ins Endlose.
  const verbraucht = new Map<string, number>()
  const deckel = daten.metrikJeTag.size + daten.sollJeTagUndStufe.size + 14
  let laenge = 0
  let einGruenerGefunden = false
  let schritte = 0

  while (schritte++ < deckel) {
    const urteil = stufeGruenAnTag(stufe, cursor, daten)
    if (urteil === true) {
      laenge++
      einGruenerGefunden = true
    } else {
      // Verpasst oder kein Urteil (Tag vor der Einführung): kostet ein Freeze.
      const woche = isoWoche(cursor)
      const schonWeg = verbraucht.get(woche) ?? 0
      if (schonWeg >= freezesJeWoche) break
      verbraucht.set(woche, schonWeg + 1)
      // Der Freeze-Tag zählt nicht mit — die Serie läuft nur weiter.
    }
    do {
      cursor = tagDavor(cursor)
    } while (istWochenende(cursor))
  }

  // Nur Freezes und nie ein grüner Tag: das ist keine Serie.
  if (!einGruenerGefunden) return { laenge: 0, heuteOffen: false }
  return { laenge, heuteOffen }
}

/** Heute als ISO-Tag — Re-Export des Helfers, damit Flächen nicht selbst formatieren. */
export { isoTag }
