import { RUNNER_BASE_URL } from './useRunnerStatus'
import { beauftrageRunner, leseSpiegel, runnerDirekt } from './runnerBridge'

/**
 * Warum ein Lauf abgebrochen ist — kommt fertig vom Runner
 * (`runner/laufGrund.mjs`), das Cockpit deutet hier nichts selbst.
 *
 * `handeln` ist das Feld, auf das es ankommt: es trennt „Kevin muss ran"
 * (abgelaufene Anmeldung) von „erledigt sich beim nächsten Lauf" (kein Netz).
 * Fehlt der Grund, ist er schlicht nicht erkannt worden — dann bleibt es beim
 * allgemeinen „Fehler", statt einen zu erfinden.
 */
export interface LaufGrund {
  /**
   * `fehlstart` seit dem 18.08.: Zeitlimit ohne einen einzigen Werkzeug-Aufruf
   * — der Lauf hat nie stattgefunden, weil der Mac schlief. Kein Scheitern,
   * sondern ein Nicht-Ereignis (siehe `runner/laufGrund.mjs`).
   */
  schluessel: 'anmeldung' | 'kontingent' | 'netz' | 'fehlstart' | 'zeitlimit' | 'unbekannt'
  /** Kurz, für die Zeile in der Liste: „Anmeldung abgelaufen". */
  kurz: string
  /** Was zu tun ist — ein Satz. */
  hinweis: string
  /** Muss Kevin selbst ran? */
  handeln: boolean
}

export interface RunSummary {
  id: string
  agent: string
  status: 'running' | 'done' | 'error'
  started: string
  finished: string
  preview: string
  /** Nur bei `status: 'error'`, und nur wenn der Grund erkennbar war. */
  grund?: LaufGrund
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

/**
 * Runs-Spiegel: der Runner legt Liste UND Inhalt der letzten ~20 Läufe in
 * Supabase ab — bei jedem Start/Ende sofort, nicht erst im Minuten-Tick.
 * Ohne das wären auf der HTTPS-Domain Freigaben-Queue, Run-Toasts und der
 * „Skript fertig"-Zustand tot (`/runs` hängt an 127.0.0.1).
 */
async function leseRunsSpiegel(): Promise<RunDetail[]> {
  const spiegel = await leseSpiegel<{ runs: RunDetail[] }>('runs')
  if (!spiegel) throw new Error('Noch kein Spiegel vorhanden — Runner einmal laufen lassen.')
  return spiegel.data.runs
}

/**
 * Wie viele Laeufe die Oberflaeche betrachtet — EINE Zahl fuer alle Orte.
 * `agentenBefund` bewertet genau die Liste, die es bekommt; mit
 * unterschiedlichen Fenstern (12 auf /agenten, 20 auf dem Homescreen) meldete
 * die Agenten-Seite an vollen Tagen weniger Fehlschlaege als die Startseite.
 */
export const RUNS_FENSTER = 20

export async function fetchRuns(limit = RUNS_FENSTER): Promise<RunSummary[]> {
  if (!runnerDirekt()) {
    // Inhalt hier abstreifen — die Liste ist eine Übersicht, den Text holt
    // fetchRun. (Sonst hinge er an jeder Poll-Runde im React-State.)
    return (await leseRunsSpiegel())
      .slice(0, limit)
      .map(({ id, agent, status, started, finished, preview, grund }) => ({
        id,
        agent,
        status,
        started,
        finished,
        preview,
        // Der Grund ist ein Vier-Felder-Objekt und wiegt nichts — er muss mit,
        // sonst stünde am Handy wieder nur „Fehler". Der Inhalt bleibt draussen.
        ...(grund ? { grund } : {}),
      }))
  }
  const { runs } = await req<{ runs: RunSummary[] }>(`/runs?limit=${limit}`)
  return runs
}

export async function fetchRun(id: string): Promise<RunDetail> {
  if (!runnerDirekt()) {
    const treffer = (await leseRunsSpiegel()).find((r) => r.id === id)
    if (!treffer) throw new Error('Dieser Run liegt nicht im Spiegel — gespiegelt werden die letzten 20.')
    return treffer
  }
  return req<RunDetail>(`/runs/${encodeURIComponent(id)}`)
}

/**
 * Kalender-Rohtext für /termine.
 *
 * Der Spiegel hat IMMER Vorrang — auch am Mac. Sonst zeigte derselbe Tag am
 * Handy alle Kalender aus `CALENDAR_ICAL_URL` und am Rechner nur den einen aus
 * dem ⚙-Panel (localStorage): zwei Wahrheiten auf dieselbe Frage. Die lokale
 * URL bleibt Rückfallebene, solange der Runner keine Kalender kennt.
 */
export async function fetchCalendar(icalUrl: string | null): Promise<string> {
  const spiegel = await leseSpiegel<{ ical: string }>('calendar').catch(() => null)
  if (spiegel?.data?.ical) return spiegel.data.ical

  if (!runnerDirekt()) {
    throw new Error('Kein Kalender-Spiegel — CALENDAR_ICAL_URL in runner/.env setzen, Runner neu starten.')
  }
  if (!icalUrl) throw new Error('Keine iCal-URL hinterlegt.')
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
