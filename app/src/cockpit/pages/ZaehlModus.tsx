import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ZAEHL_FELDER, zaehlFeldFuer, type ZaehlFeld } from '../lib/zaehlFelder'
import { useDailyMetrics } from '../lib/useDailyMetrics'

/**
 * Der Zähl-Modus (11.08.2026) — Kevins Tracking-Ritual als Daumen-Werkzeug.
 *
 * Vorbild ist die App, mit der er bisher getrackt hat: ein Bildschirm, eine
 * Kennzahl, eine riesige Zahl — und die ganze Fläche ist der Knopf. Er schickt
 * drei Vernetzungsanfragen raus und tippt dreimal, ohne hinzusehen.
 *
 * **Es entsteht keine zweite Zähl-Wahrheit.** Jeder Tipp geht durch
 * `useDailyMetrics().bump(feld, +1)` — derselbe Weg wie QuickTrack, die
 * Tracking-Seite und Uriels `log_metric`. Dieselbe Zeile in `daily_metrics`,
 * dieselbe Null-Klammer, dieselbe Wochenrechnung.
 *
 * Zwei Ansichten, eine Route:
 *   `/tracking/zaehlen`        → Raster aller Tageszähler
 *   `/tracking/zaehlen/:feld`  → Vollbild für genau einen
 */
export function ZaehlModus() {
  const { feld } = useParams<{ feld: string }>()
  const gewaehlt = zaehlFeldFuer(feld)
  return gewaehlt ? <Vollbild zaehlFeld={gewaehlt} /> : <Raster />
}

