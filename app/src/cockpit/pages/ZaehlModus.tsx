import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TAGES_FLOW, naechsteZaehlbareStufe } from '../lib/tagesFlow'
import { useFlowLiveQuellen, useTagesFlow, type TagesFlowStand } from '../lib/useTagesFlow'
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
 *
 * Seit dem Tages-Flow (11.08.) schiebt das Vollbild weiter: steht eine Stufe,
 * springt es nach einem kurzen Moment zur nächsten offenen (D5). Die Daten
 * dafür werden **hier oben einmal** geholt und nach unten gereicht — sonst
 * abonnierten Raster und Vollbild dieselben Tabellen zweimal.
 */
export function ZaehlModus() {
  const { feld } = useParams<{ feld: string }>()
  const gewaehlt = zaehlFeldFuer(feld)
  const metrics = useDailyMetrics()
  const live = useFlowLiveQuellen()
  const flow = useTagesFlow(metrics.today, live.quellen, metrics.loading || live.laedt)

  return gewaehlt ? (
    <Vollbild zaehlFeld={gewaehlt} metrics={metrics} flow={flow} />
  ) : (
    <Raster metrics={metrics} flow={flow} />
  )
}

type Metrics = ReturnType<typeof useDailyMetrics>

/**
 * Wie lange „Stufe steht." stehen bleibt, bevor der Flow weiterschiebt (D5).
 *
 * Lang genug, um es zu lesen, kurz genug, um nicht im Weg zu stehen. Es ist
 * eine Lesepause, keine Animation — deshalb bleibt sie auch bei
 * `prefers-reduced-motion` bestehen; was dort wegfällt, ist die Bewegung
 * (siehe `.ck-zaehl-vollbild` in cockpit.css).
 */
const STUFE_STEHT_MS = 800

/**
 * Das Soll einer Kachel/Stufe für heute. Steht das Feld im Tages-Flow, gilt
 * dessen Soll (bei den Follow-ups ist das die Zahl der heute fälligen Threads);
 * sonst das feste Ziel aus der Liste — oder gar keines.
 */
function sollUndStand(zaehlFeld: ZaehlFeld, flow: TagesFlowStand) {
  const index = TAGES_FLOW.findIndex((s) => s.feld === zaehlFeld.field)
  const stand = index >= 0 ? flow.staende[index] : null
  return { index, stand, soll: stand ? stand.soll : (zaehlFeld.tagesziel ?? null) }
}

