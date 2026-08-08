/**
 * Die Bereiche der Cockpit-Shell — EINE Liste (Etappe 4, Schritt 1).
 *
 * Vorher stand die Wahrheit zweimal im Code: `COCKPIT_PREFIXES` in App.tsx
 * (für die Background-Abschaltung) und eine handgepflegte Auswahl in der
 * CommandPalette, die nur 4 von 11 Bereichen kannte. Wer einen Bereich
 * ergänzt, pflegt jetzt genau hier — beide Seiten ziehen nach.
 *
 * Reihenfolge = Reihenfolge in der Palette: Warteschlange vorn,
 * Nachschlagewerk hinten (Leitprinzip Klick-Ökonomie).
 */
export interface CockpitBereich {
  /** Routen-Präfix, zugleich Sprungziel. */
  path: string
  label: string
  /** Zusätzliche Suchbegriffe für die Palette. */
  keywords: string[]
  /**
   * Das Zeichen für Nav-Rail, Bottom-Bar, Bibliothek und App-Grid (O18, Zug 1).
   * Vorher standen die Icons als Literale in `NavRail.tsx` — eine zweite
   * Bereichs-Wahrheit, sobald ein zweiter Ort Icons braucht.
   *
   * **Regel für neue Zeichen (Lehre O13):** nur Geometric Shapes (U+25A0–U+25FF)
   * oder ein Zeichen mit angehängtem `︎` (Variation Selector-15). Ohne den
   * rendert iOS Zeichen mit Emoji-Default (☑, ⚙) als buntes Emoji.
   * `nurRoute`-Einträge tragen keins — sie sind kein Sprungziel.
   */
  icon?: string
  /**
   * Nur Routen-Präfix, kein eigener Bereich (Redirect-Ziele). Taucht in der
   * Palette nicht auf, muss aber beim Background-Gate mitzählen.
   */
  nurRoute?: boolean
}

/** Ein Bereich, der als Kachel/Nav-Eintrag darstellbar ist — Icon garantiert. */
export type BereichMitIcon = CockpitBereich & { icon: string }

export const COCKPIT_BEREICHE: CockpitBereich[] = [
  { path: '/cockpit', label: 'Cockpit', icon: '◉', keywords: ['home', 'start', 'übersicht', 'graph', 'heute-deck'] },
  { path: '/aufgaben', label: 'Aufgaben', icon: '☑︎', keywords: ['todo', 'tasks', 'heute'] },
  { path: '/termine', label: 'Termine', icon: '◷', keywords: ['kalender', 'calls', 'buchungen'] },
  { path: '/freigaben', label: 'Freigaben', icon: '◫', keywords: ['entwürfe', 'approval', 'queue'] },
  { path: '/linkedin', label: 'LinkedIn', icon: '▣', keywords: ['postfach', 'threads', 'follow-up', 'dm'] },
  { path: '/sales', label: 'Sales', icon: '▤', keywords: ['crm', 'pipeline', 'kontakte', 'leads', 'jetzt dran'] },
  { path: '/projekte', label: 'Projekte', icon: '◈', keywords: ['kunden', 'deliver', 'lieferung'] },
  { path: '/ads', label: 'Ads', icon: '◨', keywords: ['werbung', 'kampagnen', 'meta'] },
  { path: '/content', label: 'Content', icon: '◐', keywords: ['social', 'instagram', 'posts', 'batch'] },
  { path: '/agenten', label: 'Agenten', icon: '⚙︎', keywords: ['runs', 'automation', 'runner'] },
  { path: '/tracking', label: 'Tracking', icon: '▦', keywords: ['kpi', 'zahlen', 'umsatz', 'ziele', 'vitals'] },
  // Redirect auf /sales — als Bereich gäbe es ihn zweimal in der Liste.
  { path: '/crm', label: 'CRM', keywords: [], nurRoute: true },
]

/** Routen-Präfixe der Cockpit-Shell (App.tsx: Background-Gate). */
export const COCKPIT_PREFIXES: string[] = COCKPIT_BEREICHE.map((b) => b.path)

/** Bereiche, die als Sprungziel in der Command-Palette stehen. */
export const PALETTEN_BEREICHE: BereichMitIcon[] = COCKPIT_BEREICHE.filter(
  (b): b is BereichMitIcon => !b.nurRoute && Boolean(b.icon),
)

const ICON_JE_PFAD = new Map(COCKPIT_BEREICHE.map((b) => [b.path, b.icon]))

/**
 * Das Zeichen eines Bereichs. Fällt ein Pfad aus der Registry, steht ein
 * neutrales ◇ statt eines Absturzes — die Navigation ist zu wichtig, um an
 * einem fehlenden Zeichen zu scheitern.
 */
export function bereichIcon(path: string): string {
  return ICON_JE_PFAD.get(path) ?? '◇'
}
