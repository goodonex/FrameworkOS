import { useCallback, useRef, useState, type ReactNode } from 'react'

/**
 * Die Widgets nebeneinander statt untereinander (O18 v2 c).
 *
 * **Warum.** Gestapelt brauchten Heute, Termine und Woche zusammen mehr als
 * einen Bildschirm — die App-Kacheln lagen unter der Kante und der Homescreen
 * fing an, sich wie eine Seite zum Scrollen anzufühlen. Nebeneinander bleibt
 * die Arbeit oben und die Icons kommen ins Bild.
 *
 * **Warum nativ gescrollt und keine Wisch-Erkennung von Hand.** Ein eigener
 * Gesten-Handler muss entscheiden, ob ein Zug waagerecht oder senkrecht
 * gemeint war, und liegt dabei regelmäßig falsch. `scroll-snap` überlässt
 * genau diese Entscheidung dem Browser — dort ist sie gelöst. Das ist auch der
 * Grund, warum Wisch-Gesten auf den Listen-Zeilen (v2 f) ein eigener Punkt
 * bleiben: dort gibt es kein natives Gegenstück.
 *
 * Reihenfolge ist fest: **Heute zuerst.** Der Loslegen-Knopf darf nicht hinter
 * einem Wisch liegen (Klick-Ökonomie, Gesetz 2 der Blaupause).
 */
export function WidgetStack({ seiten }: { seiten: Array<{ id: string; label: string; inhalt: ReactNode }> }) {
  const [aktiv, setAktiv] = useState(0)
  const bahn = useRef<HTMLDivElement | null>(null)

  const beimScrollen = useCallback(() => {
    const el = bahn.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setAktiv((vorher) => (vorher === i ? vorher : i))
  }, [])

  const springe = useCallback((i: number) => {
    const el = bahn.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  return (
    <section aria-label="Widgets" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        ref={bahn}
        className="ck-widget-stack"
        onScroll={beimScrollen}
        // Eine Bahn, die man auch mit der Tastatur erreicht — sonst wären zwei
        // von drei Widgets für Tastaturbedienung unsichtbar.
        tabIndex={0}
        role="group"
      >
        {seiten.map((s) => (
          <div key={s.id} aria-label={s.label} role="group">
            {s.inhalt}
          </div>
        ))}
      </div>

      {/* Punkte: Ortsangabe UND Sprungziel. Ohne sie sieht man am Rechner nicht,
          dass rechts noch etwas liegt. */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {seiten.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => springe(i)}
            aria-label={`${s.label} zeigen`}
            aria-current={i === aktiv}
            style={{
              width: 34,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: i === aktiv ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === aktiv ? 'var(--ck-accent)' : 'var(--ck-border-strong)',
                transition: 'width 160ms ease, background 160ms ease',
              }}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
