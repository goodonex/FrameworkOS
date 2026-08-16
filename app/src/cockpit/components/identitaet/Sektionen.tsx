import type { ReactNode } from 'react'
import {
  ANTI_VISION,
  ANTI_VISION_GRUNDSATZ,
  JEDEN_TAG,
  NICHT_MEHR,
  STUFEN,
  VERHALTEN,
  WARUM,
} from '../../lib/identityInhalte'

/**
 * Das Nachschlagewerk unter dem Board: Verhaltens-Identität, Anti-Vision,
 * Warum.
 *
 * Die Map sagt selbst, wie sie benutzt wird: „Morgens nur die ☀️ Morgenlese
 * (2 Minuten). Der Rest ist Nachschlagewerk und wird gelesen, wenn gefühlt
 * werden muss, wohin das führt." Genau deshalb sind diese drei Bereiche
 * zugeklappt — sichtbar, aber nicht im Weg.
 *
 * Gebaut mit `<details>`/`<summary>`: das Aufklappen kann der Browser besser
 * als jeder eigene State — mit Tastatur, mit Vorleseprogramm und mit der
 * Seitensuche des Browsers (Strg+F findet auch zugeklappten Text).
 */

function Aufklapper({ titel, unterzeile, children }: { titel: string; unterzeile: string; children: ReactNode }) {
  return (
    <details className="ck-panel ck-ident-details">
      <summary className="ck-ident-summary">
        <span className="ck-ident-summary-text">
          <span className="ck-ident-summary-titel">{titel}</span>
          <span className="ck-ident-summary-unter">{unterzeile}</span>
        </span>
        <span className="ck-ident-chevron" aria-hidden>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="m8 10 4 4 4-4" />
          </svg>
        </span>
      </summary>
      <div className="ck-ident-details-inhalt">{children}</div>
    </details>
  )
}

export function IdentitaetSektionen() {
  return (
    <div className="ck-ident-sektionen">
      <Aufklapper titel="Verhaltens-Identität" unterzeile="Die Soll-Version von mir — Verhalten, keine Ziele">
        <ul className="ck-ident-liste">
          {VERHALTEN.map((v) => (
            <li key={v.auftakt}>
              <span className="ck-ident-liste-marke">{v.auftakt}:</span> {v.text}
            </li>
          ))}
        </ul>

        <span className="ck-label ck-ident-unter-label">Entscheidungen, die diese Person nicht mehr trifft</span>
        <ul className="ck-ident-liste ck-ident-liste--knapp">
          {NICHT_MEHR.map((z) => (
            <li key={z}>{z}</li>
          ))}
        </ul>

        <span className="ck-label ck-ident-unter-label">Entscheidungen, die diese Person jeden Tag trifft</span>
        <ul className="ck-ident-liste ck-ident-liste--knapp">
          {JEDEN_TAG.map((z) => (
            <li key={z}>{z}</li>
          ))}
        </ul>
      </Aufklapper>

      <Aufklapper titel="Anti-Vision" unterzeile="Was ich nicht mehr toleriere">
        <p className="ck-ident-zitat">„{ANTI_VISION_GRUNDSATZ}"</p>
        <ul className="ck-ident-liste">
          {ANTI_VISION.map((a) => (
            <li key={a.titel}>
              <span className="ck-ident-liste-marke">{a.titel}.</span> {a.text}
            </li>
          ))}
        </ul>
      </Aufklapper>

      <Aufklapper titel="Warum" unterzeile="Wofür das alles">
        <p className="ck-ident-warum-auftakt">{WARUM.auftakt}</p>
        <p className="ck-serif ck-ident-warum-kern">{WARUM.kern}</p>
        <ul className="ck-ident-liste">
          {WARUM.punkte.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="ck-ident-warum-schluss">{WARUM.schluss}</p>

        <span className="ck-label ck-ident-unter-label">Die Stufen</span>
        <div className="ck-ident-stufen">
          {STUFEN.map((s) => (
            <div key={s.stufe} className="ck-ident-stufe">
              <span className="ck-ident-stufe-name">{s.stufe}</span>
              <span className="ck-serif ck-zahl ck-ident-stufe-zahl">{s.netto}</span>
              <span className="ck-ident-stufe-text">{s.bedeutung}</span>
            </div>
          ))}
        </div>
      </Aufklapper>
    </div>
  )
}
