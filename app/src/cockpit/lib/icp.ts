import REGELN from './icpRegeln.json'

/**
 * Der ICP-Filter als Code (18.08.2026).
 *
 * **Warum es ihn gab und trotzdem nicht gab.** Der ICP steht seit Monaten im
 * Skill `linkedin-leads` (Schritt 3) — aber nur als Text, den ein Mensch oder
 * Claude beim Durchgehen anwendet. Im System existierte er nicht: `isIcpContact`
 * in `linkedinFollowups.ts` prüft, ob ein LinkedIn-Link gesetzt ist, sonst
 * nichts. Folge, die Kevin am 18.08. fand: In der Antworten-Zeile standen 52
 * Leute, davon über die Hälfte Coaches, KI-Anbieter und Recruiter, die IHN
 * akquirieren wollten — und der Nacht-Agent schrieb für 30 davon Entwürfe
 * („Hi Angelique, wonach bist du auf der Suche in der Gründerkommune?").
 * Kevins Urteil: „Das ist doch absolute Token-Verschwendung."
 *
 * **Die Richtung des Fehlers ist bewusst gewählt.** Beurteilt wird die
 * LinkedIn-Headline — ein Text, den Leute frei formulieren. Ein fälschlich
 * aussortierter Makler ist ein verlorener Kunde; ein fälschlich behaltener
 * Coach kostet einen Blick. Deshalb gibt es `unklar` als eigenes Urteil, und
 * `unklar` wird wie ICP behandelt: angezeigt und mit Entwurf versorgt.
 * Weggeräumt wird nur, was ein Off-Signal wirklich trägt.
 *
 * Die Wortlisten stehen in `icpRegeln.json` — dieselbe Datei liest der Runner
 * (`runner/linkedin/icp.mjs`), damit Anzeige und Agent nie auseinanderlaufen.
 */

export type IcpUrteil = 'kern' | 'rand' | 'unklar' | 'off'

const KERN: string[] = REGELN.kern
const RAND: string[] = REGELN.rand
const OFF: string[] = REGELN.off
const HART_OFF: string[] = REGELN.hart_off

/** Kleinschreibung + Akzente weg, damit „Immobilienmakler" und „IMMOBILIEN" gleich zählen. */
function normalisiere(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function trifft(text: string, liste: string[]): string | null {
  for (const wort of liste) {
    if (text.includes(normalisiere(wort))) return wort
  }
  return null
}

export interface IcpBefund {
  urteil: IcpUrteil
  /** Das Wort, das entschieden hat — für die Begründung an der Zeile. */
  grund: string | null
}

/**
 * Beurteilt eine Person anhand ihrer LinkedIn-Headline.
 *
 * Reihenfolge der Prüfung: erst Off, dann Kern, dann Rand. Off zuerst, weil
 * genau die Wettbewerber sich Makler-Vokabular ins Profil schreiben — ein
 * „Coach für Immobilienmakler" trägt beide Signale und ist trotzdem kein Kunde,
 * sondern Konkurrenz (so steht es im Skill).
 *
 * **Ausnahme davon:** Wer sich selbst als Makler oder Maklerbüro bezeichnet,
 * bleibt drin, auch wenn irgendwo „Berater" oder „Vertrieb" in der Zeile steht.
 * Ohne diese Klammer fielen echte Makler mit einem beliebten Zusatz heraus.
 */
export function icpUrteil(headline: string | null | undefined, name?: string | null): IcpBefund {
  const text = normalisiere(`${headline ?? ''} ${name ?? ''}`)
  if (!text.trim()) return { urteil: 'unklar', grund: null }

  // Wettbewerb zuerst: „Coaching für Immobilienmakler" trägt beide Signale und
  // ist trotzdem kein Kunde (Skill: „Makler-Coaches = Wettbewerb"). Diese Worte
  // schlagen deshalb auch die Makler-Klammer darunter.
  const hart = trifft(text, HART_OFF)
  if (hart) return { urteil: 'off', grund: hart }

  const kern = trifft(text, KERN)
  const off = trifft(text, OFF)

  // Eindeutige Berufsbezeichnung schlägt ein weiches Off-Wort im selben Satz.
  const nenntSichMakler = /immobilienmakler|maklerbuero|makler \||\| makler|immobilienberater/.test(text)
  if (off && !nenntSichMakler) return { urteil: 'off', grund: off }
  if (kern) return { urteil: 'kern', grund: kern }

  const rand = trifft(text, RAND)
  if (rand) return { urteil: 'rand', grund: rand }

  // Keine Anhaltspunkte in beide Richtungen: sichtbar lassen, nicht wegwerfen.
  return { urteil: 'unklar', grund: null }
}

/** Gehört die Person in Kevins Arbeitsvorrat? `unklar` zählt bewusst dazu. */
export function istArbeitsVorrat(urteil: IcpUrteil): boolean {
  return urteil !== 'off'
}
