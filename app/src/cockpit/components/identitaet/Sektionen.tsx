import type { ReactNode } from 'react'
import { ACHT_SCHRITTE, HERO_STORY, LEHREN, REGELN, THEATER } from '../../lib/identityInhalte'
import { Spalte } from './Bausteine'

/**
 * Das Kapitel „Regeln & Lehren" — die neun Regeln offen, alles Weitere
 * zugeklappt.
 *
 * Die Map sagt selbst, wie sie benutzt wird: „Morgens nur die ☀️ Morgenlese
 * (2 Minuten). Der Rest ist Nachschlagewerk und wird gelesen, wenn gefühlt
 * werden muss, wohin das führt." Die Regeln sind kurz genug, um zu stehen;
 * Grundsätze, Lehren und die beiden Erzähltexte würden die Seite sonst in eine
 * Textwand verwandeln.
 *
 * Gebaut mit `<details>`/`<summary>`: das Aufklappen kann der Browser besser
 * als jeder eigene State — mit Tastatur, mit Vorleseprogramm und mit der
 * Seitensuche (Strg+F findet auch zugeklappten Text).
 */

export function Aufklapper({ titel, unterzeile, children }: { titel: string; unterzeile?: string; children: ReactNode }) {
  return (
    <details className="ck-ident-details">
      <summary className="ck-ident-summary">
        <span className="ck-ident-summary-zeichen" aria-hidden />
        <span className="ck-ident-summary-text">
          <span className="ck-ident-summary-titel">{titel}</span>
          {unterzeile ? <span className="ck-ident-summary-unter">{unterzeile}</span> : null}
        </span>
      </summary>
      <div className="ck-ident-details-inhalt">{children}</div>
    </details>
  )
}

export function RegelnUndLehren() {
  return (
    <div className="ck-ident-sektionen">
      {/* Die neun Regeln — durchnummeriert wie in der Vorlage, die
          Vertriebsregel im Akzent, weil sie den Tag entscheidet. */}
      <ol className="ck-ident-regeln">
        {REGELN.map((r, i) => (
          <li key={r.titel} className={r.betont ? 'ck-ident-regel--betont' : undefined}>
            <span className="ck-ident-regel-nr ck-zahl" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="ck-ident-regel-text">
              <b>{r.titel}</b> — {r.text}
            </span>
          </li>
        ))}
      </ol>

      <div className="ck-ident-pillen ck-ident-pillen--schritte">
        {ACHT_SCHRITTE.map((s) => (
          <span key={s} className="ck-ident-pille">
            {s}
          </span>
        ))}
      </div>

      <div className="ck-ident-aufklapper">
        <Aufklapper titel="Hero Story" unterzeile="Wo das hier angefangen hat">
          <p className="ck-ident-gross">{HERO_STORY.auftakt}</p>
          {HERO_STORY.absaetze.map((a) => (
            <p key={a} className="ck-ident-absatz">
              {a}
            </p>
          ))}
        </Aufklapper>

        <Aufklapper titel="Theater of the Mind" unterzeile="Der Tag, wie er sich anfühlen soll">
          <div className="ck-ident-zwei">
            <Spalte titel="Morgens">
              {THEATER.morgens.map((a) => (
                <p key={a} className="ck-ident-absatz">
                  {a}
                </p>
              ))}
            </Spalte>
            <Spalte titel="Abends">
              {THEATER.abends.map((a) => (
                <p key={a} className="ck-ident-absatz">
                  {a}
                </p>
              ))}
            </Spalte>
          </div>
        </Aufklapper>

        {LEHREN.map((block) => (
          <Aufklapper key={block.titel} titel={block.titel}>
            <ul className="ck-ident-liste">
              {block.absaetze.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Aufklapper>
        ))}
      </div>
    </div>
  )
}
