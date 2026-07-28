import { RUNNER_BASE_URL } from './useRunnerStatus'
import { beauftrageRunner, leseSpiegel, runnerDirekt } from './runnerBridge'

export interface RunSummary {
  id: string
  agent: string
  status: 'running' | 'done' | 'error'
  started: string
  finished: string
  preview: string
}

export interface RunDetail extends RunSummary {
  content: string
}

export interface VaultNote {
  path: string
  name: string
  mtime: number
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RUNNER_BASE_URL}${path}`, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Runner-Fehler ${res.status}`)
  return body
}

export interface AgentInfo {
  id: string
  label: string
  description: string
  kind: 'readonly' | 'write'
  running: boolean
}

/** Agenten-Katalog fürs Cockpit (/agenten). */
export async function fetchAgents(): Promise<AgentInfo[]> {
  if (!runnerDirekt()) {
    const spiegel = await leseSpiegel<{ agents: AgentInfo[] }>('agents')
    if (!spiegel) throw new Error('Noch kein Spiegel vorhanden — Runner einmal laufen lassen.')
    return spiegel.data.agents
  }
  const { agents } = await req<{ agents: AgentInfo[] }>('/agents')
  return agents
}

export async function postRun(agent: string, input?: Record<string, unknown>) {
  // Ohne direkten Draht als Auftrag über Supabase — der Runner holt ihn ab.
  if (!runnerDirekt()) {
    const r = await beauftrageRunner<{ id: string; agent: string; startedAt: string }>('agent_run', {
      agent,
      input: input ?? {},
    })
    if (r.status === 'error') throw new Error(r.error ?? 'Agent-Start fehlgeschlagen')
    return r.result as { id: string; agent: string; startedAt: string }
  }
  return req<{ id: string; agent: string; startedAt: string }>('/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, input }),
  })
}

export async function fetchRuns(limit = 20): Promise<RunSummary[]> {
  const { runs } = await req<{ runs: RunSummary[] }>(`/runs?limit=${limit}`)
  return runs
}

export function fetchRun(id: string): Promise<RunDetail> {
  return req<RunDetail>(`/runs/${encodeURIComponent(id)}`)
}

/** Holt eine private iCal-URL über den Runner-Proxy (umgeht Browser-CORS). */
export async function fetchCalendar(icalUrl: string): Promise<string> {
  const { ical } = await req<{ ical: string }>(`/calendar?url=${encodeURIComponent(icalUrl)}`)
  return ical
}

export async function fetchVaultRecent(limit = 15): Promise<VaultNote[]> {
  const { notes } = await req<{ notes: VaultNote[] }>(`/vault/recent?limit=${limit}`)
  return notes
}

export interface VaultGraphNode {
  path: string
  name: string
  /** Anzahl Wikilink-Verbindungen */
  links: number
}

export interface VaultGraph {
  nodes: VaultGraphNode[]
  edges: Array<{ source: string; target: string }>
}

export function fetchVaultGraph(): Promise<VaultGraph> {
  return req<VaultGraph>('/vault/graph')
}

// ---------- OS-Map (Agentic-OS-Graph) ----------
export interface OsSkill {
  id: string
  name: string
  description: string
  source: 'vault' | 'global'
  path: string
}
export interface OsRoutine {
  id: string
  name: string
  description: string
  schedule: string
}
export interface OsApp {
  id: string
  name: string
  description: string
  kind: string // mcp | api | cli | tool
  status: string // connected | manual | geplant
}
export interface OsMemory {
  path: string
  name: string
  links: number
  area: string // PARA-Top-Level-Ordner
}
export interface OsMap {
  skills: OsSkill[]
  routines: OsRoutine[]
  apps: OsApp[]
  memory: OsMemory[]
  memoryEdges: Array<{ source: string; target: string }>
  generatedAt: string
}

export function fetchOsMap(fresh = false): Promise<OsMap> {
  return req<OsMap>(fresh ? '/os/map?fresh=1' : '/os/map')
}

export interface OsFile {
  path: string
  content: string
  truncated: boolean
}

/** Read-only Dateiinhalt fürs Detail-Panel (Runner erlaubt nur Vault + globale Skills). */
export function fetchOsFile(path: string): Promise<OsFile> {
  return req<OsFile>(`/os/file?path=${encodeURIComponent(path)}`)
}

/** Obsidian-URL für eine Vault-Notiz (Vault-Name: Second Brain). */
export function obsidianUrl(notePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent('Second Brain')}&file=${encodeURIComponent(notePath.replace(/\.md$/, ''))}`
}

/**
 * Öffnet eine obsidian://-URL, ohne die SPA-Navigation anzufassen.
 * (window.open mit '_self' hängte die App auf, wenn das Protokoll
 * blockiert wird — z.B. im Preview-Panel.)
 */
export function openInObsidian(notePath: string): void {
  const a = document.createElement('a')
  a.href = obsidianUrl(notePath)
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
