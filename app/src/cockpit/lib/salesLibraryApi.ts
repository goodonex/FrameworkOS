import { RUNNER_BASE_URL } from './useRunnerStatus'

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
  const res = await fetch(`${RUNNER_BASE_URL}/sales/library`)
  const body = (await res.json()) as SalesLibrary & { error?: string }
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Runner-Fehler ${res.status}`)
  return body
}

/** URL für eine statische Datei aus dem Sales-Skripte-Ordner (Segmente einzeln encodiert). */
export function salesFileUrl(rel: string): string {
  const encoded = rel.split('/').map(encodeURIComponent).join('/')
  return `${RUNNER_BASE_URL}/files/sales/${encoded}`
}
