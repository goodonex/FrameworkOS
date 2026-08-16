import { VISIONBOARD, boardPfad } from '../../lib/visionboard'

/**
 * Das Visionboard unter der Morgenlese.
 *
 * **Warum hier Fotos stehen, obwohl DESIGN-TOKENS Bilder auf Arbeitsflächen
 * verbietet:** Die Regel lautet „Arbeitsflächen (Sales, Listen, Tracking, Ads)
 * bleiben ruhige Farbfläche". Das Board ist keine Arbeitsfläche, sondern der
 * editoriale Teil des Cockpits — dieselbe Ausnahme, die der Home-Hero schon
 * hat. Die Scrim-Pflicht gilt trotzdem: es steht kein Text auf einem Bild,
 * alle Beschriftungen liegen darunter auf der Kartenfläche.
 *
 * Alle Bilder laden `lazy`. Beim Öffnen der Seite kommt also nur, was oben
 * steht — das Board wiegt zusammen 2,1 MB, und am Handy im Mobilfunknetz soll
 * die Morgenlese sofort lesbar sein.
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

          <div className="ck-ident-board-grid">
            {gruppe.bilder.map((bild) => (
              <figure key={bild.datei} className="ck-panel ck-ident-karte">
                <div className={`ck-ident-bild${bild.freigestellt ? ' ck-ident-bild--frei' : ''}`}>
                  <img
                    src={boardPfad(bild.datei)}
                    alt={bild.titel}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption className="ck-ident-karte-text">
                  <span className="ck-ident-karte-titel">{bild.titel}</span>
                  {bild.notiz ? <span className="ck-ident-karte-notiz">{bild.notiz}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
