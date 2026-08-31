/**
 * runner/linkedin/erstnachrichtenEntwuerfe.mjs — was der Agent geschrieben hat,
 * in die Arbeitsliste legen (31.08.2026).
 *
 * Gegenstück zu `entwuerfe.mjs` (Antworten), nur ein anderes Ziel: Dort hängt
 * der Entwurf an einem Thread, hier entsteht eine Zeile in
 * `linkedin_erstnachrichten` — derselben Tabelle, die bisher nur der
 * `linkedin-leads`-Skill von Hand füllte.
 *
 * **Der Anlass steht in `scripts/erstnachrichten-input.ts`:** Kevins Kachel
 * meldete „0 von 0 ✓", während 508 Angenommene ohne Nachricht dastanden. Die
 * Kachel war ehrlich — der Topf war wirklich leer. Nur füllte ihn nichts.
 *
 * **Zwei Sorten Rückgabe, beide notwendig.** `nachrichten` sind Texte,
 * `uebersprungen` sind Menschen, die der Agent aussortiert hat (kein Makler,
 * Wettbewerber, Recruiter). Ohne die zweite Sorte stünde derselbe Fitness-Coach
 * jeden Morgen wieder oben, und jeder Lauf schriebe ihm einen neuen Text.
 */

/**
 * Den letzten ```json-Block aus der Agenten-Antwort lesen.
 *
 * Der letzte, nicht der erste: Agenten zeigen gern erst ein Beispiel und dann
 * das Ergebnis. Dieselbe Regel wie in `entwuerfe.mjs` — wer sie hier anders
 * baut, bekommt bei genau der Sorte Antwort ein anderes Ergebnis.
 */
export function parseErstnachrichtenRoh(content) {
  if (!content) return { nachrichten: [], uebersprungen: [] }
  const blocks = [...String(content).matchAll(/```json\s*([\s\S]*?)```/g)]
  if (!blocks.length) return { nachrichten: [], uebersprungen: [] }
  let parsed
  try {
    parsed = JSON.parse(blocks[blocks.length - 1][1])
  } catch {
    return { nachrichten: [], uebersprungen: [] }
  }

  const nachrichten = []
  for (const n of Array.isArray(parsed?.nachrichten) ? parsed.nachrichten : []) {
    if (!n || typeof n !== 'object') continue
    const text = typeof n.nachricht === 'string' ? n.nachricht.trim() : ''
    const key = typeof n.profil_key === 'string' ? n.profil_key.trim() : ''
    // Ohne Schlüssel ist der Text nicht zuordenbar, ohne Text gibt es nichts
    // zu verschicken — beides ist ein stiller Verlust, kein Fehler.
    if (!text || !key) continue
    nachrichten.push({
      profil_key: key,
      name: typeof n.name === 'string' ? n.name.trim() : '',
      firma: typeof n.firma === 'string' ? n.firma.trim() : '',
      website: typeof n.website === 'string' ? n.website.trim() : '',
      nachricht: text,
    })
  }

  const uebersprungen = []
  for (const u of Array.isArray(parsed?.uebersprungen) ? parsed.uebersprungen : []) {
    if (!u || typeof u !== 'object') continue
    const key = typeof u.profil_key === 'string' ? u.profil_key.trim() : ''
    if (!key) continue
    uebersprungen.push({
      profil_key: key,
      name: typeof u.name === 'string' ? u.name.trim() : '',
      // Der Grund ist Pflicht im Skill und steht hier, damit ein Fehlgriff
      // nachvollziehbar bleibt: „passt nicht" ist keine Begründung.
      grund: typeof u.grund === 'string' ? u.grund.trim().slice(0, 200) : '',
    })
  }

  return { nachrichten, uebersprungen }
}

/**
 * Schreiben — und zwar so, dass ein zweiter Lauf nichts kaputt macht.
 *
 * **Der Schlüssel ist `(brand_id, gruppe, name)`** (Migration 0071 hat ihn von
 * der wandernden Gruppen-Überschrift befreit; `gruppe` ist heute eine
 * mitlaufende Beschriftung). Deshalb schreibt dieser Lauf in eine feste Gruppe
 * und prüft VORHER, ob die Person schon eine Zeile hat: Kevins `status` und
 * `sent_at` dürfen unter keinen Umständen überschrieben werden — genau das war
 * der Fehler vom 14.08., als Roland Wettstein als frischer Lead wieder auftauchte.
 */
export async function schreibeErstnachrichten({
  supabaseUrl,
  headers,
  brandId,
  nachrichten,
  uebersprungen,
  gruppe = 'Von Uriel vorbereitet',
}) {
  const at = new Date().toISOString()
  let geschrieben = 0
  let uebersprungenGeschrieben = 0
  let schonDa = 0

  /** Wer schon eine Zeile hat — egal in welchem Status —, wird nicht angefasst. */
  const vorhanden = new Set()
  for (let off = 0; off < 20_000; off += 1000) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_erstnachrichten?brand_id=eq.${brandId}&select=name&limit=1000&offset=${off}`,
      { headers },
    )
    if (!res.ok) break
    const zeilen = await res.json()
    for (const z of zeilen) vorhanden.add(String(z.name ?? '').trim().toLowerCase())
    if (zeilen.length < 1000) break
  }

  const neu = []
  let sortIndex = Date.now() % 100_000

  for (const n of nachrichten) {
    if (vorhanden.has(n.name.toLowerCase())) {
      schonDa++
      continue
    }
    vorhanden.add(n.name.toLowerCase())
    neu.push({
      brand_id: brandId,
      gruppe,
      name: n.name,
      firma: n.firma,
      website: n.website,
      nachricht: n.nachricht,
      sort_index: sortIndex++,
      status: 'offen',
      quelle_datei: 'agent:linkedin-erstnachrichten',
      last_synced_at: at,
    })
    geschrieben++
  }

  for (const u of uebersprungen) {
    if (!u.name || vorhanden.has(u.name.toLowerCase())) {
      schonDa++
      continue
    }
    vorhanden.add(u.name.toLowerCase())
    neu.push({
      brand_id: brandId,
      gruppe,
      name: u.name,
      firma: '',
      website: '',
      // Der Grund steht im Textfeld, damit er in der Oberfläche sichtbar wird,
      // wenn Kevin die Aussortierten gegenliest.
      nachricht: `[übersprungen] ${u.grund}`,
      sort_index: sortIndex++,
      status: 'uebersprungen',
      quelle_datei: 'agent:linkedin-erstnachrichten',
      last_synced_at: at,
    })
    uebersprungenGeschrieben++
  }

  if (neu.length) {
    // Kein `merge-duplicates`: Es sind ausschliesslich Zeilen, die es noch
    // nicht gibt (oben geprüft). Ein Upsert würde bei einem Namensdreher
    // Kevins Fortschritt überschreiben.
    const res = await fetch(`${supabaseUrl}/rest/v1/linkedin_erstnachrichten`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(neu),
    })
    if (!res.ok) {
      throw new Error(`Erstnachrichten-INSERT HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
    }
  }

  return { geschrieben, uebersprungen: uebersprungenGeschrieben, schonDa }
}
