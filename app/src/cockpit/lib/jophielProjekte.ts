/**
 * Die Klammer zwischen Uriel und Jophiel (25.08.2026, Blaupause
 * `docs/wargames/sales-canvas.md`, Zug 7).
 *
 * Jophiel baut die Demo-Seiten für Kevins Looms. Welcher Lead dazugehört,
 * steht dort in `project.json.leadName` — von Hand eingetippt, als Kevin das
 * Projekt anlegte. Uriels Leads kommen aus LinkedIn. Zwei Quellen, ein
 * Mensch, und **keine gemeinsame Kennung**.
 *
 * **Die Lehre aus 0076 gilt hier genauso:** Es gibt zwei Sorten LinkedIn-IDs,
 * die nie zueinander passen, und deshalb verheiratet das Lead-System über den
 * Namen. Hier ist es nicht einmal eine Wahl — ein Handeintrag hat gar keine
 * ID. Also: normalisieren und vergleichen, und **kein Treffer heisst Karte
 * ohne Lead-Verknüpfung, nicht Karte weglassen.** Eine gebaute Seite
 * verschwinden zu lassen, weil ein Name anders geschrieben ist, wäre der
 * teuerste Ausgang: Kevin hat die Arbeit bezahlt und sieht sie nicht.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-jophiel-projekte.ts`.
 */
import { normName } from './leadIdentitaet'

/**
 * Namen vergleichbar machen — mit einem Vorlauf, den `leadIdentitaet.normName`
 * nicht braucht.
 *
 * Dort kommen beide Seiten aus derselben Maschine (LinkedIn). Hier tippt Kevin
 * die eine Seite von Hand in Jophiels Formular, und was dabei aus einer
 * Zwischenablage mitkommt, hat schon mal einen Zeilenumbruch oder einen
 * Tabulator drin. `normName` wirft alles ausser Buchstaben und Leerzeichen
 * raus — aus „Hartmut\nSchneider" würde dabei „hartmutschneider", und der
 * Abgleich scheiterte an einem unsichtbaren Zeichen.
 *
 * Deshalb hier zuerst jede Art von Leerraum auf ein Leerzeichen ziehen, dann
 * die gemeinsame Regel anwenden. Bewusst nur in dieser Datei: Die geteilte
 * Funktion anzufassen hiesse, den Lead-Abgleich im ganzen System zu ändern,
 * um ein Problem zu lösen, das es nur an dieser einen Handeingabe gibt.
 */
function vergleichbar(wert: string | null | undefined): string {
  return normName(String(wert ?? '').replace(/\s+/g, ' '))
}

/** Ein Projekt, wie es der Runner liefert (`runner/jophiel.mjs`). */
export interface JophielProjekt {
  slug: string
  name: string
  /** Von Hand eingetragen — die einzige Klammer zu Uriel. Oft leer. */
  leadName: string
  status: string
  createdAt: string
  note: string
  oldUrl: string
  /** Gibt es eine Aufnahme der NEUEN Seite? Entscheidet über die Kartensorte. */
  hatShot: boolean
  hatAltShot: boolean
  vorschauUrl: string
}

export interface JophielStand {
  projekte: JophielProjekt[]
  /** Läuft Jophiel gerade? Sonst ist die Liste leer, ohne dass etwas kaputt ist. */
  jophielErreichbar: boolean
}

export interface VerknuepftesProjekt {
  projekt: JophielProjekt
  /** Die Lead-Id, wenn ein Name gepasst hat — sonst null. */
  leadId: string | null
  /** Der Uriel-Name, wie er dort geschrieben steht. */
  leadName: string | null
}

/**
 * Projekte mit Leads verheiraten.
 *
 * Mehrdeutigkeit wird NICHT still aufgelöst: Stehen zwei Leads unter demselben
 * normalisierten Namen (im Bestand gibt es 14 doppelte Namen, siehe
 * `useLeads`), bleibt die Karte unverknüpft. Einen davon zu raten hiesse, eine
 * Website dem falschen Menschen zuzuordnen — und genau diese Zuordnung ist
 * das, wofür die Karte da ist.
 */
export function verknuepfeProjekte(
  projekte: readonly JophielProjekt[],
  leads: readonly { id: string; name: string }[],
): VerknuepftesProjekt[] {
  const jeName = new Map<string, { id: string; name: string } | 'mehrdeutig'>()
  for (const lead of leads) {
    const key = vergleichbar(lead.name)
    if (!key) continue
    const vorhanden = jeName.get(key)
    if (vorhanden === undefined) jeName.set(key, lead)
    else if (vorhanden !== 'mehrdeutig' && vorhanden.id !== lead.id) jeName.set(key, 'mehrdeutig')
  }

  return projekte.map((projekt): VerknuepftesProjekt => {
    const key = vergleichbar(projekt.leadName)
    const treffer = key ? jeName.get(key) : undefined
    if (!treffer || treffer === 'mehrdeutig') return { projekt, leadId: null, leadName: null }
    return { projekt, leadId: treffer.id, leadName: treffer.name }
  })
}

/**
 * Nur die, bei denen es etwas zu zeigen gibt.
 *
 * Kevins Unterscheidung vom 25.08.: Eine zugesagte Loom-Analyse ohne gebaute
 * Seite ist eine Aufgabe (sie steht als Karte im Funnel). Eine gebaute Seite
 * ist ein Ergebnis — und die zeigt man mit Bild. Ein Browser-Rahmen um ein
 * leeres Feld wäre das Gegenteil von beidem.
 */
export function mitVorschau(verknuepft: readonly VerknuepftesProjekt[]): VerknuepftesProjekt[] {
  return verknuepft.filter((v) => v.projekt.hatShot)
}
