import { CHECKIN_EINHEITEN, ENERGIE_MAX, ENERGIE_MIN } from '../../lib/identityInhalte'
import type { CheckinRow } from '../../lib/useIdentityCheckin'

/**
 * Der tägliche Check-in: drei Haken, ein Energie-Regler, drei
 * Dankbarkeitszeilen.
 *
 * **Ein Tipp = eine erledigte Einheit** (Klick-Ökonomie). Die ganze Zeile ist
 * der Knopf, nicht nur das Kästchen — am Daumen trifft man eine 44-px-Zeile,
 * ein 20-px-Kästchen nicht. Es gibt keinen Speichern-Knopf: der Hook schreibt
 * gebündelt, wie überall sonst im Cockpit auch.
 *
 * Die Dankbarkeit steht bewusst zuletzt und ohne Pflichtgefühl — sie ist Teil
 * der Abendroutine, nicht der Morgenlese. Wer morgens nur die Haken setzt,
 * lässt sie leer.
 */

interface Props {
  heute: CheckinRow
  laedt: boolean
  umschalten: (feld: 'vertriebsblock' | 'clean' | 'sport') => void
  setzen: (patch: Partial<Omit<CheckinRow, 'datum'>>) => void
}

/** Das Haken-Zeichen — dieselbe Linien-Sprache wie `BereichIcon`. */
function Haken({ an }: { an: boolean }) {
  return (
    <span className={`ck-ident-box${an ? ' ck-ident-box--an' : ''}`} aria-hidden>
      {an ? (
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      ) : null}
    </span>
  )
}

export function CheckinKarte({ heute, laedt, umschalten, setzen }: Props) {
  const dankbar: Array<'dankbar_1' | 'dankbar_2' | 'dankbar_3'> = ['dankbar_1', 'dankbar_2', 'dankbar_3']
  const energieGesetzt = heute.energie !== null && heute.energie !== undefined

  return (
    <section className="ck-ident-checkin" id="checkin" aria-labelledby="checkin-titel">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="ck-label" id="checkin-titel">
          Check-in heute
        </span>
        <span className="ck-ident-checkin-stand ck-zahl">
          {CHECKIN_EINHEITEN.filter((e) => heute[e.feld]).length} von {CHECKIN_EINHEITEN.length}
        </span>
      </div>

      {/* --- Die drei Einheiten ------------------------------------------- */}
      <div className="ck-ident-einheiten">
        {CHECKIN_EINHEITEN.map((e) => {
          const an = heute[e.feld]
          return (
            <button
              key={e.feld}
              type="button"
              className={`ck-ident-zeile${an ? ' ck-ident-zeile--an' : ''}`}
              onClick={() => umschalten(e.feld)}
              disabled={laedt}
              aria-pressed={an}
            >
              <Haken an={an} />
              <span className="ck-ident-zeile-text">
                <span className="ck-ident-zeile-titel">{e.titel}</span>
                <span className="ck-ident-zeile-mass">{e.mass}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* --- Energielevel -------------------------------------------------- */}
      <div className="ck-ident-energie">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <label className="ck-label" htmlFor="energie-regler">
            Energielevel
          </label>
          <span className="ck-serif ck-zahl ck-ident-energie-wert">
            {energieGesetzt ? heute.energie : '—'}
          </span>
        </div>
        <input
          id="energie-regler"
          type="range"
          className={`ck-ident-regler${energieGesetzt ? '' : ' ck-ident-regler--leer'}`}
          min={ENERGIE_MIN}
          max={ENERGIE_MAX}
          step={1}
          // Ohne Wert steht der Griff in der Mitte, der Regler ist aber gedimmt
          // und die Zahl zeigt „—": eine vorbelegte 5 wäre eine Antwort, die
          // Kevin nicht gegeben hat.
          value={heute.energie ?? 5}
          onChange={(ev) => setzen({ energie: Number(ev.target.value) })}
          disabled={laedt}
          aria-valuetext={energieGesetzt ? `${heute.energie} von ${ENERGIE_MAX}` : 'noch nicht gesetzt'}
        />
        <div className="ck-ident-regler-skala" aria-hidden>
          <span>{ENERGIE_MIN}</span>
          <span>{ENERGIE_MAX}</span>
        </div>
      </div>

      {/* --- Dankbarkeit ---------------------------------------------------- */}
      <div className="ck-ident-dankbar">
        <span className="ck-label">Dankbarkeit — drei Dinge</span>
        {dankbar.map((feld, i) => (
          <input
            key={feld}
            className="ck-input ck-ident-dankbar-zeile"
            type="text"
            inputMode="text"
            enterKeyHint="next"
            maxLength={160}
            placeholder={i === 0 ? 'Wofür bin ich heute dankbar?' : ''}
            aria-label={`Dankbarkeit ${i + 1}`}
            value={heute[feld] ?? ''}
            onChange={(ev) => setzen({ [feld]: ev.target.value } as Partial<CheckinRow>)}
            disabled={laedt}
          />
        ))}
      </div>
    </section>
  )
}
