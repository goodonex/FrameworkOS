/**
 * runner/linkedin/entwuerfe.mjs — Entwürfe aus einem fertigen Agenten-Lauf an
 * die Threads schreiben (Etappe 3, Schritt 3).
 *
 * Ohne diesen Schritt lebte der Entwurf nur im Run-Markdown und wäre erst nach
 * einem Besuch in /freigaben sichtbar — genau der Bereichswechsel, den die
 * Klick-Ökonomie streicht. Der Runner schreibt ihn direkt an den Thread, damit
 * er morgens am Posten klebt und einen Reload übersteht.
 *
 * `parseDraftsRoh` ist die zweite Fassung von `parseDrafts`
 * (app/src/cockpit/lib/approvalDrafts.ts) — der Runner hat kein Cockpit zur
 * Hand. `npx tsx scripts/verify-entwuerfe.ts` prüft beide gegen dieselben
 * Eingaben; weicht eine ab, schlägt das Skript fehl.
 */

/**
 * Zieht die Entwürfe aus dem Run-Markdown: der LETZTE ```json-Block mit
 * `{ "drafts": [...] }`. Kaputt oder nicht vorhanden → leere Liste, nie ein Wurf.
 */
export function parseDraftsRoh(content) {
  if (!content) return []
  const blocks = [...String(content).matchAll(/```json\s*([\s\S]*?)```/g)]
  if (!blocks.length) return []
  let parsed
  try {
    parsed = JSON.parse(blocks[blocks.length - 1][1])
  } catch {
    return []
  }
  const arr = Array.isArray(parsed?.drafts) ? parsed.drafts : []
  const out = []
  for (const d of arr) {
    if (!d || typeof d !== 'object') continue
    const message = typeof d.message === 'string' ? d.message.trim() : ''
    if (!message) continue
    out.push({
      thread_key: typeof d.thread_key === 'string' && d.thread_key.trim() ? d.thread_key.trim() : null,
      contact_id: typeof d.contact_id === 'string' ? d.contact_id : '',
      name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : null,
      message,
    })
  }
  return out
}

/**
 * Schreibt je Entwurf eine Zeile fort. Bewusst PATCH je thread_key statt eines
 * Sammel-Upserts: die Zeilen existieren bereits, und ein Upsert würde bei einem
 * Tippfehler im thread_key stillschweigend eine halbe Geister-Zeile anlegen.
 *
 * Entwürfe ohne thread_key werden gezählt und übersprungen — sie gehören in die
 * Freigaben-Queue, aber an keinen Posten.
 */
export async function schreibeEntwuerfe({ supabaseUrl, headers, brandId, runId, drafts }) {
  const at = new Date().toISOString()
  let geschrieben = 0
  let ohneThread = 0
  let nichtGefunden = 0

  for (const d of drafts) {
    if (!d.thread_key) {
      ohneThread++
      continue
    }
    const res = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_threads?brand_id=eq.${brandId}` +
        `&thread_key=eq.${encodeURIComponent(d.thread_key)}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ entwurf: d.message, entwurf_at: at, entwurf_run_id: runId }),
      },
    )
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`Entwurf-PATCH HTTP ${res.status}: ${txt.slice(0, 200)}`)
    }
    const zeilen = await res.json()
    if (zeilen.length) geschrieben++
    else nichtGefunden++
  }

  return { geschrieben, ohneThread, nichtGefunden }
}
