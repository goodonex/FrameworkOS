import { useMemo, useState } from 'react'
import {
  KADENZ_FELDER,
  KADENZ_STANDARD,
  gueltigeKadenz,
  type Kadenz,
} from '../../lib/kadenz'
import { funnelKarten, type FunnelEingabe } from '../../lib/funnelKarten'

/**
 * Die Wartezeiten justieren (25.08.2026, Pipeline-Board Zug 5).
 *
 * **Die Vorschau ist nicht Komfort, sie ist der eigentliche Schutz.** An
 * `bucketOf` hängt jede Fälligkeit im Cockpit. Stellt Kevin sonntagabends die
 * erste Follow-up-Schwelle von 3 auf 1, hat er montags 600 fällige
 * Follow-ups — und merkt es erst vor der Liste. Deshalb rechnet dieses Feld
 * die Folge, **bevor** gespeichert wird: „heute fällig: 163 → 412 (+249)".
 * Kevin sieht die Zahl, solange die Änderung noch reversibel ist.
 *
 * Gerechnet wird mit derselben `funnelKarten()`, die auch die Anzeige speist —
 * nur gegen eine probeweise Kadenz. Kein zweiter Rechenweg.
 */

export interface KadenzPanelProps {
  /** Der gespeicherte Stand. */
  kadenz: Kadenz
  /** Speichern — erst nach dem Blick auf die Vorschau. */
  onSpeichern: (neu: Kadenz) => void
  /**
   * Alles, was `funnelKarten` braucht, ausser der Kadenz selbst. Kommt vom
   * Aufrufer, der die Leads ohnehin geladen hat — eine zweite Abfrage nur für
   * die Vorschau wäre Verschwendung.
   */
  basis: Omit<FunnelEingabe, 'kadenz'>
}

/** Wie viele Leads sind mit dieser Kadenz heute fällig? */
function faelligMit(basis: Omit<FunnelEingabe, 'kadenz'>, kadenz: Kadenz): number {
  return funnelKarten({ ...basis, kadenz }).reduce((n, k) => n + k.heuteFaellig, 0)
}

export function KadenzPanel({ kadenz, onSpeichern, basis }: KadenzPanelProps) {
  const [entwurf, setEntwurf] = useState<Kadenz>(kadenz)

  const jetztFaellig = useMemo(() => faelligMit(basis, kadenz), [basis, kadenz])
  /**
   * Die Vorschau rechnet über alle 1.788 Leads. Sie hängt an `entwurf`, nicht
   * an einem Tastendruck — React rechnet sie erst, wenn der Wert wirklich
   * anders ist, und der Zahlenknopf liefert pro Änderung genau einen neuen
   * Wert. Ein Schieber mit `onInput` bräuchte hier `useDebouncedCallback`.
   */
  const dannFaellig = useMemo(() => faelligMit(basis, entwurf), [basis, entwurf])

  const veraendert = JSON.stringify(entwurf) !== JSON.stringify(kadenz)
  const differenz = dannFaellig - jetztFaellig

  const setzeFeld = (schluessel: keyof Kadenz, wert: number) => {
    // Durch `gueltigeKadenz`, nicht roh: Auch ein Tippfehler im Zahlenfeld darf
    // die Vorschau nicht auf NaN stellen.
    setEntwurf(gueltigeKadenz({ ...entwurf, [schluessel]: wert }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Die Vorschau steht OBEN, nicht unten: Sie ist der Grund, warum es
          dieses Feld gibt, und muss im Blick sein, während man schiebt. */}
      <div
        style={{
          border: `1px solid ${veraendert ? 'var(--ck-accent)' : 'var(--ck-border-strong)'}`,
          borderRadius: 'var(--ck-radius-innen)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <span className="ck-label">Heute fällig</span>
        <span className="ck-zahl" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)' }}>
          {veraendert ? (
            <>
              {jetztFaellig} → {dannFaellig}{' '}
              <span style={{ color: differenz > 0 ? 'var(--ck-warn)' : 'var(--ck-accent)', fontSize: 14 }}>
                ({differenz > 0 ? '+' : ''}
                {differenz})
              </span>
            </>
          ) : (
            jetztFaellig
          )}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--ck-text-3)' }}>
          {veraendert
            ? 'So sähe es aus, wenn du speicherst. Noch ist nichts geändert.'
            : 'Ändere einen Wert, um die Folge zu sehen — bevor sie eintritt.'}
        </span>
      </div>

      {/* Die drei Follow-up-Schwellen: ein Tripel, keine drei Einzelwerte. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="ck-label">Follow-ups nach … Tagen</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {entwurf.followupTage.map((tag, i) => (
            <input
              key={i}
              type="number"
              className="ck-input"
              min={1}
              max={365}
              value={tag}
              onChange={(e) => {
                const naechste = [...entwurf.followupTage] as [number, number, number]
                naechste[i] = Number(e.target.value)
                // Nicht aufsteigend heisst: `gueltigeKadenz` setzt das ganze
                // Tripel zurück. Das ist gewollt — [14, 7, 3] liesse die Stufen
                // gegeneinander laufen.
                setEntwurf(gueltigeKadenz({ ...entwurf, followupTage: naechste }))
              }}
              style={{ width: 76, minHeight: 40 }}
              aria-label={`Follow-up ${i + 1} nach Tagen`}
            />
          ))}
          <span style={{ fontSize: 11.5, color: 'var(--ck-text-3)' }}>müssen aufsteigend sein</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {KADENZ_FELDER.map((feld) => (
          <label
            key={feld.schluessel}
            style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}
            title={feld.hinweis}
          >
            <span style={{ flex: 1, fontSize: 13, color: 'var(--ck-text-2)' }}>{feld.titel}</span>
            <input
              type="number"
              className="ck-input"
              min={feld.min}
              max={feld.max}
              value={entwurf[feld.schluessel]}
              onChange={(e) => setzeFeld(feld.schluessel, Number(e.target.value))}
              style={{ width: 76, minHeight: 40 }}
            />
            <span style={{ fontSize: 11.5, color: 'var(--ck-text-3)', width: 46 }}>{feld.einheit}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ck-btn ck-btn--primary"
          style={{ minHeight: 44 }}
          disabled={!veraendert}
          onClick={() => onSpeichern(entwurf)}
        >
          Speichern
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ minHeight: 44 }}
          disabled={!veraendert}
          onClick={() => setEntwurf(kadenz)}
        >
          Verwerfen
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ minHeight: 44, marginLeft: 'auto' }}
          onClick={() => setEntwurf(KADENZ_STANDARD)}
        >
          Auf Standard
        </button>
      </div>
    </div>
  )
}
