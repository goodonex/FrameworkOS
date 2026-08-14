import { useCallback, useEffect, useState } from 'react'
import type { RunSummary } from './runnerApi'
import { fetchRuns, RUNS_FENSTER } from './runnerApi'
import { useRunnerStatus } from './useRunnerStatus'

/**
 * Runs vom lokalen Runner (Phase 5). Pollt nur, wenn der Runner online ist;
 * bei laufenden Runs schneller (5s), damit "done" zeitnah im Cockpit ankommt.
 * (Der OS-Graph lädt seine Daten separat über useOsMap → /os/map.)
 */
export function useRunnerData() {
  const runner = useRunnerStatus()
  const [runs, setRuns] = useState<RunSummary[]>([])

  const refresh = useCallback(async () => {
    if (runner.state !== 'online') return
    try {
      const r = await fetchRuns(RUNS_FENSTER)
      // Referenz nur wechseln, wenn sich Inhalte ändern (verhindert unnötige Re-Renders)
      setRuns((prev) => (JSON.stringify(prev) === JSON.stringify(r) ? prev : r))
    } catch {
      /* Runner kurz weg — nächster Poll versucht es wieder */
    }
  }, [runner.state])

  useEffect(() => {
    void refresh()
    const hasActive = runs.some((r) => r.status === 'running')
    const interval = window.setInterval(() => void refresh(), hasActive ? 5000 : 20000)
    return () => window.clearInterval(interval)
  }, [refresh, runs.some((r) => r.status === 'running')]) // eslint-disable-line react-hooks/exhaustive-deps

  return { runner, runs, refresh }
}
