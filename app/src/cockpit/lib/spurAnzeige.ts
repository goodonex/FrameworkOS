import type { Spur } from './prioritaet'

/**
 * Anzeige-Zuordnungen für die Spuren. Liegen hier statt im SalesDashboard,
 * seit das Heute-Deck dieselben Posten zeigt und ins zuständige Kachel-Fenster
 * springt — zwei Fassungen dieser Tabellen würden sofort auseinanderlaufen.
 */

export const SPUR_LABEL: Record<Spur, string> = {
  kundenaufgabe: 'Kundenaufgabe',
  kunde_liegt: 'Projekt liegt',
  antwort: 'Antwort',
  loom: 'Loom',
  erstnachricht: 'Erstnachricht',
  followup: 'Follow-up',
  anfrage: 'Anfrage',
  inmail: 'InMail',
}

/** Welche Sales-Kachel eine Spur bearbeitet — Ziel von `/sales?kachel=…`. */
export const KACHEL_JE_SPUR: Record<Spur, string> = {
  kundenaufgabe: 'kundenarbeit',
  kunde_liegt: 'liegt-zu-lange',
  antwort: 'antworten',
  loom: 'looms',
  erstnachricht: 'erstnachrichten',
  followup: 'followups',
  anfrage: 'vernetzungsanfragen',
  inmail: 'inmails',
}
