import { useState } from 'react'
import type { KartenLead } from '../../lib/funnelKarten'

/**
 * Wer steckt hinter der Zahl? (28.08.2026, Blaupause
 * `docs/wargames/sales-canvas-v2.md`, Zug 4.)
 *
 * **Warum es diese Liste gibt.** Bis zum 28.08. öffneten 6 der 20 Funnel-Karten
 * ein Fenster; die übrigen 14 — „Wartet auf Antwort", Instagram, Analyse-PDF,
 * Postkarte, Anruf, E-Mail, Wiedervorlage, Ruht, Kunde, Aussortiert, Nicht in
 * der Zielgruppe — zeigten eine Zahl und taten auf Klick nichts. Kevins
 * Auftrag: *„guck wirklich, jede Station — ist alles klickbar."*
 *
 * **Warum keine Arbeitsliste.** Für die stillen Kanäle gibt es die Daten schlicht
 * nicht: `Lead.email`, `telefon` und `anschrift` sind leer, ihre Beschaffung ist
 * eine eigene Runde. Ein Fenster mit „Kopieren"-Knopf über einer leeren
 * E-Mail-Adresse wäre ein Knopf, der nichts tut — schlimmer als gar keiner.
 * Diese Liste beantwortet die Frage, die die Karte aufwirft („wer sind die
 * 337?"), und führt von dort in die Lead-Akte, wo alles steht.
 *
 * **Die Zahl im Kopf IST die Zahl auf der Karte.** Beide kommen aus
 * `funnelZuordnung()` — einem Durchlauf, einer Zuordnung. Das hält
 * `scripts/verify-funnel-karten.ts` fest.
 */

/** Wie viele Namen auf einmal — der Rest kommt auf Knopfdruck. */
const SEITE = 150

export interface KartenNamenProps {
  leads: KartenLead[]
  /** Öffnet die Lead-Akte und schliesst dabei das Fenster. */
  onOeffneLead: (leadId: string) => void
  /**
   * Ein Satz über der Liste — wozu diese Station da ist. Nur wo er mehr sagt
   * als der Kartentitel; sonst ist er Füllmaterial.
   */
  hinweis?: string
}

/** „vor 12 Tagen" — oder nichts, wo es kein Datum gibt. */
function seit(iso: string | null, jetzt: number): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const tage = Math.round((jetzt - t) / 86_400_000)
  if (tage < 0) return `in ${Math.abs(tage)} Tagen`
  if (tage === 0) return 'heute'
  if (tage === 1) return 'gestern'
  if (tage < 60) return `vor ${tage} Tagen`
  return `vor ${Math.round(tage / 30)} Monaten`
}

export function KartenNamen({ leads, onOeffneLead, hinweis }: KartenNamenProps) {
  const [gezeigt, setGezeigt] = useState(SEITE)
  const jetzt = Date.now()
  const sichtbar = leads.slice(0, gezeigt)
  const rest = leads.length - sichtbar.length

  if (leads.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ck-text-3)', margin: 0 }}>Hier steckt gerade niemand.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {hinweis ? (
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ck-text-2)', margin: 0 }}>{hinweis}</p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sichtbar.map((l) => (
          <button
            key={l.leadId}
            type="button"
            onClick={() => onOeffneLead(l.leadId)}
            className="ck-panel"
            title={`${l.name} — ${l.naechsterSchritt}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              minHeight: 44,
              padding: '8px 12px',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--ck-text-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {l.name || 'Ohne Namen'}
              </span>
              {l.headline ? (
                <span
                  style={{
                    display: 'block',
                    fontSize: 11.5,
                    color: 'var(--ck-text-3)',
                    marginTop: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.headline}
                </span>
              ) : null}
            </span>
            {/* Rechts steht, wie lange das schon so ist — die Sortierung
                dieser Liste ist genau diese Zahl, also gehoert sie sichtbar
                daneben statt in einen Tooltip. */}
            <span
              className="ck-zahl"
              style={{
                fontSize: 11.5,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                color: l.faellig ? 'var(--ck-accent)' : 'var(--ck-text-3)',
              }}
            >
              {seit(l.faelligAm, jetzt) ?? 'ohne Datum'}
            </span>
          </button>
        ))}
      </div>

      {/**
       * Gedeckelt wird sichtbar, nie still. 337 Knöpfe in einem Fenster, das
       * gerade aus einer Karte morpht, ruckeln — aber „hier sind 150" ohne den
       * Hinweis, dass es 337 sind, wäre die teurere Lüge.
       */}
      {rest > 0 ? (
        <button
          type="button"
          className="ck-btn"
          style={{ alignSelf: 'flex-start', minHeight: 40 }}
          onClick={() => setGezeigt((n) => n + SEITE)}
        >
          {rest} weitere zeigen
        </button>
      ) : null}
      <p style={{ fontSize: 11.5, color: 'var(--ck-text-3)', margin: 0 }}>
        {leads.length === sichtbar.length
          ? `${leads.length} insgesamt · Klick öffnet die Lead-Akte`
          : `${sichtbar.length} von ${leads.length} · älteste zuerst`}
      </p>
    </div>
  )
}
