import { useCallback, useEffect, useRef, useState } from 'react'
import type { MetricField } from '../../lib/metrikFelder'
import { ersteOffeneStufe, type StufenStand } from '../../lib/tagesFlow'

/**
 * Die Stufen-Kette im Hero (11.08.2026) — aus einer Kennzahl werden fünf.
 *
 * Bis heute stand oben auf dem Homescreen ein einzelner Ring („30/30
 * Anfragen"). Kevins Tag hat aber fünf Stationen in fester Reihenfolge; die
 * Kette zeigt sie als wischbaren Stapel, einen Ring je Stufe. Ein Tipp auf den
 * Ring öffnet den Zähl-Modus für genau diese Stufe — derselbe eine Weg wie
 * vorher, nur jetzt für jede Station.
 *
 * **Diese Komponente rechnet nichts** (D6, wie der Hero selbst). Die Stände
 * kommen fertig aus `UrielHome`, das die Hooks ohnehin ruft. Sie entscheidet
 * nur, welche Seite man beim Öffnen sieht — und das ist eine Frage der
 * Bildlaufposition, keine der Zahlen.
 *
 * Die Bahn nutzt `.ck-widget-stack` aus `cockpit.css`: natives Scroll-Snap.
 * Der Browser entscheidet zuverlässiger als jede eigene Gestenerkennung, ob
 * ein Zug waagerecht oder senkrecht gemeint war.
 */

/** Radius und Umfang des Rings — r52 nach DESIGN-TOKENS.md, wie im Einzel-Hero. */
const RADIUS = 52
const UMFANG = 2 * Math.PI * RADIUS

function unterzeile(s: StufenStand): string {
  if (s.soll <= 0) return 'Heute ist nichts fällig.'
  if (s.erledigt) return 'Steht.'
  return `Noch ${s.soll - s.wert} · ${s.stufe.hinweis}`
}

export function TagesFlowStack({
  staende,
  laedt,
  onStufe,
}: {
  staende: StufenStand[]
  /** Solange true, ist „offen" noch nicht entschieden — dann wird nicht gescrollt. */
  laedt: boolean
  /** Öffnet den Zähl-Modus für diese Stufe. Die Kette kennt die Route nicht selbst. */
  onStufe: (feld: MetricField) => void
}) {
  const bahn = useRef<HTMLDivElement>(null)
  const [sichtbar, setSichtbar] = useState(0)
  /** Einmal je Sitzung an die richtige Stelle rücken — danach gehört die Bahn dem Daumen. */
  const schonGerueckt = useRef(false)

  const zuSeite = useCallback((index: number, weich: boolean) => {
    const el = bahn.current
    if (!el || index < 0) return
    el.scrollTo({ left: index * el.clientWidth, behavior: weich ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (laedt || schonGerueckt.current || staende.length === 0) return
    const ziel = ersteOffeneStufe(staende)
    schonGerueckt.current = true
    // Steht der ganze Tag, bleibt die Kette vorne — die erste Stufe ist dann
    // die Zusammenfassung, kein Rücksprung ins Nichts.
    if (ziel <= 0) return
    // Ohne Bewegung ankommen: beim Öffnen ist ein Scroll-Flug nur Unruhe, und
    // wer Bewegung abbestellt hat, bekommt hier ohnehin keine.
    zuSeite(ziel, false)
    setSichtbar(ziel)
  }, [laedt, staende, zuSeite])

  const onScroll = () => {
    const el = bahn.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setSichtbar(Math.max(0, Math.min(staende.length - 1, i)))
  }

  return (
    <div className="ck-flow">
      <div className="ck-widget-stack ck-flow-bahn" ref={bahn} onScroll={onScroll}>
        {staende.map((s) => {
          const anteil = s.soll > 0 ? Math.min(1, Math.max(0, s.wert / s.soll)) : 0
          return (
            <div key={s.stufe.id} className="ck-flow-seite">
              <div className="ck-ring">
                <button
                  type="button"
                  className="ck-ring-feld"
                  onClick={() => onStufe(s.stufe.feld)}
                  aria-label={`${s.stufe.langLabel} zählen — ${s.wert}${s.soll > 0 ? ` von ${s.soll}` : ''}`}
                >
                  <svg viewBox="0 0 120 120" aria-hidden>
                    {/* Glas-Mitte + Bahn */}
                    <circle
                      cx="60"
                      cy="60"
                      r={RADIUS}
                      fill="var(--ck-ring-glas)"
                      stroke="var(--ck-card-border)"
                      strokeWidth="5"
                    />
                    {/* Der gelaufene Teil. Start oben, im Uhrzeigersinn. Die
                        Kappe ist nur rund, solange etwas gelaufen ist — bei 0
                        malte eine runde Kappe einen Punkt auf die Bahn, und
                        der sähe aus wie „einer ist schon drin". */}
                    <circle
                      cx="60"
                      cy="60"
                      r={RADIUS}
                      fill="none"
                      stroke="var(--ck-accent)"
                      strokeWidth="5"
                      strokeLinecap={anteil > 0 ? 'round' : 'butt'}
                      strokeDasharray={`${(UMFANG * anteil).toFixed(1)} ${UMFANG.toFixed(1)}`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <span className="ck-ring-mitte" aria-hidden>
                    <span className="ck-ring-zahl">
                      {s.wert}
                      {s.soll > 0 ? <i>/{s.soll}</i> : null}
                    </span>
                    <span className="ck-label">{s.stufe.label}</span>
                  </span>
                </button>
                <p className="ck-ring-unter">{unterzeile(s)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Wo bin ich? Ein Haken für erledigte Stufen, sonst ein Punkt — so ist
          der Tagesstand ablesbar, ohne durch die Kette zu wischen. */}
      <div className="ck-flow-punkte" role="tablist" aria-label="Stufen des Tages">
        {staende.map((s, i) => (
          <button
            key={s.stufe.id}
            type="button"
            role="tab"
            aria-selected={i === sichtbar}
            aria-label={`${s.stufe.label}${s.erledigt ? ' — steht' : ''}`}
            className={`ck-flow-punkt${i === sichtbar ? ' ist-hier' : ''}${s.erledigt ? ' ist-fertig' : ''}`}
            onClick={() => {
              zuSeite(i, true)
              setSichtbar(i)
            }}
          />
        ))}
      </div>
    </div>
  )
}
