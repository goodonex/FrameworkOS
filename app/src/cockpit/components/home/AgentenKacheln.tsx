import type { AgentenBefund, RoutineAgent } from '../../lib/agentenGesundheit'
import { ROUTINE_AGENTEN, istWerktag } from '../../lib/agentenGesundheit'
import type { RunSummary } from '../../lib/runnerApi'

/**
 * Die Nacht-Routinen als Kachel-Reihe auf dem Homescreen (O18 v2 b).
 *
 * **Warum das hier steht.** Die `BefundZeile` meldet nur den Schadensfall. Die
 * häufigere Frage am Morgen ist die andere: *ist der Morgenbrief durch?* Dafür
 * musste man bisher `/agenten` aufmachen.
 *
 * **Keine neue Datenquelle** (Gesetz 4): Zustand und Befund kommen aus
 * `runs` + `agentenBefund`, die `UrielHome` für die Warnzeile ohnehin hat.
 * Diese Komponente rechnet nur die Anzeige daraus.
 */

const LABEL: Record<RoutineAgent, string> = {
  morgenbrief: 'Morgenbrief',
  'linkedin-antwort-entwuerfe': 'Entwürfe',
  'dream-check': 'Dream',
}

/** Läuft werktags (runner/index.mjs) — am Wochenende ist Ausbleiben kein Befund. */
const NUR_WERKTAGS: RoutineAgent[] = ['morgenbrief', 'linkedin-antwort-entwuerfe']

export type Zustand = 'laeuft' | 'durch' | 'gescheitert' | 'wartet' | 'ruht'

/** Rein, damit `scripts/verify-agenten-kacheln.ts` sie ohne DOM prüfen kann. */
export function zustandVon(
  agent: RoutineAgent,
  runs: RunSummary[],
  befund: AgentenBefund,
  jetzt: Date,
): Zustand {
  if (runs.some((r) => r.agent === agent && r.status === 'running')) return 'laeuft'
  if (befund.fehlschlaege.some((r) => r.agent === agent)) return 'gescheitert'
  if (befund.erfolgreich.includes(agent)) return 'durch'
  // Kein Lauf heute — am Wochenende ist das für die Werktags-Routinen richtig so.
  if (!istWerktag(jetzt) && NUR_WERKTAGS.includes(agent)) return 'ruht'
  return 'wartet'
}

const ANZEIGE: Record<Zustand, { zeichen: string; text: string; farbe: string }> = {
  laeuft: { zeichen: '◐', text: 'läuft', farbe: 'var(--ck-warn)' },
  durch: { zeichen: '◉', text: 'durch', farbe: 'var(--ck-accent)' },
  gescheitert: { zeichen: '◍', text: 'Fehler', farbe: 'var(--ck-danger)' },
  wartet: { zeichen: '○', text: 'offen', farbe: 'var(--ck-text-3)' },
  ruht: { zeichen: '○', text: 'ruht', farbe: 'var(--ck-text-3)' },
}

export function AgentenKacheln({
  runs,
  befund,
  jetzt,
  onOeffnen,
}: {
  runs: RunSummary[]
  befund: AgentenBefund
  jetzt: Date
  onOeffnen: () => void
}) {
  return (
    <section aria-label="Nacht-Routinen" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="ck-label" style={{ paddingLeft: 2 }}>
        Heute Nacht
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
        {ROUTINE_AGENTEN.map((agent) => {
          const a = ANZEIGE[zustandVon(agent, runs, befund, jetzt)]
          return (
            <button
              key={agent}
              type="button"
              onClick={onOeffnen}
              aria-label={`${LABEL[agent]}: ${a.text} — Agenten öffnen`}
              style={{
                minHeight: 56,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 2px',
                borderRadius: 'var(--ck-radius-innen)',
                border: '1px solid var(--ck-border)',
                background: 'var(--ck-panel)',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden className="ck-nav-icon" style={{ width: 'auto', fontSize: 15, color: a.farbe }}>
                {a.zeichen}
              </span>
              <span
                className="ck-label"
                style={{
                  fontSize: 9,
                  color: 'var(--ck-text-2)',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {LABEL[agent]}
              </span>
              <span aria-hidden style={{ fontSize: 9.5, color: a.farbe }}>
                {a.text}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
