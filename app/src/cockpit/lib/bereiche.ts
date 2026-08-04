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
   * Nur Routen-Präfix, kein eigener Bereich (Redirect-Ziele). Taucht in der
   * Palette nicht auf, muss aber beim Background-Gate mitzählen.
   */
  nurRoute?: boolean
}

export const COCKPIT_BEREICHE: CockpitBereich[] = [
  { path: '/cockpit', label: 'Cockpit', keywords: ['home', 'start', 'übersicht', 'graph', 'heute-deck'] },
  { path: '/aufgaben', label: 'Aufgaben', keywords: ['todo', 'tasks', 'heute'] },
  { path: '/termine', label: 'Termine', keywords: ['kalender', 'calls', 'buchungen'] },
  { path: '/freigaben', label: 'Freigaben', keywords: ['entwürfe', 'approval', 'queue'] },
  { path: '/linkedin', label: 'LinkedIn', keywords: ['postfach', 'threads', 'follow-up', 'dm'] },
  { path: '/sales', label: 'Sales', keywords: ['crm', 'pipeline', 'kontakte', 'leads', 'jetzt dran'] },
  { path: '/projekte', label: 'Projekte', keywords: ['kunden', 'deliver', 'lieferung'] },
  { path: '/ads', label: 'Ads', keywords: ['werbung', 'kampagnen', 'meta'] },
  { path: '/content', label: 'Content', keywords: ['social', 'instagram', 'posts', 'batch'] },
  { path: '/agenten', label: 'Agenten', keywords: ['runs', 'automation', 'runner'] },
  { path: '/tracking', label: 'Tracking', keywords: ['kpi', 'zahlen', 'umsatz', 'ziele', 'vitals'] },
  // Redirect auf /sales — als Bereich gäbe es ihn zweimal in der Liste.
  { path: '/crm', label: 'CRM', keywords: [], nurRoute: true },
]

/** Routen-Präfixe der Cockpit-Shell (App.tsx: Background-Gate). */
export const COCKPIT_PREFIXES: string[] = COCKPIT_BEREICHE.map((b) => b.path)

/** Bereiche, die als Sprungziel in der Command-Palette stehen. */
export const PALETTEN_BEREICHE: CockpitBereich[] = COCKPIT_BEREICHE.filter((b) => !b.nurRoute)
