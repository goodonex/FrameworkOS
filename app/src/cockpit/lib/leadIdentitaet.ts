/**
 * Wer ist dieselbe Person? — die Identitäts-Schicht des Lead-Systems (0076).
 *
 * **Der Befund, der die Regeln bestimmt hat (20.08.2026, an Prod gemessen).**
 * LinkedIn gibt zwei Sorten IDs aus, und sie überschneiden sich nicht:
 *
 * - Einladungs-/Kontaktliste → lesbarer Slug: `anton-bachhaeubl-45a96920b`
 * - Postfach                 → opake ID:      `ACoAACAUWC4BuMVJg4jiN3by3fe0AOX7y9uz4Fw`
 *
 * Ein URL-Abgleich zwischen beiden Welten traf in **0 von 239** Threads. Der
 * naheliegende „erst URL, dann Name"-Ansatz wäre also in der Praxis immer beim
 * Namen gelandet — nur mit dem falschen Gefühl, sicher zu sein. Gemessen trägt
 * der Name: 230 von 239 Threads finden genau eine Netzwerk-Zeile, 2 sind
 * mehrdeutig, 7 haben gar keine (Leute, die Kevin von sich aus geschrieben
 * haben — die bekommen einen eigenen Lead, das ist richtig so).
 *
 * Deshalb: **`li_urn` ist kein Suchschlüssel, sondern ein Gedächtnis.** Ist ein
 * Thread einmal einem Lead zugeordnet — automatisch über den Namen oder von
 * Kevin per Hand —, wird die opake ID am Lead festgeschrieben. Ab dann trifft
 * Regel 1 direkt, und keine Namensänderung (Heirat, Titel, Emoji im Profil)
 * kann die Verbindung mehr zerreißen.
 *
 * Reine Funktionen, keine React- oder Netzwerk-Importe — prüfbar per
 * `npx tsx scripts/verify-lead-identitaet.ts`.
 */

/** Das Minimum, das ein Lead-Kandidat für den Abgleich mitbringen muss. */
export interface LeadKandidat {
  id: string
  name: string
  profil_key: string
  li_urn: string
}

export type TrefferGrund = 'li_urn' | 'profil_key' | 'name' | 'kein_treffer' | 'mehrdeutig'

export interface Treffer {
  /** Die getroffene Lead-id, oder null wenn keine eindeutige Zuordnung möglich war. */
  leadId: string | null
  grund: TrefferGrund
  /**
   * Bei `mehrdeutig`: die Kandidaten, zwischen denen nicht zu entscheiden war.
   * Die Oberfläche zeigt sie zur Handverbindung — still einen zu wählen wäre
   * schlimmer als zu fragen.
   */
  kandidaten?: string[]
}

/**
 * Namen vergleichbar machen: Kleinschreibung, Umlaute zerlegt, alles außer
 * Buchstaben und Leerzeichen raus. „Dr. Katja Frontzkowski" und
 * „dr katja frontzkowski" sind damit derselbe Schlüssel — Titel bleiben
 * bewusst drin, weil sie in beiden Quellen gleich mitgeführt werden.
 */
export function normName(wert: string | null | undefined): string {
  return String(wert ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Den identifizierenden Teil einer LinkedIn-Profil-URL herausziehen — egal ob
 * lesbarer Slug oder opake ID, egal ob mit Query, Anker oder Schrägstrich am
 * Ende. Gibt '' zurück, wenn nichts Brauchbares drinsteht.
 */
export function urlKern(wert: string | null | undefined): string {
  const treffer = String(wert ?? '').match(/\/in\/([^/?#]+)/i)
  if (!treffer) return ''
  try {
    return decodeURIComponent(treffer[1]).toLowerCase()
  } catch {
    return treffer[1].toLowerCase()
  }
}

/**
 * Eine opake Postfach-ID erkennt man am `ACoAA`-Präfix. Nur solche IDs gehören
 * nach `li_urn` — ein lesbarer Slug gehört nach `profil_key`, sonst stünde
 * dieselbe Person unter zwei Schlüsseln und die Teil-Unique-Indizes würden sie
 * für zwei Leute halten.
 */
export function istOpakeId(kern: string): boolean {
  return /^acoaa/i.test(kern)
}

/** Der Suchindex über alle bekannten Leads. Einmal bauen, oft fragen. */
export interface LeadIndex {
  nachUrn: Map<string, LeadKandidat>
  nachProfilKey: Map<string, LeadKandidat>
  nachName: Map<string, LeadKandidat[]>
}

export function baueIndex(leads: LeadKandidat[]): LeadIndex {
  const nachUrn = new Map<string, LeadKandidat>()
  const nachProfilKey = new Map<string, LeadKandidat>()
  const nachName = new Map<string, LeadKandidat[]>()

  for (const lead of leads) {
    if (lead.li_urn) nachUrn.set(lead.li_urn.toLowerCase(), lead)
    if (lead.profil_key) nachProfilKey.set(lead.profil_key.toLowerCase(), lead)
    const schluessel = normName(lead.name)
    if (!schluessel) continue
    const liste = nachName.get(schluessel)
    if (liste) liste.push(lead)
    else nachName.set(schluessel, [lead])
  }

  return { nachUrn, nachProfilKey, nachName }
}

/**
 * Die Zuordnung selbst, in der Reihenfolge ihrer Verlässlichkeit:
 *
 * 1. **`li_urn`** — die festgeschriebene Postfach-Identität. Kann nicht lügen.
 * 2. **`profil_key`** — der Netzwerk-Slug. Ebenfalls eindeutig.
 * 3. **Name, genau ein Kandidat** — die Brücke zwischen beiden Welten.
 * 4. **Name, mehrere Kandidaten** → `mehrdeutig`, niemand wird gewählt.
 * 5. sonst → `kein_treffer`, der Aufrufer legt einen neuen Lead an.
 */
export function findeLead(
  index: LeadIndex,
  quelle: { name?: string | null; profileUrl?: string | null; profilKey?: string | null },
): Treffer {
  const kern = urlKern(quelle.profileUrl)

  if (kern && istOpakeId(kern)) {
    const treffer = index.nachUrn.get(kern)
    if (treffer) return { leadId: treffer.id, grund: 'li_urn' }
  }

  const schluessel = (quelle.profilKey || (kern && !istOpakeId(kern) ? kern : '')).toLowerCase()
  if (schluessel) {
    const treffer = index.nachProfilKey.get(schluessel)
    if (treffer) return { leadId: treffer.id, grund: 'profil_key' }
  }

  const namensSchluessel = normName(quelle.name)
  if (namensSchluessel) {
    const kandidaten = index.nachName.get(namensSchluessel)
    if (kandidaten?.length === 1) return { leadId: kandidaten[0].id, grund: 'name' }
    if (kandidaten && kandidaten.length > 1) {
      return { leadId: null, grund: 'mehrdeutig', kandidaten: kandidaten.map((k) => k.id) }
    }
  }

  return { leadId: null, grund: 'kein_treffer' }
}
