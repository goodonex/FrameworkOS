import { supabase } from '../../lib/supabase'
import { leseSpiegel } from './runnerBridge'

/**
 * Datei-Spiegel: die Dateien, die sonst nur der lokale Runner ausliefern kann
 * (Loom-Skripte, Follow-up-PDFs, Wochen-Galerien, Ad-Creatives), liegen im
 * privaten Bucket `runner-files`. Der Runner lädt sie hoch und veröffentlicht
 * ein Verzeichnis als Snapshot `files_index`; hier werden daraus signierte URLs
 * (Muster: projectFiles.ts / Migration 0051).
 *
 * Die URL-Getter (`salesFileUrl` & Co.) bleiben synchron — sie lesen aus dem
 * Cache, den die Listen-Fetcher vorher gefüllt haben. Noch nicht vorbereitet
 * oder gar nicht gespiegelt → `null`, und die Oberfläche sagt das ehrlich,
 * statt einen toten Link anzubieten.
 */

export type DateiSorte = 'sales' | 'social' | 'kunden'

interface IndexEintrag {
  key: string
  mtime: number
  size: number
}

/** Gültigkeit der signierten URLs. Wie bei project-files: eine Stunde. */
const SIGNIERT_MS = 3600 * 1000
/** Etwas vor Ablauf neu signieren, damit kein Klick ins Leere läuft. */
const NEU_SIGNIEREN_AB_MS = SIGNIERT_MS - 5 * 60 * 1000

let indexCache: { at: number; files: Record<string, IndexEintrag> } | null = null
const INDEX_CACHE_MS = 60_000
const urlCache = new Map<string, { url: string; at: number }>()

function id(sorte: DateiSorte, rel: string): string {
  return `${sorte}:${rel}`
}

async function ladeIndex(): Promise<Record<string, IndexEintrag>> {
  if (indexCache && Date.now() - indexCache.at < INDEX_CACHE_MS) return indexCache.files
  const spiegel = await leseSpiegel<{ files: Record<string, IndexEintrag> }>('files_index')
  const files = spiegel?.data.files ?? {}
  indexCache = { at: Date.now(), files }
  return files
}

/**
 * Signiert die URLs einer Liste im Voraus (ein Aufruf für alle Dateien einer
 * Sorte). Danach liefert `gespiegelteDateiUrl` sie synchron. Fehler bleiben
 * still — die Getter geben dann `null` zurück.
 */
export async function bereiteDateienVor(sorte: DateiSorte, rels: string[]): Promise<void> {
  if (!supabase || rels.length === 0) return
  let index: Record<string, IndexEintrag>
  try {
    index = await ladeIndex()
  } catch {
    return
  }
  const jetzt = Date.now()
  const offen = new Map<string, string>() // storage-key → id
  for (const rel of rels) {
    const eintrag = index[id(sorte, rel)]
    if (!eintrag) continue
    const bekannt = urlCache.get(id(sorte, rel))
    if (bekannt && jetzt - bekannt.at < NEU_SIGNIEREN_AB_MS) continue
    offen.set(eintrag.key, id(sorte, rel))
  }
  if (offen.size === 0) return

  const keys = [...offen.keys()]
  const { data, error } = await supabase.storage
    .from('runner-files')
    .createSignedUrls(keys, SIGNIERT_MS / 1000)
  if (error || !data) return
  for (const eintrag of data) {
    if (!eintrag.signedUrl || !eintrag.path) continue
    const zugehoerig = offen.get(eintrag.path)
    if (zugehoerig) urlCache.set(zugehoerig, { url: eintrag.signedUrl, at: Date.now() })
  }
}

/** Signierte URL aus dem Cache. Null = nicht gespiegelt oder noch nicht vorbereitet. */
export function gespiegelteDateiUrl(sorte: DateiSorte, rel: string): string | null {
  const treffer = urlCache.get(id(sorte, rel))
  if (!treffer) return null
  if (Date.now() - treffer.at > SIGNIERT_MS) return null
  return treffer.url
}
