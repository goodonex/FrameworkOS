import { useCallback, useLayoutEffect, useRef, useState } from 'react'
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
  /**
   * Hat der Daumen die Bahn schon in der Hand? Ab dann rückt nichts mehr von
   * selbst — eine Oberfläche, die sich unter dem eigenen Wisch weiterbewegt,
   * ist kein Dienst, sondern ein Ärgernis.
   */
  const angefasst = useRef(false)

  /**
   * Eine Seite anfahren. Über das Kind, nicht über `scrollLeft` des Containers:
   * `scrollIntoView` referenziert das Element und übersteht ein Neu-Layout, bei
   * dem eine gerechnete Pixelposition ins Leere zeigt.
   */
  const zuSeite = useCallback((index: number, weich: boolean) => {
    const el = bahn.current
    if (!el || index < 0) return
    const seite = el.children[index] as HTMLElement | undefined
    seite?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: weich ? 'smooth' : 'auto' })
  }, [])

  /**
   * Wo steigt Kevin ein? Bei der ersten Stufe, die heute noch offen ist.
   *
   * Bewusst KEIN „einmal beim Öffnen und nie wieder". Zwei gemessene Gründe
   * (11.08., am laufenden Cockpit):
   *
   * 1. Beim ersten Rendern stehen alle Zähler auf 0, also sind alle Stufen
   *    offen — ein Versuch aus diesem Zustand verbrauchte den einen Schuss und
   *    die Kette bliebe auf einer längst erledigten Stufe stehen.
   * 2. Der Ladezustand flackert (mehrere Quellen werden nacheinander fertig).
   *    Bei jedem Wechsel rendert die Bahn neu, und das Scroll-Snap zieht sie
   *    auf die erste Seite zurück. Gegen dieses Zurückziehen kommt ein
   *    einmaliger Sprung nicht an.
   *
   * Der Sprung folgt deshalb dem Ziel, solange die Bahn noch nicht dort steht
   * — und hört auf, sobald sie sitzt oder der Daumen übernimmt.
   */
  const zielStufe = laedt || staende.length === 0 ? -1 : ersteOffeneStufe(staende)

  /**
   * Bewusst `useLayoutEffect` und bewusst OHNE `requestAnimationFrame`.
   *
   * Der erste Anlauf plante den Sprung in einem Frame und räumte ihn im
   * Cleanup wieder ab. Weil `staende` bei jedem Render eine neue Referenz
   * bekommt, lief der Effekt praktisch dauernd — und jeder geplante Frame
   * wurde gestrichen, bevor er dran war. Der Sprung kam nie zustande (am
   * 11.08. im laufenden Cockpit gemessen: null Frame-Läufe).
   *
   * Synchron nach dem Layout ist beides gelöst: die Bahn hat ihre Breite, und
   * zieht ein Neu-Rendern sie zurück auf die erste Seite, rückt der nächste
   * Durchlauf sie sofort wieder zurecht. Die Prüfung „sitzt schon" macht das
   * billig und verhindert, dass hier eine laufende Bewegung abgerissen wird.
   */
  useLayoutEffect(() => {
    // Steht der ganze Tag (-1) oder ist gleich die erste Stufe dran (0), bleibt
    // die Kette vorne — es gibt nichts anzusteuern.
    if (zielStufe <= 0 || angefasst.current) return
    const el = bahn.current
    if (!el || el.clientWidth === 0) return
    if (Math.round(el.scrollLeft / el.clientWidth) === zielStufe) return
    // Ohne Bewegung ankommen: beim Öffnen ist ein Scroll-Flug nur Unruhe, und
    // wer Bewegung abbestellt hat, bekommt hier ohnehin keine.
    zuSeite(zielStufe, false)
    setSichtbar(zielStufe)
  }, [zielStufe, staende, zuSeite])

  const onScroll = () => {
    const el = bahn.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setSichtbar(Math.max(0, Math.min(staende.length - 1, i)))
  }

  return (
    <div className="ck-flow">
      <div
        className="ck-widget-stack ck-flow-bahn"
        ref={bahn}
        onScroll={onScroll}
        // Ab der ersten Berührung gehört die Bahn dem Daumen (siehe `angefasst`).
        onPointerDown={() => {
          angefasst.current = true
        }}
      >
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
              angefasst.current = true
              zuSeite(i, true)
              setSichtbar(i)
            }}
          />
        ))}
      </div>
    </div>
  )
}
