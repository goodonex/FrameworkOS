import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { funnelStufen, type FunnelPerson, type NetzwerkEintrag } from '../../lib/funnelStufen'
import { runnerDirekt } from '../../lib/runnerBridge'
import { RUNNER_BASE_URL } from '../../lib/useRunnerStatus'
import type { Erstnachricht } from '../../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../../types/db'

/**
 * Der Trichter als fünf Kacheln (12.08.2026, seit 24.08. mit der Stufe
 * „Entscheider offen“ vor dem Loom).
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

/** „vor 2 Stunden" — wie frisch die Netzwerk-Zahlen sind. */
function frischeText(iso: string | null, jetzt: Date): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const min = Math.max(0, Math.round((jetzt.getTime() - t) / 60_000))
  if (min < 2) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const std = Math.round(min / 60)
  if (std < 24) return `vor ${std} Std.`
  const tage = Math.round(std / 24)
  return tage === 1 ? 'gestern' : `vor ${tage} Tagen`
}

export function FunnelStufen({
  netzwerk,
  threads,
  erstnachrichten,
  letzterVollerEinladungsLauf,
  netzwerkLaedt,
  onNeuLaden,
  jetzt = new Date(),
}: {
  netzwerk: NetzwerkEintrag[]
  threads: LinkedinThread[]
  erstnachrichten: Erstnachricht[]
  letzterVollerEinladungsLauf: string | null
  netzwerkLaedt: boolean
  /** Nach einem Sync die Tabelle neu lesen. */
  onNeuLaden: () => void
  jetzt?: Date
}) {
  const [offen, setOffen] = useState<string | null>(null)
  const [syncLaeuft, setSyncLaeuft] = useState(false)
  const [syncMeldung, setSyncMeldung] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  /**
   * Den Sync anstossen — und dann warten, ohne die Oberfläche zu blockieren.
   *
   * Der Lauf dauert rund fünf Minuten; der Runner antwortet deshalb sofort mit
   * „gestartet" und legt sein Ergebnis ab. Hier wird alle zwanzig Sekunden
   * nachgefragt, bis er durch ist — und dann die Tabelle neu gelesen, damit die
   * Kacheln die frischen Zahlen zeigen.
   */
  const starteSync = useCallback(async () => {
    if (syncLaeuft) return
    setSyncLaeuft(true)
    setSyncMeldung('Sync läuft — das dauert ein paar Minuten.')
    try {
      if (runnerDirekt()) {
        const res = await fetch(`${RUNNER_BASE_URL}/linkedin/netzwerk-sync`, { method: 'POST' })
        if (res.status === 409) {
          setSyncMeldung('Ein Sync läuft schon.')
        } else if (!res.ok) {
          setSyncMeldung(`Start fehlgeschlagen (HTTP ${res.status})`)
          setSyncLaeuft(false)
          return
        }
        // Nachfragen, bis der Runner fertig meldet.
        pollRef.current = window.setInterval(async () => {
          try {
            const s = await (await fetch(`${RUNNER_BASE_URL}/linkedin/netzwerk`)).json()
            if (s?.laeuft) return
            if (pollRef.current) window.clearInterval(pollRef.current)
            pollRef.current = null
            setSyncLaeuft(false)
            setSyncMeldung(s?.letztes?.fehler ? `Sync-Fehler: ${s.letztes.fehler}` : 'Netzwerk ist aktuell.')
            onNeuLaden()
          } catch {
            /* Runner kurz weg — beim nächsten Takt erneut */
          }
        }, 20_000)
      } else {
        /**
         * Am Handy nicht auslösbar — und das ist kein Versäumnis.
         *
         * Der Sync steuert einen Browser auf Kevins Mac; ohne laufenden Runner
         * gibt es nichts zu steuern. Der Weg über `runner_jobs` gäbe es zwar,
         * aber `beauftrageRunner` wartet höchstens fünf Minuten auf ein
         * Ergebnis — genau die Laufzeit dieses Syncs. Ein Knopf, der zuverlässig
         * in einen Timeout läuft, ist schlechter als eine klare Ansage.
         *
         * Gebraucht wird er hier ohnehin selten: die Tages-Routine im Runner
         * hält die Zahlen frisch, sobald der Mac läuft.
         */
        setSyncLaeuft(false)
        setSyncMeldung('Der Sync läuft nur am Mac. Vom Handy aus: der Runner holt das morgens von allein nach.')
      }
    } catch (e) {
      setSyncLaeuft(false)
      setSyncMeldung(e instanceof Error ? e.message : 'Sync fehlgeschlagen')
    }
  }, [onNeuLaden, syncLaeuft])

  const stufen = useMemo(
    () => funnelStufen({ netzwerk, threads, erstnachrichten, letzterVollerEinladungsLauf }, jetzt),
    [netzwerk, threads, erstnachrichten, letzterVollerEinladungsLauf, jetzt],
  )

  /** Ohne Netzwerk-Daten sind zwei der fünf Kacheln blind — das wird gesagt, nicht mit 0 kaschiert. */
  const netzwerkDa = netzwerk.length > 0
  const frische = frischeText(letzterVollerEinladungsLauf, jetzt)

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
      id: 'zustaendigkeit',
      titel: 'Zugesagt · Entscheider offen',
      hinweis: 'Wartet auf die Antwort, wer über die Website entscheidet.',
      personen: stufen.zustaendigkeit,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span className="ck-label">
          Trichter
          {/* Wie alt sind die Netzwerk-Zahlen? Ohne diese Angabe weiss niemand,
              ob 876 von heute früh oder von letzter Woche stammt. */}
          {!netzwerkLaedt && netzwerkDa && frische ? (
            <span style={{ color: 'var(--ck-text-3)' }}>{'\u00a0· Netzwerk '}{frische}</span>
          ) : null}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {netzwerkLaedt ? (
            <span className="ck-label">lädt…</span>
          ) : !netzwerkDa ? (
            <span className="ck-label" style={{ color: 'var(--ck-warn)' }}>
              Sync ausstehend
            </span>
          ) : null}
          <button type="button" className="ck-btn" onClick={() => void starteSync()} disabled={syncLaeuft}>
            {syncLaeuft ? 'Sync läuft…' : 'Netzwerk sync'}
          </button>
        </div>
      </div>

      {syncMeldung ? (
        <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ck-text-2)' }}>
          {syncMeldung}
        </div>
      ) : null}

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
