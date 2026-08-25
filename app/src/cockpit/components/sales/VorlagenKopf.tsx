import { useCallback, useState } from 'react'
import { inZwischenablage } from '../../lib/zwischenablage'

/**
 * Der Textbaustein einer Funnel-Stufe — **einmal oben im Fenster, nicht je Lead.**
 *
 * Das ist die eigentliche Neuerung des Canvas gegenüber der alten Zeile: Seit
 * die Follow-up-Texte fest sind (`followupVorlagen.ts`, 25.08.2026), gibt es
 * für eine Stufe genau einen Text. Ihn an jeden der 177 Namen zu hängen, war
 * nur nötig, solange ein Agent ihn individuell schrieb.
 *
 * `[Vorname]` bleibt sichtbar stehen. Ersetzen wäre hier eine Lüge: Der Text
 * gehört der Stufe, nicht einem Menschen. Den Namen liefert die Liste darunter
 * separat — Klick auf den Namen legt ihn in die Zwischenablage, danach hier
 * den Text. Die Reihenfolge ist Kevins Handgriff: erst suchen, dann einfügen.
 */
export function VorlagenKopf({ text }: { text: string }) {
  const [kopiert, setKopiert] = useState(false)
  const [gesperrt, setGesperrt] = useState(false)

  const kopiere = useCallback(async () => {
    if (!(await inZwischenablage(text))) {
      setGesperrt(true)
      return
    }
    setGesperrt(false)
    setKopiert(true)
    window.setTimeout(() => setKopiert(false), 2000)
  }, [text])

  return (
    <div
      style={{
        border: '1px solid var(--ck-border-strong)',
        borderRadius: 'var(--ck-radius-innen)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>
          Text dieser Stufe
        </span>
        <button type="button" className="ck-btn" style={{ minHeight: 40, flexShrink: 0 }} onClick={() => void kopiere()}>
          {kopiert ? '✓ Kopiert' : 'Text kopieren'}
        </button>
      </div>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--ck-text-1)',
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {text}
      </div>
      {gesperrt ? (
        <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>
          Zwischenablage gesperrt — Text markieren und kopieren.
        </span>
      ) : null}
      <span style={{ fontSize: 11.5, color: 'var(--ck-text-3)' }}>
        [Vorname] bleibt stehen — Klick auf einen Namen unten legt ihn in die Zwischenablage.
      </span>
    </div>
  )
}
