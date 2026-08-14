/**
 * Entdopplung der gespiegelten LinkedIn-Erstnachrichten (14.08.2026).
 *
 * Die Ursache lag nicht in der Oberfläche: Der Schlüssel der Tabelle aus 0060
 * war `(brand_id, gruppe, name)`, und der Runner spiegelt mit genau diesem
 * Konflikt-Ziel. Sobald Kevin im Vault eine GRUPPEN-ÜBERSCHRIFT umformuliert
 * ("Gruppe 1 — Erste Charge · 27 Kontakte (raus am 13.07., …)" →
 * "… (raus 13./14.07.)"), passt kein bestehender Datensatz mehr auf den
 * Konflikt — der Spiegel legt die ganze Gruppe ein zweites Mal an. Aus 118
 * Leads wurden so 145 Zeilen und 144 "offen".
 *
 * Migration 0071 zieht den Schlüssel auf `(brand_id, name)` und räumt die
 * Altlast auf. Diese Funktion ist der Gürtel zum Hosenträger: Sie hält die
 * Liste auch dann sauber, wenn die Migration noch nicht eingespielt ist oder
 * ein Spiegel-Lauf mit alter Historie dazwischenkommt.
 *
 * **Reine Funktion, keine React-Importe** — prüfbar per
 * `npx tsx scripts/verify-erstnachrichten-dedup.ts`.
 */

/** Das Minimum, das eine Zeile mitbringen muss, um entdoppelt zu werden. */
export interface EntdoppelbareZeile {
  id: string
  name: string
  status: 'offen' | 'gesendet' | 'uebersprungen'
  sent_at: string | null
  sort_index: number
  /** Aus 0060; ältere Spiegel-Stände können das Feld weglassen. */
  last_synced_at?: string | null
}

/** Namen vergleichbar machen — dieselbe Regel wie `funnelStufen.normName`. */
export function namensSchluessel(name: string | null | undefined): string {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Wie weit ist eine Zeile? Der weiteste Stand einer Person gewinnt. */
function fortschrittsRang(status: EntdoppelbareZeile['status']): number {
  if (status === 'gesendet') return 2
  if (status === 'uebersprungen') return 1
  return 0
}

function zeitwert(iso: string | null | undefined): number {
  const t = new Date(String(iso ?? '')).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Genau eine Zeile je Person.
 *
 * Es überlebt die zuletzt gespiegelte Zeile — sie trägt den aktuellen Text und
 * die aktuelle Gruppe. Der ABGEHAKTE Stand wird darauf übertragen: Wer einmal
 * als `gesendet` verbucht war, taucht nach einer Gruppen-Umbenennung nicht
 * wieder als offen auf. Genau diese Regel führt Migration 0071 auch in der
 * Datenbank aus, damit Oberfläche und Bestand dasselbe Ergebnis liefern.
 *
 * Die Reihenfolge der Eingabe bleibt erhalten (der Hook sortiert nach
 * `sort_index`).
 */
export function entdoppleErstnachrichten<T extends EntdoppelbareZeile>(zeilen: T[]): T[] {
  const gruppen = new Map<string, T[]>()
  const reihenfolge: string[] = []

  for (const z of zeilen) {
    const key = namensSchluessel(z.name) || `#${z.id}`
    const vorhanden = gruppen.get(key)
    if (vorhanden) vorhanden.push(z)
    else {
      gruppen.set(key, [z])
      reihenfolge.push(key)
    }
  }

  return reihenfolge.map((key) => {
    const kandidaten = gruppen.get(key) as T[]
    if (kandidaten.length === 1) return kandidaten[0]

    // Frischester Inhalt gewinnt die Zeile …
    const sieger = [...kandidaten].sort((a, b) => {
      const dz = zeitwert(b.last_synced_at) - zeitwert(a.last_synced_at)
      if (dz !== 0) return dz
      if (a.sort_index !== b.sort_index) return a.sort_index - b.sort_index
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })[0]

    // … der weiteste Fortschritt der Gruppe wird darauf übertragen.
    const weiteste = kandidaten.reduce((best, z) =>
      fortschrittsRang(z.status) > fortschrittsRang(best.status) ? z : best,
    )
    if (fortschrittsRang(weiteste.status) <= fortschrittsRang(sieger.status)) return sieger
    return { ...sieger, status: weiteste.status, sent_at: weiteste.sent_at ?? sieger.sent_at }
  })
}
