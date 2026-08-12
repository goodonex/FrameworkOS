import { useMemo, useState } from 'react'
import { funnelStufen, type FunnelPerson, type NetzwerkEintrag } from '../../lib/funnelStufen'
import type { Erstnachricht } from '../../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../../types/db'

/**
 * Der Trichter als vier Kacheln (12.08.2026).
 *
 * Kevins Frage war: „wie viele Vernetzungsanfragen sind noch offen, wer wartet
 * auf Antwort, auf ein Loom, wer hat nie angenommen." Genau diese vier Zahlen
 * stehen hier — und hinter jeder die Namen, denn eine Zahl ohne Namen ist keine
 * Arbeitsliste.
 *
 * **Eigene Komponente, nicht in `LinkedinArea` hineingebaut.** Die Bucket-UI
 * dort ist gewachsen und funktioniert; sie anzufassen, um eine Sektion
 * daneben zu stellen, wäre ein unnötiges Risiko.
 *
 * Gerechnet wird nichts hier — das macht `funnelStufen.ts`.
 */

interface Kachel {
  id: string
  titel: string
  /** Eine Zeile, die sagt, was zu tun ist. */
  hinweis: string
  personen: FunnelPerson[]
  /** Warnton statt Akzent — für den Rückstau, der Geld kostet. */
  dringend?: boolean
}

function tageText(p: FunnelPerson): string {
  if (p.tage === null) return ''
  if (p.tage === 0) return 'heute'
  if (p.tage === 1) return 'seit 1 Tag'
  if (p.tage < 14) return `seit ${p.tage} Tagen`
  if (p.tage < 60) return `seit ${Math.floor(p.tage / 7)} Wochen`
  return `seit ${Math.floor(p.tage / 30)} Monaten`
}

export function FunnelStufen({
  netzwerk,
  threads,
  erstnachrichten,
  letzterVollerEinladungsLauf,
  netzwerkLaedt,
  jetzt = new Date(),
}: {
  netzwerk: NetzwerkEintrag[]
  threads: LinkedinThread[]
  erstnachrichten: Erstnachricht[]
  letzterVollerEinladungsLauf: string | null
  netzwerkLaedt: boolean
  jetzt?: Date
}) {
  const [offen, setOffen] = useState<string | null>(null)

  const stufen = useMemo(
    () => funnelStufen({ netzwerk, threads, erstnachrichten, letzterVollerEinladungsLauf }, jetzt),
    [netzwerk, threads, erstnachrichten, letzterVollerEinladungsLauf, jetzt],
  )

  /** Ohne Netzwerk-Daten sind zwei der vier Kacheln blind — das wird gesagt, nicht mit 0 kaschiert. */
  const netzwerkDa = netzwerk.length > 0

  const kacheln: Kachel[] = [
    {
      id: 'angenommen',
      titel: 'Angenommen · ohne Nachricht',
      hinweis: 'Haben Ja gesagt und warten auf den ersten Satz.',
      personen: stufen.angenommenOffen,
    },
    {
      id: 'ohne-antwort',
      titel: 'Angeschrieben · keine Antwort',
      hinweis: `${stufen.ohneAntwortErst.length} noch nie nachgefasst · ${stufen.ohneAntwortNachgefasst.length} schon`,
      personen: [...stufen.ohneAntwortErst, ...stufen.ohneAntwortNachgefasst],
    },
    {
      id: 'loom',
      titel: 'Loom zugesagt',
      hinweis: 'Analyse versprochen, noch nicht verschickt.',
      personen: stufen.loomOffen,
      dringend: stufen.loomOffen.length > 0,
    },
    {
      id: 'inmail',
      titel: 'Nie angenommen · InMail',
      hinweis: 'Einladung liegt, keine Reaktion.',
      personen: stufen.inmail,
    },
  ]

  const offeneKachel = kacheln.find((k) => k.id === offen) ?? null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="ck-label">Trichter</span>
        {netzwerkLaedt ? (
          <span className="ck-label">lädt…</span>
        ) : !netzwerkDa ? (
          <span className="ck-label" style={{ color: 'var(--ck-warn)' }}>
            Netzwerk-Sync ausstehend
          </span>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {kacheln.map((k) => {
          // Die beiden Netzwerk-Kacheln zeigen ohne Sync keine 0, sondern einen
          // Strich: „noch nicht gemessen" und „keiner offen" sind verschiedene
          // Aussagen, und die falsche davon beruhigt.
          const blind = !netzwerkDa && (k.id === 'angenommen' || k.id === 'inmail')
          return (
            <button
              key={k.id}
              type="button"
              className="ck-panel"
              onClick={() => setOffen(k.id)}
              disabled={blind}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                padding: '12px 13px',
                textAlign: 'left',
                cursor: blind ? 'default' : 'pointer',
                minHeight: 76,
                opacity: blind ? 0.55 : 1,
              }}
            >
              <span
                className="ck-zahl"
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: k.dringend ? 'var(--ck-warn)' : 'var(--ck-text-1)',
                }}
              >
                {blind ? '—' : k.personen.length}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-text-2)', lineHeight: 1.3 }}>
                {k.titel}
              </span>
            </button>
          )
        })}
      </div>

      {offeneKachel ? (
        <NamensListe kachel={offeneKachel} onClose={() => setOffen(null)} />
      ) : null}
    </section>
  )
}

/** Die Namen hinter einer Zahl. Kachel → Fenster → Liste, wie überall im Cockpit. */
function NamensListe({ kachel, onClose }: { kachel: Kachel; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label={kachel.titel}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--ck-backdrop)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        // `#app-ui-overlay` setzt global pointer-events: none — ohne das hier
        // reagiert im Fenster kein einziger Knopf (die Falle vom 08.07.).
        pointerEvents: 'auto',
      }}
    >
      <div
        className="ck-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '14px 14px calc(14px + env(safe-area-inset-bottom))',
          overflow: 'hidden',
          // Deckend, nicht die halbtransparente Karte: das Fenster liegt über
          // dem Backdrop, und die Kacheln darunter schienen sonst durch die
          // Namen hindurch.
          background: 'var(--ck-panel)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{kachel.titel}</div>
            <div className="ck-label" style={{ marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>
              {kachel.hinweis}
            </div>
          </div>
          <button type="button" className="ck-btn" onClick={onClose} style={{ flexShrink: 0 }}>
            Fertig
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {kachel.personen.length === 0 ? (
            <p className="ck-label" style={{ padding: '14px 2px' }}>
              Niemand — hier ist gerade nichts offen.
            </p>
          ) : (
            kachel.personen.map((p) => (
              <a
                key={p.key}
                href={p.profileUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 2px',
                  borderBottom: '1px solid var(--ck-border)',
                  color: 'inherit',
                  textDecoration: 'none',
                  minHeight: 44,
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {p.name}
                    {p.pruefen ? (
                      <span className="ck-label" style={{ marginLeft: 6, color: 'var(--ck-warn)' }}>
                        prüfen
                      </span>
                    ) : null}
                  </span>
                  {p.info ? (
                    <span
                      className="ck-label"
                      style={{
                        textTransform: 'none',
                        letterSpacing: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.info}
                    </span>
                  ) : null}
                </span>
                <span className="ck-label" style={{ flexShrink: 0 }}>
                  {tageText(p)}
                </span>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
