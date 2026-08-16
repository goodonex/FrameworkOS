import type { ReactNode } from 'react'
import { boardPfad } from '../../lib/visionboard'
import type { Kapitel } from '../../lib/identityInhalte'

/**
 * Die wiederkehrenden Bausteine der Identity-Seite.
 *
 * Alle drei stammen aus Kevins Design-Vorlage (`visionmap-2.0.html`, Fußzeile:
 * „Diese Seite ist die Design-Vorlage für das Identity OS in Uriel"):
 * Bild-Hero, Kapitel-Banner mit Bild und die zweispaltige Liste. Übersetzt in
 * die Cockpit-Tonart — die Vorlage arbeitet mit Gold auf Schwarz und
 * Monospace-Versalien, hier tragen `--ck-accent` (Salbei) und die
 * Serifen-Display-Schrift dieselbe Rolle. Farben und Schriften kommen
 * ausschließlich aus den eingefrorenen Tokens.
 *
 * **Scrim-Pflicht:** Über jedem Bild mit Text liegt ein Verlauf, der unten in
 * die Grundfläche ausläuft. Ohne ihn stünde heller Text auf hellen Bildstellen
 * — der Fehler, den das Foto-Band des Home-Heros schon einmal produziert hat.
 */

export function IdentHero({ bild, label, titel, unterzeile }: { bild: string; label: string; titel: string; unterzeile: string }) {
  return (
    <header className="ck-ident-hero">
      <img src={boardPfad(bild)} alt="" fetchPriority="high" decoding="async" />
      <div className="ck-ident-hero-scrim" />
      <div className="ck-ident-hero-inhalt">
        <span className="ck-label">{label}</span>
        <p className="ck-serif ck-ident-leitsatz">{titel}</p>
        <p className="ck-ident-leitsatz-folge">{unterzeile}</p>
      </div>
    </header>
  )
}

export function KapitelBanner({ kapitel }: { kapitel: Kapitel }) {
  return (
    <div className="ck-ident-banner" id={`kapitel-${kapitel.id}`}>
      <img src={boardPfad(kapitel.bild)} alt="" loading="lazy" decoding="async" />
      <div className="ck-ident-banner-scrim" />
      <h2 className="ck-serif ck-ident-banner-titel">{kapitel.titel}</h2>
    </div>
  )
}

/** Eine Spalte mit farbiger Oberkante — neutral, betont oder abgrenzend. */
export function Spalte({
  titel,
  art = 'neutral',
  children,
}: {
  titel: string
  art?: 'neutral' | 'akzent' | 'abgrenzung'
  children: ReactNode
}) {
  return (
    <div className={`ck-ident-spalte ck-ident-spalte--${art}`}>
      <h4 className="ck-ident-spalte-titel">{titel}</h4>
      {children}
    </div>
  )
}

export function Liste({ punkte }: { punkte: string[] }) {
  return (
    <ul className="ck-ident-liste">
      {punkte.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  )
}
