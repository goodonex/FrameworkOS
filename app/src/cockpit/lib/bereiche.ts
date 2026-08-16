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
import type { BereichIconName } from '../components/BereichIcon'

export interface CockpitBereich {
  /** Routen-Präfix, zugleich Sprungziel. */
  path: string
  label: string
  /** Zusätzliche Suchbegriffe für die Palette. */
  keywords: string[]
  /**
   * Das Zeichen für Nav-Rail, Dock, Bibliothek und App-Grid (O18, Zug 1).
   * Vorher standen die Icons als Literale in `NavRail.tsx` — eine zweite
   * Bereichs-Wahrheit, sobald ein zweiter Ort Icons braucht.
   *
   * Seit Phase 2 (Zug A3) steht hier ein **Schlüssel**, kein Unicode-Zeichen:
   * gezeichnet wird in `components/BereichIcon.tsx`. Das erledigt zugleich die
   * alte O13-Falle — ein Inline-SVG kann iOS nicht als buntes Emoji rendern,
   * der Variation Selector-15 wird nicht mehr gebraucht.
   * `nurRoute`-Einträge tragen keins — sie sind kein Sprungziel.
   */
  icon?: BereichIconName
  /**
   * Nur Routen-Präfix, kein eigener Bereich (Redirect-Ziele). Taucht in der
   * Palette nicht auf, muss aber beim Background-Gate mitzählen.
   */
  nurRoute?: boolean
}

/** Ein Bereich, der als Kachel/Nav-Eintrag darstellbar ist — Icon garantiert. */
export type BereichMitIcon = CockpitBereich & { icon: BereichIconName }

export const COCKPIT_BEREICHE: CockpitBereich[] = [
  { path: '/cockpit', label: 'Cockpit', icon: 'home', keywords: ['home', 'start', 'übersicht', 'graph', 'heute-deck'] },
  { path: '/aufgaben', label: 'Aufgaben', icon: 'haken', keywords: ['todo', 'tasks', 'heute'] },
  { path: '/termine', label: 'Termine', icon: 'uhr', keywords: ['kalender', 'calls', 'buchungen'] },
  { path: '/freigaben', label: 'Freigaben', icon: 'eingang', keywords: ['entwürfe', 'approval', 'queue'] },
  { path: '/linkedin', label: 'LinkedIn', icon: 'postfach', keywords: ['postfach', 'threads', 'follow-up', 'dm'] },
  { path: '/sales', label: 'Sales', icon: 'liste', keywords: ['crm', 'pipeline', 'kontakte', 'leads', 'jetzt dran'] },
  { path: '/projekte', label: 'Projekte', icon: 'raute', keywords: ['kunden', 'deliver', 'lieferung'] },
  { path: '/ads', label: 'Ads', icon: 'megafon', keywords: ['werbung', 'kampagnen', 'meta'] },
  { path: '/content', label: 'Content', icon: 'bild', keywords: ['social', 'instagram', 'posts', 'batch'] },
  { path: '/agenten', label: 'Agenten', icon: 'agent', keywords: ['runs', 'automation', 'runner'] },
  { path: '/tracking', label: 'Tracking', icon: 'balken', keywords: ['kpi', 'zahlen', 'umsatz', 'ziele', 'vitals'] },
  {
    path: '/identitaet',
    label: 'Identität',
    icon: 'horizont',
    keywords: ['morgenlese', 'vision', 'visionboard', 'check-in', 'clean', 'streak', 'dankbarkeit', 'energie'],
  },
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
 * Der Zeichen-Schlüssel eines Bereichs. Fällt ein Pfad aus der Registry,
 * steht die neutrale Raute statt eines Absturzes — die Navigation ist zu
 * wichtig, um an einem fehlenden Zeichen zu scheitern.
 */
export function bereichIcon(path: string): BereichIconName {
  return ICON_JE_PFAD.get(path) ?? 'raute'
}
