/** PostgREST / Supabase, wenn Migrationen noch nicht ausgeführt wurden. */
export function isMissingSupabaseTableError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist'))
  )
}

/**
 * Wenn Remote zwar erreichbar ist, aber Writes/Reads scheitern (fehlende Spalte,
 * Schema-Drift, RLS in Dev): dieselben Daten lokal in localStorage fortsetzen.
 */
export function shouldFallbackToLocalSupabase(message: string): boolean {
  if (!message) return false
  if (isMissingSupabaseTableError(message)) return true
  const m = message.toLowerCase()
  if (m.includes('schema cache')) return true
  if (m.includes('could not find') && m.includes('column')) return true
  if (m.includes('column') && m.includes('does not exist')) return true
  if (m.includes('42703')) return true /* undefined_column */
  if (m.includes('23503') || m.includes('foreign key')) return true
  if (m.includes('42501')) return true /* insufficient_privilege */
  if (m.includes('row-level security') || m.includes('violates row-level security')) return true
  if (m.includes('permission denied')) return true
  return false
}

/**
 * Transienter Fehler der Web-Locks-API (Supabase-Auth koordiniert den
 * Token-Refresh über `navigator.locks`). Bei mehreren offenen Tabs — oder im
 * Dev unter React StrictMode-Doppelmount — wird ein Lock „gestohlen", der
 * laufende Request bricht mit `AbortError: Lock was stolen by another request`
 * ab. Das ist NICHT fatal: der nächste Versuch hält den Lock und läuft durch.
 * Solche Fehler dürfen kein Diagnose-Banner auslösen, sondern werden erneut
 * versucht. Siehe https://github.com/supabase/supabase/issues/42505
 */
export function isTransientAuthLockError(message: string): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    (m.includes('lock') && (m.includes('stolen') || m.includes('was released'))) ||
    (m.includes('aborterror') && m.includes('lock')) ||
    m.includes('acquiring an exclusive navigator lockmanager')
  )
}

/**
 * Führt eine Supabase-Query aus und wiederholt sie, wenn sie an einem
 * transienten Auth-Lock-Fehler scheitert (gilt für zurückgegebene `error`s
 * UND für geworfene Rejections). Kleine Backoff-Pausen, danach gibt der letzte
 * Versuch sein Ergebnis unverändert zurück.
 */
export async function withAuthLockRetry<T extends { error: { message: string } | null }>(
  run: () => PromiseLike<T>,
  { retries = 3, delayMs = 120 }: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  let lastThrown: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await run()
      if (result.error && isTransientAuthLockError(result.error.message) && attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      return result
    } catch (err) {
      lastThrown = err
      if (isTransientAuthLockError(supabaseErrorMessage(err)) && attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw lastThrown
}

export function supabaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err ?? '')
}
