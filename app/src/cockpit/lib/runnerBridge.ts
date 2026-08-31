import { supabase } from '../../lib/supabase'
import { isLocalOrigin } from './useRunnerStatus'

/**
 * Brücke zum Runner für den Fall, dass die Seite ihn nicht direkt erreichen darf
 * (Migration 0059).
 *
 * Auf `localhost` spricht das Cockpit weiter direkt mit dem Runner — schnell und
 * unverändert. Auf der HTTPS-Domain verbietet der Browser das; dort läuft beides
 * über Supabase:
 *
 * - **Lesen:** der Runner spiegelt seine Ansichten periodisch nach
 *   `runner_snapshots`, die Seite liest von dort.
 * - **Handeln:** die Seite legt einen Auftrag in `runner_jobs` ab, der Runner
 *   holt ihn sich alle paar Sekunden und schreibt das Ergebnis zurück.
 *
 * Nach außen offen ist dabei nichts — Kevins Rechner ruft ausschließlich raus.
 */

/** Direkter Draht zum Runner möglich? Sonst geht alles über Supabase. */
export function runnerDirekt(): boolean {
  return isLocalOrigin()
}

/** Liest einen gespiegelten Datensatz. Null, wenn noch nie gespiegelt wurde. */
export async function leseSpiegel<T>(key: string): Promise<{ data: T; updatedAt: string } | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('runner_snapshots')
    .select('data, updated_at')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return null
  return { data: data.data as T, updatedAt: data.updated_at as string }
}

export type JobKind = 'linkedin_sync' | 'agent_run' | 'runde' | 'runde_abbrechen'

/**
 * Auftrag ablegen und NICHT auf das Ergebnis warten (31.08.2026).
 *
 * Für die Runde: Sie läuft bis zu zwanzig Minuten, `beauftrageRunner` gibt nach
 * fünf auf. Der Fortschritt kommt ohnehin über den Spiegel `runde_stand` — auf
 * das Auftrags-Ergebnis wartet hier niemand.
 */
export async function beauftrageRunnerOhneWarten(
  kind: JobKind,
  payload: Record<string, unknown> = {},
  brandId?: string | null,
): Promise<void> {
  if (!supabase) throw new Error('Keine Supabase-Verbindung')
  const { error } = await supabase.from('runner_jobs').insert({ kind, payload, brand_id: brandId ?? null })
  if (error) throw new Error(error.message)
}

export interface JobErgebnis<T = unknown> {
  status: 'done' | 'error'
  result?: T
  error?: string
}

const POLL_MS = 1500
const TIMEOUT_MS = 5 * 60 * 1000

/**
 * Legt einen Auftrag ab und wartet, bis der Runner ihn erledigt hat.
 * Wirft, wenn kein Supabase da ist oder die Wartezeit überschritten wird —
 * ein hängender Auftrag ist besser sichtbar als ein stiller.
 */
export async function beauftrageRunner<T = unknown>(
  kind: JobKind,
  payload: Record<string, unknown> = {},
  brandId?: string | null,
): Promise<JobErgebnis<T>> {
  if (!supabase) throw new Error('Keine Supabase-Verbindung')

  const { data, error } = await supabase
    .from('runner_jobs')
    .insert({ kind, payload, brand_id: brandId ?? null })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Auftrag konnte nicht angelegt werden')

  const id = data.id as string
  const bis = Date.now() + TIMEOUT_MS

  while (Date.now() < bis) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    const { data: job } = await supabase
      .from('runner_jobs')
      .select('status, result, error')
      .eq('id', id)
      .maybeSingle()
    if (!job) continue
    if (job.status === 'done') return { status: 'done', result: job.result as T }
    if (job.status === 'error') return { status: 'error', error: (job.error as string) ?? 'Unbekannter Fehler' }
  }
  throw new Error('Der Runner hat nicht geantwortet — läuft er auf diesem Rechner?')
}
