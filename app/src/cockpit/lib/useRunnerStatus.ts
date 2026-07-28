import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export const RUNNER_BASE_URL = 'http://127.0.0.1:4711'

export type RunnerState = 'online' | 'offline' | 'checking'

interface RunnerStatusPayload {
  alive: boolean
  running: Array<{ id: string; agent: string; startedAt: string }>
  queued: Array<{ id: string; agent: string }>
}

/** Läuft das Cockpit lokal? Dann ist der Runner-Port direkt erreichbar. */
function isLocalOrigin(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/** Heartbeat gilt als „frisch" (= Runner online), wenn er höchstens so alt ist. */
const HEARTBEAT_FRESH_MS = 45_000

/**
 * Pollt den Runner-Status.
 * - Lokal: direkter Fetch auf http://127.0.0.1:4711 (schnell, exakt).
 * - Auf der HTTPS-Live-Domain: der lokale Port ist per Mixed Content geblockt
 *   (der Runner erschien deshalb IMMER offline). Stattdessen liest der Hook den
 *   `runner_heartbeat`, den der Runner alle ~15s nach Supabase schreibt
 *   (Migration 0057). Online = Herzschlag jünger als HEARTBEAT_FRESH_MS.
 */
export function useRunnerStatus(pollMs = 15000): {
  state: RunnerState
  runningCount: number
} {
  const [state, setState] = useState<RunnerState>('checking')
  const [runningCount, setRunningCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const local = isLocalOrigin()

    const checkLocal = async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 2500)
      try {
        const res = await fetch(`${RUNNER_BASE_URL}/status`, { signal: controller.signal })
        if (cancelled) return
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as RunnerStatusPayload
        if (cancelled) return
        setState(data.alive ? 'online' : 'offline')
        setRunningCount(data.running?.length ?? 0)
      } catch {
        if (!cancelled) {
          setState('offline')
          setRunningCount(0)
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    const checkRemote = async () => {
      if (!supabase) {
        if (!cancelled) {
          setState('offline')
          setRunningCount(0)
        }
        return
      }
      try {
        const { data, error } = await supabase
          .from('runner_heartbeat')
          .select('last_seen, running')
          .eq('id', 'global')
          .maybeSingle()
        if (cancelled) return
        if (error || !data?.last_seen) {
          setState('offline')
          setRunningCount(0)
          return
        }
        const age = Date.now() - new Date(data.last_seen as string).getTime()
        const fresh = age >= 0 && age <= HEARTBEAT_FRESH_MS
        setState(fresh ? 'online' : 'offline')
        setRunningCount(fresh ? (Array.isArray(data.running) ? data.running.length : 0) : 0)
      } catch {
        if (!cancelled) {
          setState('offline')
          setRunningCount(0)
        }
      }
    }

    const check = local ? checkLocal : checkRemote

    void check()
    const interval = window.setInterval(() => void check(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [pollMs])

  return { state, runningCount }
}
