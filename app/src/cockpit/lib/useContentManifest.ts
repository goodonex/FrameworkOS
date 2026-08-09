import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../../components/Toast'
import type {
  ContentChannel,
  ContentFormat,
  ContentManifest,
  ContentStatus,
} from './contentApi'
import { fetchContentManifest, markiereGepostet, putContentManifest } from './contentApi'

const PUT_DEBOUNCE_MS = 600

/**
 * Manifest-Hook für die Content-Post-Ebene: optimistische Mutationen im State,
 * debounced PUT an den Runner. 409 (extern geändert, z.B. Claude-Session)
 * → Disk-Stand übernehmen + Toast. Refetch bei Window-Focus. 1:1 aus useAdManifest
 * übernommen — die Konfliktlösung wird bewusst nicht neu erfunden.
 */
export function useContentManifest(brand: string | undefined) {
  const { show } = useToast()
  const [manifest, setManifest] = useState<ContentManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // baseUpdatedAt = Disk-Stand, auf dem der aktuelle State basiert (Konflikt-Guard).
  const baseUpdatedAt = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<ContentManifest | null>(null)
  const inFlight = useRef(false)
  const brandRef = useRef(brand)
  brandRef.current = brand

  const adopt = useCallback((m: ContentManifest) => {
    baseUpdatedAt.current = m.updatedAt ?? null
    setManifest(m)
  }, [])

  const reload = useCallback(async (reset = false) => {
    if (!brandRef.current) return
    // Niemals über ungespeicherte oder gerade fliegende Änderungen drüberladen —
    // sonst ersetzt ein Refetch den State mit dem alten Disk-Stand, während der
    // PUT noch unterwegs ist, und der nächste Save schreibt den Rückstand fest.
    if (pending.current || inFlight.current) return
    if (reset) {
      setLoading(true)
      setManifest(null)
    }
    try {
      adopt(await fetchContentManifest(brandRef.current))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [adopt])

  const flush = useCallback(async () => {
    const m = pending.current
    const b = brandRef.current
    if (!m || !b) return
    pending.current = null
    inFlight.current = true
    try {
      const { updatedAt } = await putContentManifest(b, m, baseUpdatedAt.current)
      baseUpdatedAt.current = updatedAt
      // Disk entspricht jetzt exakt m — State darauf heilen, falls ihn
      // zwischenzeitlich etwas anderes (z.B. ein Refetch) ersetzt hat.
      setManifest((cur) => (pending.current ? cur : m))
    } catch (e) {
      const err = e as Error & { status?: number; body?: { current?: ContentManifest } }
      if (err.status === 409 && err.body?.current) {
        adopt(err.body.current)
        show('Manifest wurde extern geändert — Stand neu geladen.', 'error')
      } else {
        show(`Speichern fehlgeschlagen: ${err.message}`, 'error')
      }
    } finally {
      inFlight.current = false
    }
  }, [adopt, show])

  /** Optimistisch mutieren + debounced persistieren. */
  const mutate = useCallback(
    (fn: (m: ContentManifest) => ContentManifest) => {
      setManifest((cur) => {
        if (!cur) return cur
        const next = fn(cur)
        pending.current = next
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), PUT_DEBOUNCE_MS)
        return next
      })
    },
    [flush],
  )

  useEffect(() => {
    void reload(true)
  }, [reload, brand])

  // Claude-Edits an content.json sollen beim Zurück-Tabben sichtbar werden —
  // reload() selbst schützt sich vor ungespeicherten/fliegenden Änderungen.
  useEffect(() => {
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  // Ausstehende Änderungen beim Unmount/Tab-Schließen noch rausschreiben.
  useEffect(() => {
    const onUnload = () => void flush()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      if (timer.current) clearTimeout(timer.current)
      void flush()
    }
  }, [flush])

  const updatePost = useCallback(
    (postId: string, patch: (p: ContentManifest['posts'][number]) => ContentManifest['posts'][number]) => {
      mutate((m) => ({
        ...m,
        posts: m.posts.map((p) => (p.id === postId ? patch(p) : p)),
      }))
    },
    [mutate],
  )

  const setStatus = useCallback(
    (postId: string, status: ContentStatus) => updatePost(postId, (p) => ({ ...p, status })),
    [updatePost],
  )

  const toggleDone = useCallback(
    (postId: string) => updatePost(postId, (p) => ({ ...p, done: !p.done })),
    [updatePost],
  )

  const setPlannedFor = useCallback(
    (postId: string, plannedFor: string | undefined) =>
      updatePost(postId, (p) => ({ ...p, plannedFor: plannedFor || undefined })),
    [updatePost],
  )

  const setChannel = useCallback(
    (postId: string, channel: ContentChannel) => updatePost(postId, (p) => ({ ...p, channel })),
    [updatePost],
  )

  const setFormat = useCallback(
    (postId: string, format: ContentFormat) => updatePost(postId, (p) => ({ ...p, format })),
    [updatePost],
  )

  const addNote = useCallback(
    (postId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      updatePost(postId, (p) => ({
        ...p,
        notes: [...(p.notes ?? []), { at: new Date().toISOString(), text: trimmed }],
      }))
    },
    [updatePost],
  )

  /**
   * „Als gepostet markieren" geht NICHT über den PUT-Weg: der Runner ist der
   * Schreiber (D5), er kennt den Disk-Stand und setzt nur dieses eine Feld.
   * Danach frisch laden — sonst zeigt die App ihren alten Stand weiter.
   */
  const markierePostGepostet = useCallback(
    async (ziel: { postId: string } | { week: string }) => {
      const b = brandRef.current
      if (!b) return
      try {
        const { getroffen } = await markiereGepostet(b, ziel)
        await reload()
        show(
          getroffen > 0
            ? `${getroffen} Post${getroffen === 1 ? '' : 's'} als gepostet markiert.`
            : 'Nichts zu markieren — war schon gepostet.',
          'success',
        )
      } catch (e) {
        const err = e as Error & { status?: number }
        show(
          err.status === 409
            ? 'Der Content-Batch läuft gerade — gleich nochmal.'
            : 'Runner nicht erreichbar — am Rechner markieren.',
          'error',
        )
      }
    },
    [reload, show],
  )

  return {
    manifest,
    loading,
    error,
    reload,
    markierePostGepostet,
    setStatus,
    toggleDone,
    setPlannedFor,
    setChannel,
    setFormat,
    addNote,
  }
}
