import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { agentenBefund } from '../lib/agentenGesundheit'
import { useRunnerData } from '../lib/useRunnerData'
import { SperrBalken } from './home/BefundZeile'

/**
 * Shell-weiter Wächter: meldet per Toast, wenn ein Agent-Run fertig wird —
 * egal in welchem Cockpit-Bereich Kevin gerade arbeitet.
 *
 * **Seit dem 17.08.2026 rendert er zusätzlich den Sperrbalken.** Ein Toast ist
 * flüchtig, und die Warnzeile auf dem Homescreen sah aus wie jede andere rote
 * Meldung am Handy — vom 14. bis 17.08. lief drei Tage lang kein Agent durch,
 * ohne dass es auffiel. Der Balken hängt hier, weil dieser Wächter die Runs
 * ohnehin lädt; ein zweiter Poller entsteht dadurch nicht.
 */
export function RunWatcher() {
  const { runs } = useRunnerData()
  const { show } = useToast()
  const navigate = useNavigate()
  const knownRunning = useRef<Set<string>>(new Set())

  useEffect(() => {
    const nowRunning = new Set(runs.filter((r) => r.status === 'running').map((r) => r.id))

    // Runs, die vorher liefen und jetzt nicht mehr → fertig oder Fehler
    for (const id of knownRunning.current) {
      if (!nowRunning.has(id)) {
        const done = runs.find((r) => r.id === id)
        if (done?.status === 'error') {
          show(`⚠ ${done.agent} fehlgeschlagen`, 'error')
        } else {
          show(`✓ ${done?.agent ?? 'Agent'} fertig — im Cockpit ansehen`)
        }
      }
    }
    knownRunning.current = nowRunning
  }, [runs, show])

  const befund = useMemo(() => agentenBefund(runs), [runs])

  return <SperrBalken befund={befund} onOeffnen={() => navigate('/agenten')} />
}
