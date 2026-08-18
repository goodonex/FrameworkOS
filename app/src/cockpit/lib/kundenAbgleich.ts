import { personenSchluessel } from './erstnachrichtenOffen'

/**
 * Wer ist Kunde und gehört damit aus jeder Akquise-Liste heraus? (18.08.2026)
 *
 * Der Anlass steht in Kevins Satz: „Reichentrog ist mein ICP, aber auch schon
 * mein Kunde — und das hättest du vielleicht checken können." Norbert
 * Reichentrog stand in der Antworten-Spur wie ein frischer Lead, samt
 * vorbereitetem Antwort-Entwurf. Der Grund ist kein Denkfehler, sondern eine
 * fehlende Verbindung: `linkedin_threads` und `contacts` teilen keinen
 * Schlüssel — LinkedIn-IDs sind opak, ein URL-Abgleich greift nie.
 *
 * Also derselbe Weg wie beim Postfach-Abgleich: über den Namen
 * ({@link personenSchluessel}). Der Name stammt auf beiden Seiten aus
 * LinkedIn bzw. Kevins eigener Pflege, nicht aus Freitext.
 *
 * **Was als Kunde zählt:** ein gewonnener Kontakt (`won_at`) oder einer, der
 * in der Pipeline die Stufe `deal` erreicht hat. Beides heißt: Es läuft eine
 * Zusammenarbeit oder ein Abschluss — Akquise-Nachfassen wäre in beiden Fällen
 * peinlich.
 *
 * Firmen-Kontakte („Reichentrog & Kollegen GmbH") liefern über den
 * Personen-Schlüssel keinen brauchbaren Treffer und bleiben deshalb außen vor;
 * die zugehörigen Personen stehen ohnehin einzeln in `contacts`.
 */
export interface KundenKontakt {
  name: string
  pipeline_stage?: string | null
  won_at?: string | null
  contact_type?: string | null
}

export function kundenSchluessel(kontakte: KundenKontakt[]): Set<string> {
  const raus = new Set<string>()
  for (const k of kontakte) {
    if (k.contact_type === 'company') continue
    const istKunde = Boolean(k.won_at) || k.pipeline_stage === 'deal'
    if (!istKunde) continue
    const s = personenSchluessel(k.name)
    if (s) raus.add(s)
  }
  return raus
}

/** Steht dieser Thread-Name für einen bestehenden Kunden? */
export function istKunde(name: string | null | undefined, kunden: Set<string>): boolean {
  if (kunden.size === 0) return false
  const s = personenSchluessel(name)
  return s ? kunden.has(s) : false
}
