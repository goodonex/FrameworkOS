/**
 * Die Zeichen der Cockpit-Bereiche als Inline-SVG (Phase 2, Zug A3).
 *
 * Vorher standen hier Unicode-Geometrieformen (◉ ☑︎ ◷ …) mit einer eigenen
 * Regel gegen bunte Emoji auf iOS (Variation Selector-15, O13). Der Mock
 * zeichnet stattdessen einen Linien-Satz: `stroke-width: 1.7`, runde Enden,
 * keine Flächen. Damit fällt die Emoji-Falle weg — ein SVG rendert überall
 * gleich —, und die Zeichen können `currentColor` erben, also den
 * Aktiv-Zustand der Navigation mitgehen.
 *
 * Arbeitsteilung: WELCHE Bereiche es gibt und WELCHES Zeichen sie tragen,
 * steht weiter in `lib/bereiche.ts` (eine Registry). Wie das Zeichen
 * AUSSIEHT, steht nur hier. Ein Schlüssel verbindet beide.
 */

export type BereichIconName =
  | 'home'
  | 'haken'
  | 'uhr'
  | 'eingang'
  | 'postfach'
  | 'liste'
  | 'raute'
  | 'megafon'
  | 'bild'
  | 'agent'
  | 'balken'
  | 'mehr'

/** Die Pfade. Ein Eintrag = ein Zeichen, gezeichnet auf 24×24. */
const PFADE: Record<BereichIconName, React.ReactNode> = {
  // Cockpit — Haus (aus dem Mock übernommen)
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-7.5Z" />,
  // Aufgaben/Heute — Haken im Feld (aus dem Mock)
  haken: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  // Termine — Uhr
  uhr: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // Freigaben — Posteingang
  eingang: (
    <>
      <path d="M4 13.5 6.6 6a1 1 0 0 1 .95-.7h8.9a1 1 0 0 1 .95.7L20 13.5V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4.5Z" />
      <path d="M4 13.5h4l1.3 2.2h5.4l1.3-2.2h4" />
    </>
  ),
  // LinkedIn — Postfach als Sprechblase
  postfach: <path d="M20 14.5a2 2 0 0 1-2 2H9l-4 3.2V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8.5Z" />,
  // Sales — Liste (aus dem Mock)
  liste: <path d="M4 6h16M4 12h16M4 18h10" />,
  // Projekte — Raute (aus dem Mock)
  raute: <path d="m12 3 8 9-8 9-8-9 8-9Z" />,
  // Ads — Megafon
  megafon: (
    <>
      <path d="M4 10.5v3a1 1 0 0 0 1 1h2l6 4V5.5l-6 4H5a1 1 0 0 0-1 1Z" />
      <path d="M17.5 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  // Content — Bild
  bild: (
    <>
      <rect x="4" y="5.5" width="16" height="13" rx="3" />
      <path d="m4.6 15.8 3.9-3.4 3.4 2.9 2.9-2.4 4.6 3.6" />
    </>
  ),
  // Agenten — laufender Kern mit Strahlen
  agent: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.4 6.4l1.6 1.6M16 16l1.6 1.6M17.6 6.4 16 8M8 16l-1.6 1.6" />
    </>
  ),
  // Tracking — Balken
  balken: <path d="M4 20h16M7.5 20v-6M12 20V7M16.5 20v-9" />,
  // Mehr — drei Punkte (aus dem Mock)
  mehr: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
}

/**
 * Ein Bereichs-Zeichen. Die Farbe kommt IMMER von außen (`currentColor`) —
 * so färbt der Aktiv-Zustand der Navigation das Zeichen mit, ohne dass hier
 * eine zweite Farbregel entsteht.
 */
export function BereichIcon({ name, size = 21 }: { name: BereichIconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {PFADE[name] ?? PFADE.raute}
    </svg>
  )
}
