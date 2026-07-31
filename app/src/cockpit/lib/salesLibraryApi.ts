import { RUNNER_BASE_URL } from './useRunnerStatus'
import { leseSpiegel, runnerDirekt } from './runnerBridge'
import { bereiteDateienVor, gespiegelteDateiUrl } from './runnerFiles'

export interface SalesLibraryVaultEntry {
  name: string
  path: string
  kind: 'md'
  mtime: string
}

export interface SalesLibrarySkriptEntry {
  name: string
  rel: string
  kind: 'md' | 'html' | 'pdf'
  mtime: string
}

export interface SalesLibrary {
  vault: SalesLibraryVaultEntry[]
  skripte: SalesLibrarySkriptEntry[]
}

export async function fetchSalesLibrary(): Promise<SalesLibrary> {
  // Ohne direkten Draht zum Runner den Spiegel lesen (Migration 0059).
  if (!runnerDirekt()) {
    const spiegel = await leseSpiegel<SalesLibrary>('sales_library')
    if (!spiegel) throw new Error('Noch kein Spiegel vorhanden — Runner einmal laufen lassen.')
    // Die Dateien liegen im Storage-Spiegel — URLs gleich mitsignieren, damit
    // salesFileUrl darunter synchron bleiben kann.
    await bereiteDateienVor('sales', spiegel.data.skripte.map((s) => s.rel))
    return spiegel.data
  }
  const res = await fetch(`${RUNNER_BASE_URL}/sales/library`)
  const body = (await res.json()) as SalesLibrary & { error?: string }
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Runner-Fehler ${res.status}`)
  return body
}

/**
 * URL für eine statische Datei aus dem Sales-Skripte-Ordner.
 * Lokal der Runner-Pfad (Segmente einzeln encodiert), sonst die signierte
 * Storage-URL. Null heißt: noch nicht gespiegelt — dann bietet die Oberfläche
 * bewusst keinen toten Link an.
 */
export function salesFileUrl(rel: string): string | null {
  if (!runnerDirekt()) return gespiegelteDateiUrl('sales', rel)
  const encoded = rel.split('/').map(encodeURIComponent).join('/')
  return `${RUNNER_BASE_URL}/files/sales/${encoded}`
}
