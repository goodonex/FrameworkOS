import { RUNNER_BASE_URL } from './useRunnerStatus'
import { leseSpiegel, runnerDirekt } from './runnerBridge'
import { supabase } from '../../lib/supabase'
import type { JophielProjekt, JophielStand } from './jophielProjekte'

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
 * **Was hier bis zum 28.08.2026 stand und warum es falsch war.** Der alte
 * Kommentar begründete die fehlenden Bilder auf der Live-Domain mit „Dutzende
 * Megabyte für eine Vorschau". Das stimmt für die Originale (1,0–4,5 MB je
 * Aufnahme) und ist für das, was der Runner ausliefert, um den Faktor 20
 * daneben: `jophielShot()` verkleinert auf 640 px JPEG, also 50–150 kB.
 * Kevins Beobachtung — *„da steht ‚Vorschaubild nur am Rechner', aber ich bin
 * ja am Rechner"* — traf einen echten Fehler: Der Satz sprach vom Gerät,
 * gemeint war die Adresse. Auf frameworkos.de verbietet der Browser den
 * Zugriff auf `http://127.0.0.1:4711` als Mixed Content.
 *
 * Seitdem spiegelt der Runner die verkleinerte Aufnahme in den Bucket
 * `runner-files`. Lokal bleibt es beim direkten Draht — schneller und ohne
 * Signier-Umweg.
 */
export function jophielShotUrl(projekt: JophielProjekt): string | null {
  if (runnerDirekt()) return `${RUNNER_BASE_URL}/jophiel/shot/${encodeURIComponent(projekt.slug)}/desktop`
  if (!projekt.shotKey) return null
  const treffer = signierteShots.get(projekt.shotKey)
  if (!treffer) return null
  return Date.now() - treffer.at > SIGNIERT_MS ? null : treffer.url
}

/**
 * Der Signier-Zwischenspeicher für die gespiegelten Vorschaubilder.
 *
 * Muster und Gültigkeit wie in `runnerFiles.ts` (privater Bucket, signierte
 * URLs, eine Stunde). Bewusst hier statt dort: Die Datei-Spiegelung dreht sich
 * um `sorte + rel-Pfad` unter drei festen Wurzelverzeichnissen — ein
 * Vorschaubild aus Jophiels Cache passt in keine davon, und die Systematik
 * dafür zu verbiegen wäre teurer als diese zwölf Zeilen.
 */
const SIGNIERT_MS = 3600 * 1000
const signierteShots = new Map<string, { url: string; at: number }>()

/**
 * Signiert die Vorschau-URLs einer Projektliste im Voraus — ein Aufruf für
 * alle. Danach liefert `jophielShotUrl` sie synchron.
 *
 * Wirft nie: Ohne Signatur bleibt die Karte bei ihrem Ersatztext, und das ist
 * der richtige Ausgang. Lokal passiert gar nichts, dort gibt es den direkten
 * Draht.
 */
export async function bereiteJophielVorschauVor(projekte: readonly JophielProjekt[]): Promise<void> {
  if (runnerDirekt() || !supabase) return
  const jetzt = Date.now()
  const offen = [
    ...new Set(
      projekte
        .map((p) => p.shotKey)
        .filter((k): k is string => Boolean(k))
        .filter((k) => {
          const bekannt = signierteShots.get(k)
          // Fünf Minuten vor Ablauf neu signieren, damit kein Bild mitten im
          // Ansehen tot umfällt.
          return !bekannt || jetzt - bekannt.at > SIGNIERT_MS - 5 * 60 * 1000
        }),
    ),
  ]
  if (offen.length === 0) return
  try {
    const { data, error } = await supabase.storage
      .from('runner-files')
      .createSignedUrls(offen, SIGNIERT_MS / 1000)
    if (error || !data) return
    for (const eintrag of data) {
      if (eintrag.signedUrl && eintrag.path) signierteShots.set(eintrag.path, { url: eintrag.signedUrl, at: Date.now() })
    }
  } catch {
    /* Nebendienst — eine fehlende Vorschau ist kein Grund für einen Fehler. */
  }
}
