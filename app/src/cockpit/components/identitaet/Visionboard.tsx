import { VISIONBOARD, boardPfad } from '../../lib/visionboard'

/**
 * Das Visionboard — die kuratierten Bilder im Kapitel „Traumleben".
 *
 * **Warum hier Fotos stehen, obwohl DESIGN-TOKENS Bilder auf Arbeitsflächen
 * verbietet:** Die Regel lautet „Arbeitsflächen (Sales, Listen, Tracking, Ads)
 * bleiben ruhige Farbfläche". Das Board ist keine Arbeitsfläche, sondern der
 * editoriale Teil des Cockpits — dieselbe Ausnahme, die der Home-Hero schon
 * hat. Die Scrim-Pflicht gilt trotzdem: es steht kein Text auf einem Bild,
 * alle Beschriftungen liegen darunter.
 *
 * Uhren werden vollständig gezeigt statt beschnitten (`vollstaendig` in der
 * Registry) — eine angeschnittene Uhr ist kein Uhrenbild.
 *
 * Alle Bilder laden `lazy`: das Board wiegt zusammen gut zwei Megabyte, und am
 * Handy im Mobilfunknetz soll die Morgenlese sofort lesbar sein.
 */
export function Visionboard() {
  return (
    <div className="ck-ident-board">
      {VISIONBOARD.map((gruppe) => (
        <section key={gruppe.id} aria-labelledby={`board-${gruppe.id}`}>
          <div className="ck-ident-board-kopf">
            <span className="ck-label" id={`board-${gruppe.id}`}>
              {gruppe.titel}
            </span>
            {gruppe.hinweis ? <span className="ck-ident-board-hinweis">{gruppe.hinweis}</span> : null}
          </div>

          <div className={`ck-ident-board-grid${gruppe.vollstaendig ? ' ck-ident-board-grid--voll' : ''}`}>
            {gruppe.bilder.map((bild) => (
              <figure key={bild.datei} className="ck-ident-karte">
                <div className="ck-ident-bild">
                  <img src={boardPfad(bild.datei)} alt={bild.titel} loading="lazy" decoding="async" />
                </div>
                <figcaption className="ck-ident-karte-text">
                  <b>{bild.titel}</b>
                  {bild.notiz ? <span className="ck-ident-karte-notiz"> · {bild.notiz}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