/** Das Raster: jede Kachel zeigt den Tagesstand, ein Tipp öffnet das Vollbild. */
function Raster({ metrics, flow }: { metrics: Metrics; flow: TagesFlowStand }) {
  const navigate = useNavigate()
  const { today, loading } = metrics

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
          // Das Soll kommt aus dem Flow, wo es eines gibt — bei den Follow-ups
          // ist das die Zahl der heute fälligen Threads, nicht eine feste Zahl.
          const { soll } = sollUndStand(z, flow)
          const anteil = soll ? Math.min(1, wert / soll) : 0
          return (
            <button
              key={z.field}
              type="button"
              className="ck-panel ck-zaehl-kachel"
              onClick={() => navigate(`/tracking/zaehlen/${z.field}`)}
              aria-label={`${z.langLabel} zählen — Stand ${wert}`}
            >
              <span className="ck-zaehl-kachel-ring" aria-hidden>
                {soll ? (
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
              {soll ? (
                <span className="ck-zaehl-kachel-ziel ck-zahl">
                  {wert >= soll ? 'Ziel steht' : `noch ${soll - wert}`}
                </span>
              ) : soll === 0 ? (
                // Soll 0 heisst hier nicht „kein Ziel", sondern „heute ist
                // nichts fällig" — das ist eine Aussage und gehört hin.
                <span className="ck-zaehl-kachel-ziel ck-zahl">nichts fällig</span>
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
function Vollbild({
  zaehlFeld,
  metrics,
  flow,
}: {
  zaehlFeld: ZaehlFeld
  metrics: Metrics
  flow: TagesFlowStand
}) {
  const navigate = useNavigate()
  const { today, bump } = metrics
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

  /**
   * Der Tages-Flow (D5): steht die Stufe, geht es weiter.
   *
   * `stufeWarOffen` ist der Unterschied zwischen „Kevin hat die Stufe eben
   * fertiggemacht" und „Kevin sieht sich eine längst erledigte Stufe an". Ohne
   * diese Merke würde jedes Öffnen einer fertigen Stufe sofort weiterspringen,
   * und man käme nie dorthin, wo man hinwollte.
   */
  const { index: stufenIndex, stand, soll } = sollUndStand(zaehlFeld, flow)
  const stufeErledigt = stand?.erledigt ?? false
  // Nur zählbare Stufen sind Sprungziele — die Antworten-Stufe hat im
  // Zähl-Modus keine Seite (sie wird abgearbeitet, nicht gezählt).
  const zielStufe = stufeErledigt ? naechsteZaehlbareStufe(flow.staende, stufenIndex) : -2
  const stufeWarOffen = useRef(false)
  const [uebergang, setUebergang] = useState<{ ziel: number } | null>(null)

  // Beim Wechsel des Feldes beginnt eine neue Sitzung — und eine neue Merke.
  useEffect(() => {
    setDieseSitzung(0)
    stufeWarOffen.current = false
    setUebergang(null)
  }, [zaehlFeld.field])

  useEffect(() => {
    // Solange geladen wird, stehen alle Zähler auf 0 und jede Stufe sähe offen
    // aus. Aus diesem Zustand darf weder gemerkt noch gesprungen werden.
    if (flow.laedt || !stand) return
    if (!stufeErledigt) {
      stufeWarOffen.current = true
      // Nimmt Kevin innerhalb des Moments zurück, ist die Stufe wieder offen —
      // dann fällt der angekündigte Sprung mitsamt seinem Timer weg.
      setUebergang(null)
      return
    }
    if (!stufeWarOffen.current) return
    setUebergang({ ziel: zielStufe })
  }, [flow.laedt, stand, stufeErledigt, zielStufe])

  useEffect(() => {
    // Ziel < 0 heisst: der Tag steht. Dann wird nichts mehr angesteuert, die
    // Meldung bleibt einfach stehen.
    if (!uebergang || uebergang.ziel < 0) return
    const ziel = TAGES_FLOW[uebergang.ziel]
    if (!ziel?.feld) return
    const id = window.setTimeout(() => {
      navigate(`/tracking/zaehlen/${ziel.feld}`, { replace: true })
    }, STUFE_STEHT_MS)
    return () => window.clearTimeout(id)
  }, [uebergang, navigate])

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

  const rest = soll !== null && soll > 0 ? Math.max(0, soll - wert) : null
  const naechste = uebergang && uebergang.ziel >= 0 ? TAGES_FLOW[uebergang.ziel] : null

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
        <span className="ck-label">
          {/* Wo im Tag steht Kevin gerade? Nur für die fünf Stufen — die
              Kanäle dahinter sind kein Ritual und tragen keine Nummer. */}
          {stufenIndex >= 0 ? `Stufe ${stufenIndex + 1} von ${TAGES_FLOW.length} · ` : ''}
          {zaehlFeld.langLabel}
        </span>
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
        {uebergang ? (
          // Der Moment, in dem die Stufe steht (D5). Er sagt zugleich, wohin
          // es gleich geht — ein Sprung ohne Ankündigung fühlt sich an wie ein
          // Fehler, auch wenn er richtig ist.
          <span className="ck-zaehl-uebergang" role="status">
            <strong>{naechste ? 'Stufe steht.' : 'Der Tag steht.'}</strong>
            <span>{naechste ? `Weiter zu ${naechste.label}` : 'Alle Stufen sind durch.'}</span>
          </span>
        ) : rest !== null ? (
          <span className="ck-zaehl-ziel ck-zahl">
            {rest === 0 ? 'Tagesziel steht.' : `noch ${rest} · Ziel ${soll}`}
          </span>
        ) : soll === 0 ? (
          <span className="ck-zaehl-ziel ck-zahl">Heute ist nichts fällig.</span>
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
        <span className="ck-zaehl-hinweis">Tippen zählt · wischen wechselt</span>
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
