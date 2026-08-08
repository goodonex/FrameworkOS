import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Die Zeilen-Grammatik der iOS-Erinnerungen für Uriels mobile Listen
 * (O18, Zug 7 · D7): Kreis-Haken links, Titel, kleine Meta-Zeile, rechts die
 * EINE Aktion.
 *
 * **Optik über der Posten-Engine, nie statt ihr.** Das Datenmodell bleibt
 * unangetastet: Der Kreis ruft ausschließlich die vorhandenen Erledigt-Pfade
 * (`onErledigt`/`erledigePosten`, `tasks.toggle`), es gibt kein neues Feld und
 * keine dritte Aufgaben-Wahrheit. Leads werden dadurch keine To-dos — Stufen,
 * Fristen ab der letzten Nachricht, der vorbereitete Entwurf am Posten und die
 * eine Aktion je Zeile sind genau das, was eine Erinnerungen-App nicht kann.
 *
 * Nur mobil im Einsatz. Die Desktop-Listen bleiben, wie sie sind (Gesetz 3).
 */

/** Der Kreis links. Ohne `onHaken` ist er nicht da — nicht etwa deaktiviert. */
export function KreisHaken({
  erledigt,
  onHaken,
  label,
}: {
  erledigt: boolean
  onHaken?: () => void
  label: string
}) {
  if (!onHaken) {
    // O7: Erinnerungs-Posten (`nurZaehler`) haben bewusst keinen Haken — ihre
    // Wahrheit ist der Zähler. Der Platz bleibt trotzdem stehen, damit die
    // Titel aller Zeilen auf einer Kante sitzen.
    return <span aria-hidden style={{ width: 44, flexShrink: 0 }} />
  }
  return (
    <button
      type="button"
      onClick={onHaken}
      disabled={erledigt}
      aria-label={label}
      style={{
        width: 44,
        minHeight: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: erledigt ? 'default' : 'pointer',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 21,
          height: 21,
          borderRadius: 999,
          border: `1.5px solid ${erledigt ? 'var(--ck-accent)' : 'var(--ck-border-strong)'}`,
          background: erledigt ? 'var(--ck-accent-dim)' : 'transparent',
          color: 'var(--ck-accent)',
          fontSize: 12,
          lineHeight: '19px',
          textAlign: 'center',
        }}
      >
        {erledigt ? '✓' : ''}
      </span>
    </button>
  )
}

/**
 * Wisch-Gesten auf der Zeile (O18 v2 f).
 *
 * **Nativ gescrollt, nicht selbst erkannt** — dieselbe Entscheidung wie beim
 * Widget-Stack: ob ein Zug waagerecht oder senkrecht gemeint war, beantwortet
 * der Browser zuverlässiger als jede Heuristik. Das war die Bedingung, unter
 * der die Blaupause diesen Punkt überhaupt zugelassen hat.
 *
 * **Bewusst kein Auslösen durch das Wischen selbst.** Das Wischen legt die
 * Aktion frei, der Tipp darauf führt sie aus. „→ morgen" verschiebt einen Lead
 * um einen Tag und es gibt kein Zurück; ein Fehlwisch wäre still und teuer.
 * Der Haken kostet ohnehin nur einen Tipp auf den Kreis — die Geste muss ihn
 * nicht schneller machen, sie macht nur „morgen" überhaupt erst erreichbar.
 */
function WischBahn({
  onMorgen,
  onHaken,
  erledigt,
  children,
}: {
  onMorgen?: () => void
  onHaken?: () => void
  erledigt: boolean
  children: ReactNode
}) {
  const bahn = useRef<HTMLDivElement | null>(null)

  // Die Zeile liegt in der Mitte; links und rechts wartet je eine Aktion.
  useEffect(() => {
    const el = bahn.current
    if (!el) return
    const links = el.firstElementChild as HTMLElement | null
    if (links?.dataset.aktion === 'morgen') el.scrollLeft = links.offsetWidth
  }, [onMorgen])

  const zurueck = () => {
    const el = bahn.current
    if (!el) return
    const links = el.firstElementChild as HTMLElement | null
    el.scrollTo({ left: links?.dataset.aktion === 'morgen' ? links.offsetWidth : 0, behavior: 'smooth' })
  }

  return (
    <div ref={bahn} className="ck-zeile-wisch">
      {onMorgen ? (
        <button
          type="button"
          data-aktion="morgen"
          className="ck-zeile-aktion"
          style={{ color: 'var(--ck-warn)' }}
          onClick={() => {
            onMorgen()
            zurueck()
          }}
        >
          → morgen
        </button>
      ) : null}
      <div className="ck-zeile-inhalt">{children}</div>
      {onHaken && !erledigt ? (
        <button
          type="button"
          data-aktion="haken"
          className="ck-zeile-aktion"
          style={{ color: 'var(--ck-accent)' }}
          onClick={() => {
            onHaken()
            zurueck()
          }}
        >
          Erledigt
        </button>
      ) : null}
    </div>
  )
}

export function ListenZeile({
  titel,
  meta,
  erledigt = false,
  onHaken,
  hakenLabel,
  onTitel,
  onMorgen,
  ausgeklappt,
  aktion,
}: {
  titel: string
  /** Eine Zeile klein darunter: Firma, Frist, Herkunft — was die Spur trägt. */
  meta?: ReactNode
  erledigt?: boolean
  /** Ruft den bestehenden Erledigt-Pfad. Fehlt er, gibt es keinen Kreis. */
  onHaken?: () => void
  hakenLabel?: string
  /** Tipp auf den Titel (in der Arbeitsliste: auf-/zuklappen). */
  onTitel?: () => void
  /** „→ morgen" hinter dem Wischen. Nur wo ein echter Verschiebe-Pfad existiert. */
  onMorgen?: () => void
  ausgeklappt?: boolean
  /** Die EINE Aktion rechts — Kopieren, Skript, Zähler. */
  aktion?: ReactNode
}) {
  const titelInhalt = (
    <>
      <span
        style={{
          fontSize: 14,
          color: erledigt ? 'var(--ck-text-3)' : 'var(--ck-text-1)',
          textDecoration: erledigt ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }}
      >
        {titel}
      </span>
      {meta ? (
        <span
          style={{
            display: 'block',
            marginTop: 1,
            fontSize: 11.5,
            color: 'var(--ck-text-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {meta}
        </span>
      ) : null}
    </>
  )

  const zeile = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 48 }}>
      <KreisHaken erledigt={erledigt} onHaken={onHaken} label={hakenLabel ?? `${titel} abhaken`} />
      {onTitel ? (
        <button
          type="button"
          onClick={onTitel}
          aria-expanded={ausgeklappt}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            padding: '6px 0',
            background: 'none',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          {titelInhalt}
        </button>
      ) : (
        <span style={{ flex: 1, minWidth: 0 }}>{titelInhalt}</span>
      )}
      {aktion ? <span style={{ flexShrink: 0, display: 'flex', gap: 6 }}>{aktion}</span> : null}
    </div>
  )

  // Ohne Wisch-Aktion bleibt die Zeile eine gewöhnliche Zeile — kein
  // Scroll-Container, wo es nichts zu wischen gibt.
  if (!onMorgen && !onHaken) return zeile
  return (
    <WischBahn onMorgen={onMorgen} onHaken={onHaken} erledigt={erledigt}>
      {zeile}
    </WischBahn>
  )
}