/** Das Raster: jede Kachel zeigt den Tagesstand, ein Tipp öffnet das Vollbild. */
function Raster() {
  const navigate = useNavigate()
  const { today, loading } = useDailyMetrics()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Zählen</div>
          <div className="ck-label" style={{ marginTop: 2 }}>Heute · ein Tipp = plus eins</div>
        </div>
        <button type="button" className="ck-btn" onClick={() => navigate('/tracking')}>
          Zahlen ansehen
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {ZAEHL_FELDER.map((z) => {
          const wert = today[z.field]
          const anteil = z.tagesziel ? Math.min(1, wert / z.tagesziel) : 0
          return (
            <button
              key={z.field}
              type="button"
              className="ck-panel ck-zaehl-kachel"
              onClick={() => navigate(`/tracking/zaehlen/${z.field}`)}
              aria-label={`${z.langLabel} zählen — Stand ${wert}`}
            >
              <span className="ck-zaehl-kachel-ring" aria-hidden>
                {z.tagesziel ? (
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="var(--ck-card-border)" strokeWidth="6" />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="var(--ck-accent)"
                      strokeWidth="6"
                      strokeLinecap={anteil > 0 ? 'round' : 'butt'}
                      strokeDasharray={`${(2 * Math.PI * 54 * anteil).toFixed(1)} ${(2 * Math.PI * 54).toFixed(1)}`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="var(--ck-card-border)" strokeWidth="6" />
                  </svg>
                )}
                <span className="ck-zaehl-kachel-zahl ck-serif">{loading ? '·' : wert}</span>
              </span>
              <span className="ck-zaehl-kachel-label">{z.label}</span>
              {z.tagesziel ? (
                <span className="ck-zaehl-kachel-ziel ck-zahl">
                  {wert >= z.tagesziel ? 'Ziel steht' : `noch ${z.tagesziel - wert}`}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Das Vollbild. Die ganze Fläche ist der Knopf — deshalb liegt alles andere
 * (Schließen, Rückgängig, Wechseln) als eigener Knopf DARÜBER und stoppt die
 * Weitergabe des Klicks, sonst zählte jeder Griff ans Kreuz mit.
 */
function Vollbild({ zaehlFeld }: { zaehlFeld: ZaehlFeld }) {
  const navigate = useNavigate()
  const { today, bump } = useDailyMetrics()
  const wert = today[zaehlFeld.field]

  /**
   * Nur die Tipps DIESER Sitzung sind rücknehmbar. Was gestern oder in
   * QuickTrack gebucht wurde, gehört nicht hierher — sonst zöge „Rückgängig"
   * fremde Zahlen ab.
   */
  const [dieseSitzung, setDieseSitzung] = useState(0)
  const [puls, setPuls] = useState(0)
  const pulsTimer = useRef<number | null>(null)

  const index = ZAEHL_FELDER.findIndex((z) => z.field === zaehlFeld.field)
  const vor = ZAEHL_FELDER[(index + 1) % ZAEHL_FELDER.length]
  const zurueck = ZAEHL_FELDER[(index - 1 + ZAEHL_FELDER.length) % ZAEHL_FELDER.length]

  const zaehle = useCallback(() => {
    bump(zaehlFeld.field, 1)
    setDieseSitzung((n) => n + 1)
    setPuls((p) => p + 1)
  }, [bump, zaehlFeld.field])

  const zurueckNehmen = useCallback(() => {
    if (dieseSitzung <= 0) return
    bump(zaehlFeld.field, -1)
    setDieseSitzung((n) => n - 1)
  }, [bump, dieseSitzung, zaehlFeld.field])

  // Beim Wechsel des Feldes beginnt eine neue Sitzung.
  useEffect(() => {
    setDieseSitzung(0)
  }, [zaehlFeld.field])

  // Der kurze Aufleuchten-Effekt nach dem Tippen — die einzige Bewegung hier.
  useEffect(() => {
    if (puls === 0) return
    if (pulsTimer.current) window.clearTimeout(pulsTimer.current)
    pulsTimer.current = window.setTimeout(() => setPuls(0), 260)
    return () => {
      if (pulsTimer.current) window.clearTimeout(pulsTimer.current)
    }
  }, [puls])

  /**
   * Tippen zählt, Wischen wechselt — beides auf derselben Fläche.
   *
   * Der Zeiger wird beim Aufsetzen EINGEFANGEN (`setPointerCapture`). Ohne das
   * geht das `pointerup` an das Element, über dem der Finger am Ende liegt —
   * bei einem Wisch also an einen der Fußknöpfe, die die Weitergabe stoppen.
   * Der Wisch kam dann nie hier an (im ersten Anlauf genau so gemessen: die
   * Zahl zählte hoch, die Kennzahl wechselte nie).
   */
  const start = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* Ohne Capture funktioniert der Tipp weiterhin, nur der Wisch wird wackelig. */
    }
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current
    start.current = null
    // Kein Aufsetzen gesehen → nichts tun. Ein Tipp ohne Anfang ist keiner,
    // und blind hochzuzählen wäre die teuerste Art, sich zu irren.
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    // Waagerecht und deutlich = Wisch. Kurz und ruhig = Tipp. Dazwischen: nichts.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigate(`/tracking/zaehlen/${(dx < 0 ? vor : zurueck).field}`, { replace: true })
      return
    }
    if (Math.abs(dx) < 14 && Math.abs(dy) < 14) zaehle()
  }

  const rest = zaehlFeld.tagesziel ? Math.max(0, zaehlFeld.tagesziel - wert) : null

  return (
    <div
      className={`ck-zaehl-vollbild${puls ? ' ist-getippt' : ''}`}
      onPointerDown={onDown}
      onPointerUp={onUp}
      role="button"
      tabIndex={0}
      aria-label={`${zaehlFeld.langLabel} — plus eins`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          zaehle()
        }
      }}
    >
      <div className="ck-zaehl-kopf">
        <span className="ck-label">{zaehlFeld.langLabel}</span>
        <button
          type="button"
          className="ck-btn"
          onClick={(e) => {
            e.stopPropagation()
            navigate('/tracking/zaehlen')
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          Fertig
        </button>
      </div>

      <div className="ck-zaehl-mitte">
        <span className="ck-zaehl-zahl ck-serif">{wert}</span>
        {rest !== null ? (
          <span className="ck-zaehl-ziel ck-zahl">
            {rest === 0 ? 'Tagesziel steht.' : `noch ${rest} · Ziel ${zaehlFeld.tagesziel}`}
          </span>
        ) : null}
      </div>

      <div className="ck-zaehl-fuss">
        <button
          type="button"
          className="ck-btn"
          disabled={dieseSitzung <= 0}
          onClick={(e) => {
            e.stopPropagation()
            zurueckNehmen()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          Rückgängig
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--ck-text-3)', textAlign: 'center', whiteSpace: 'nowrap' }}>
          Tippen zählt · wischen wechselt
        </span>
        <button
          type="button"
          className="ck-btn"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/tracking/zaehlen/${vor.field}`, { replace: true })
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {vor.label}
        </button>
      </div>
    </div>
  )
}
