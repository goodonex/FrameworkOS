import { useCallback, useState } from 'react'
import type { Posten } from '../lib/prioritaet'
import type { ArbeitsmodusErgebnis } from './Arbeitsmodus'

/**
 * Aufklappbare Arbeitsliste für das Kachel-Fenster (Desktop-Arbeitsfluss):
 * alle Namen einer Spur untereinander, Klick auf den Namen klappt den Text
 * darunter auf, daneben Haken (erledigt), Kopieren (nur bei versandfertigem
 * Text) und bei Looms Skript öffnen/generieren.
 *
 * Kopieren gibt es bewusst NUR für Erstnachrichten — dort ist `text` eine
 * versandfertige Nachricht. Bei Aufgaben/Follow-ups/Antworten ist `text`
 * Kontext, kein Text zum Einfügen; ein Kopieren-Knopf wäre dort sinnlos.
 */

export interface LoomSkriptAktionen {
  /** URL des bereits generierten Skripts (Sales-Bibliothek), sonst null */
  skriptUrl: (p: Posten) => string | null
  generiere: (p: Posten) => void
  /** Agent `loom-skript` läuft gerade (Runner erlaubt nur einen gleichzeitig) */
  laeuft: boolean
  /** dieser Posten wurde in dieser Sitzung zum Generieren angestoßen */
  angefordert: (p: Posten) => boolean
  /** Runner erreichbar — sonst bleibt der Generieren-Knopf aus */
  verfuegbar: boolean
  /** Skript-Dateien liegen am Mac (Runner-Origin) — vom Handy aus nicht öffenbar */
  dateiOeffenbar: boolean
  /** letzter Fehler beim Generieren — wird direkt am Loom-Posten angezeigt */
  fehler: string | null
}

interface ArbeitslisteProps {
  posten: Posten[]
  onErledigt: (ergebnis: ArbeitsmodusErgebnis) => void
  loom?: LoomSkriptAktionen
  /** Route zum Projekt einer Kundenaufgabe (Spur `kundenaufgabe`), sonst null */
  projektLink?: (p: Posten) => string | null
  onNavigiere?: (route: string) => void
}

function linkLabel(url: string): string {
  try {
    const host = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname
    return host.includes('linkedin.com') ? 'LinkedIn-Profil' : host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function linkHref(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`
}

export function Arbeitsliste({ posten, onErledigt, loom, projektLink, onNavigiere }: ArbeitslisteProps) {
  const [offenId, setOffenId] = useState<string | null>(null)
  const [offenSeit, setOffenSeit] = useState(0)
  const [erledigt, setErledigt] = useState<Set<string>>(new Set())
  const [kopiertId, setKopiertId] = useState<string | null>(null)
  const [kopierGesperrt, setKopierGesperrt] = useState(false)

  const toggle = useCallback((id: string) => {
    setOffenId((prev) => (prev === id ? null : id))
    setOffenSeit(Date.now())
    setKopierGesperrt(false)
  }, [])

  const hake = useCallback(
    (p: Posten) => {
      if (erledigt.has(p.id)) return
      setErledigt((prev) => new Set(prev).add(p.id))
      // Dauer nur, wenn der Posten wirklich offen war — direkt weggehakte
      // Zeilen sind keine gemessene Arbeitszeit.
      const sekunden = offenId === p.id ? Math.max(0, Math.round((Date.now() - offenSeit) / 1000)) : 0
      onErledigt({ posten: p, sekunden })
    },
    [erledigt, offenId, offenSeit, onErledigt],
  )

  const kopiere = useCallback(async (p: Posten) => {
    try {
      await navigator.clipboard.writeText(p.text)
      setKopiertId(p.id)
      window.setTimeout(() => setKopiertId((prev) => (prev === p.id ? null : prev)), 2000)
    } catch {
      setKopierGesperrt(true)
    }
  }, [])

  if (posten.length === 0) {
    return <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>Nichts offen.</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {posten.map((p) => {
        const istOffen = offenId === p.id
        const istErledigt = erledigt.has(p.id)
        const kopierbar = p.spur === 'erstnachricht'
        const skriptUrl = p.spur === 'loom' ? (loom?.skriptUrl(p) ?? null) : null
        const projekt = p.spur === 'kundenaufgabe' ? (projektLink?.(p) ?? null) : null
        return (
          <div key={p.id} style={{ borderBottom: '1px solid var(--ck-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-expanded={istOffen}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 44,
                  padding: '8px 2px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: istErledigt ? 'var(--ck-text-3)' : 'var(--ck-text-1)',
                    textDecoration: istErledigt ? 'line-through' : 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </span>
                {p.firma && p.firma !== p.name ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--ck-text-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.firma}
                  </span>
                ) : null}
                {p.spur === 'loom' && skriptUrl ? (
                  <span style={{ fontSize: 11, color: 'var(--ck-accent)', flexShrink: 0 }}>Skript da</span>
                ) : null}
              </button>
              <button
                type="button"
                className="ck-btn"
                onClick={() => hake(p)}
                disabled={istErledigt}
                aria-label={`${p.name} als erledigt abhaken`}
                style={{
                  minHeight: 36,
                  minWidth: 44,
                  flexShrink: 0,
                  color: istErledigt ? 'var(--ck-accent)' : undefined,
                }}
              >
                ✓
              </button>
            </div>

            {istOffen ? (
              <div style={{ padding: '0 2px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.website ? (
                  <a
                    href={linkHref(p.website)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: 'var(--ck-accent)', textDecoration: 'none' }}
                  >
                    {linkLabel(p.website)} ↗
                  </a>
                ) : null}
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'var(--ck-text-2)',
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  {p.text}
                </div>
                {kopierGesperrt ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>
                    Zwischenablage gesperrt — Text markieren und kopieren.
                  </span>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {kopierbar ? (
                    <button
                      type="button"
                      className="ck-btn ck-btn--primary"
                      style={{ minHeight: 40 }}
                      onClick={() => void kopiere(p)}
                    >
                      {kopiertId === p.id ? '✓ Kopiert' : 'Nachricht kopieren'}
                    </button>
                  ) : null}
                  {p.spur === 'loom' && loom ? (
                    skriptUrl ? (
                      loom.dateiOeffenbar ? (
                        <a
                          className="ck-btn ck-btn--primary"
                          style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center' }}
                          href={skriptUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Skript öffnen ↗
                        </a>
                      ) : (
                        // Die Datei liegt beim Runner auf dem Mac — ein Link darauf
                        // wäre vom Handy aus tot. Ehrlicher Zustand statt toter Knopf.
                        <span style={{ fontSize: 13, color: 'var(--ck-accent)', alignSelf: 'center' }}>
                          Skript bereit — am Mac öffnen
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        className="ck-btn ck-btn--primary"
                        style={{ minHeight: 40 }}
                        disabled={!loom.verfuegbar || loom.laeuft}
                        onClick={() => loom.generiere(p)}
                      >
                        {loom.laeuft && loom.angefordert(p)
                          ? 'Skript wird generiert …'
                          : loom.verfuegbar
                            ? 'Skript generieren'
                            : 'Runner offline'}
                      </button>
                    )
                  ) : null}
                  {projekt && onNavigiere ? (
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 40 }}
                      onClick={() => onNavigiere(projekt)}
                    >
                      Ins Projekt
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ck-btn"
                    style={{ minHeight: 40 }}
                    disabled={istErledigt}
                    onClick={() => hake(p)}
                  >
                    {istErledigt ? '✓ Erledigt' : 'Erledigt'}
                  </button>
                </div>
                {p.spur === 'loom' && loom?.fehler ? (
                  <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{loom.fehler}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
