import { RUNNER_BASE_URL } from './useRunnerStatus'
import { leseSpiegel, runnerDirekt } from './runnerBridge'
import type { JophielStand } from './jophielProjekte'

/**
 * Jophiels Projektliste — lokal über den Runner, sonst über den Spiegel
 * (Migration 0059, Muster aus `salesLibraryApi.ts`).
 *
 * **Wirft nie.** Ein Nebendienst, der aus ist, darf Kevins Sales-Seite nicht
 * mit einer roten Zeile zumachen — das steht so in der Blaupause und ist im
 * Runner schon so gebaut. Hier gilt dasselbe eine Ebene höher: Ist auch der
 * Runner weg, kommt `jophielErreichbar: false` zurück, und die Oberfläche
 * sagt einen stillen Satz.
 */
export async function fetchJophielProjekte(): Promise<JophielStand> {
  try {
    if (!runnerDirekt()) {
      const spiegel = await leseSpiegel<JophielStand>('jophiel_projekte')
      if (!spiegel) return { projekte: [], jophielErreichbar: false }
      // Der Spiegel ist ein Standbild: Er sagt, was zuletzt gebaut war, nicht
      // ob Jophiel jetzt läuft. Für die Karten reicht genau das.
      return { projekte: spiegel.data.projekte ?? [], jophielErreichbar: true }
    }
    const res = await fetch(`${RUNNER_BASE_URL}/jophiel/projekte`)
    if (!res.ok) return { projekte: [], jophielErreichbar: false }
    const body = (await res.json()) as JophielStand
    return { projekte: body.projekte ?? [], jophielErreichbar: Boolean(body.jophielErreichbar) }
  } catch {
    return { projekte: [], jophielErreichbar: false }
  }
}

/**
 * Die URL des Vorschaubilds — oder `null`, wenn es keine gibt.
 *
 * Ohne direkten Draht zum Runner gibt es kein Bild: Die Aufnahmen liegen auf
 * Kevins Rechner und sind bewusst NICHT in den Storage-Spiegel gewandert (das
 * wären Dutzende Megabyte für eine Vorschau). Am Handy zeigt die Karte
 * deshalb den Namen ohne Bild — ehrlicher als ein toter Bildrahmen.
 */
export function jophielShotUrl(slug: string): string | null {
  if (!runnerDirekt()) return null
  return `${RUNNER_BASE_URL}/jophiel/shot/${encodeURIComponent(slug)}/desktop`
}
