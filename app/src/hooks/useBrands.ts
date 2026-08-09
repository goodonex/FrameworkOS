import { useCallback, useEffect, useRef, useState } from 'react'
import type { Brand } from '../types/db'
import { BRAND_FOUNDATION_SEEDS } from '../data/brandFoundationSeeds'
import {
  isMissingSupabaseTableError,
  isTransientAuthLockError,
  withAuthLockRetry,
} from '../lib/supabaseErrors'
import { isLocalFallbackBrandId } from '../lib/brandResolve'
import {
  seedFoundationLocalStorage,
  seedFoundationSupabase,
} from '../lib/seedBrandFoundation'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DEFAULT_BRANDS: Omit<Brand, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Herrmann & Co.', slug: 'herrmann', color: '#3B6FE8' },
  { name: 'Wertavio', slug: 'wertavio', color: '#B8902A' },
  { name: 'Culturefit', slug: 'culturefit', color: '#DC4628' },
  { name: 'Eversmell', slug: 'eversmell', color: '#D4A843' },
  { name: 'Homeflower', slug: 'homeflower', color: '#2D7A4F' },
]

/** Wenn die DB-Migrationen noch nicht laufen: gleiche Slugs wie später in Supabase, damit Navigation stimmt. */
const FALLBACK_BRANDS: Brand[] = [
  {
    id: 'local-fallback-herrmann',
    user_id: null,
    name: 'Herrmann & Co.',
    slug: 'herrmann',
    color: '#3B6FE8',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-wertavio',
    user_id: null,
    name: 'Wertavio',
    slug: 'wertavio',
    color: '#B8902A',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-culturefit',
    user_id: null,
    name: 'Culturefit',
    slug: 'culturefit',
    color: '#DC4628',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-eversmell',
    user_id: null,
    name: 'Eversmell',
    slug: 'eversmell',
    color: '#D4A843',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-homeflower',
    user_id: null,
    name: 'Homeflower',
    slug: 'homeflower',
    color: '#2D7A4F',
    created_at: new Date().toISOString(),
  },
]

interface UseBrandsResult {
  brands: Brand[]
  loading: boolean
  error: string | null
  /** Explizit neu laden (z. B. nach Seed). */
  reload: () => Promise<void>
}

function mapBrand(row: {
  id: string
  user_id: string | null
  name: string
  slug: string
  color: string | null
  created_at: string
}): Brand {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    slug: row.slug,
    color: row.color ?? '',
    created_at: row.created_at,
  }
}

/** Header + 3D-Nodes: Homeflower zuletzt (rechts); unbekannte Slugs ans Ende. */
const BRAND_DISPLAY_ORDER = [
  'herrmann',
  'wertavio',
  'culturefit',
  'eversmell',
  'homeflower',
] as const

function sortBrandsForDisplay(brands: Brand[]): Brand[] {
  const rank = (slug: string) => {
    const i = (BRAND_DISPLAY_ORDER as readonly string[]).indexOf(slug)
    return i === -1 ? 999 : i
  }
  return [...brands].sort(
    (a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name),
  )
}

/**
 * Bestehende Supabase-Zeilen an die aktuellen Default-Slugs anpassen (einmal pro Reload, wenn nötig).
 * Damit wirken Änderungen an DEFAULT_BRANDS auch, wenn die Tabelle schon ältere Seeds hat.
 */
/**
 * Schreiboperationen (Seed + Canonical-Sync) laufen einmal pro User und
 * SESSION — nicht einmal pro Hook-Instanz. Vorher feuerten 5+ parallele
 * useBrands()-Instanzen dieselben INSERTs gleichzeitig (409-Kaskade
 * gegen Supabase bei jedem App-Load).
 */
const canonicalSyncPromiseByUser = new Map<string, Promise<boolean>>()
const defaultSeedAttemptedByUser = new Set<string>()

async function syncCanonicalBrandsForUser(
  userId: string,
  rows: Array<{
    id: string
    user_id: string | null
    name: string
    slug: string
    color: string | null
    created_at: string
  }>,
): Promise<boolean> {
  if (!supabase) return false

  const mine = rows.filter((r) => r.user_id === userId)
  const bySlug = (slug: string) => mine.find((r) => r.slug === slug)
  const syncColorBySlug: Record<string, string> = {
    herrmann: '#3B6FE8',
    wertavio: '#B8902A',
    culturefit: '#DC4628',
    homeflower: '#2D7A4F',
    eversmell: '#D4A843',
  }

  let changed = false

  const offmarket = bySlug('offmarketbude')
  const wertavio = bySlug('wertavio')

  if (offmarket && !wertavio) {
    const { error } = await supabase
      .from('brands')
      .update({
        name: 'Wertavio',
        slug: 'wertavio',
        color: '#B8902A',
      })
      .eq('id', offmarket.id)
      .eq('user_id', userId)
    if (!error) changed = true
  }

  const eversmell = bySlug('eversmell')
  const culturefit = bySlug('culturefit')
  if (!culturefit) {
    const { error } = await supabase.from('brands').insert({
      user_id: userId,
      name: 'Culturefit',
      slug: 'culturefit',
      color: '#DC4628',
    })
    if (!error) changed = true
    else if (
      !error.message.includes('duplicate') &&
      !error.message.includes('unique')
    ) {
      console.warn('[useBrands] Culturefit einfügen:', error.message)
    }
  }

  if (!eversmell) {
    const { error } = await supabase.from('brands').insert({
      user_id: userId,
      name: 'Eversmell',
      slug: 'eversmell',
      color: '#D4A843',
    })
    if (!error) changed = true
    else if (
      !error.message.includes('duplicate') &&
      !error.message.includes('unique')
    ) {
      console.warn('[useBrands] Eversmell einfügen:', error.message)
    }
  }

  for (const row of mine) {
    const canonical = syncColorBySlug[row.slug]
    if (!canonical) continue
    if (row.color === canonical) continue
    const { error } = await supabase
      .from('brands')
      .update({ color: canonical })
      .eq('id', row.id)
      .eq('user_id', userId)
    if (!error) changed = true
  }

  return changed
}

export function useBrands(): UseBrandsResult {
  const { user } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seedAttemptedRef = useRef(false)
  /**
   * Hat der letzte `reload()` die Brands wirklich GELESEN? „Keine Brands" und
   * „nicht nachgesehen" sahen bisher gleich aus — beides `brands.length === 0`
   * bei `loading === false`. Genau das ließ den Seed nach einem transienten
   * Auth-Lock-Fehler (viele Tabs) losfeuern und bei jedem Laden ein
   * `duplicate key … brands_slug_key` in die Konsole schreiben, obwohl fünf
   * Brands existieren. Geseedet wird nur noch nach einem geglückten Lesen.
   */
  const ladErfolgRef = useRef(false)
  const foundationSeedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const seed of BRAND_FOUNDATION_SEEDS) {
      seedFoundationLocalStorage(seed)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      foundationSeedRef.current = new Set()
      return
    }
    if (!supabase || loading) return
    for (const seed of BRAND_FOUNDATION_SEEDS) {
      const brand = brands.find((b) => b.slug === seed.slug)
      if (!brand || isLocalFallbackBrandId(brand.id)) continue
      if (foundationSeedRef.current.has(brand.id)) continue
      foundationSeedRef.current.add(brand.id)
      void seedFoundationSupabase(brand.id, seed).catch(() => {
        foundationSeedRef.current.delete(brand.id)
      })
    }
  }, [user?.id, brands, loading])

  const reload = useCallback(async () => {
    if (!supabase || !user?.id) {
      setBrands([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = supabase
    const { data, error: err } = await withAuthLockRetry(() =>
      sb
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    )
    if (err) {
      ladErfolgRef.current = false
      if (isMissingSupabaseTableError(err.message)) {
        console.warn(
          '[useBrands] Tabelle `brands` fehlt oder Cache — 3D-Graph nutzt Fallback. Migration 0001 im Supabase SQL Editor ausführen.',
          err.message,
        )
        setError(null)
        setBrands(sortBrandsForDisplay(FALLBACK_BRANDS))
      } else if (isTransientAuthLockError(err.message)) {
        // Auch nach mehreren Retries noch ein Web-Locks-Fehler (viele Tabs):
        // NICHT als fatal behandeln — Banner unterdrücken, vorhandene Brands
        // behalten, der nächste reload() (z. B. auf onAuthStateChange) heilt.
        console.warn('[useBrands] Transienter Auth-Lock-Fehler — behalte Stand, kein Banner:', err.message)
        setError(null)
        setLoading(false)
        return
      } else {
        setError(err.message)
        setBrands([])
      }
    } else {
      setError(null)
      ladErfolgRef.current = true
      let rawRows = data ?? []
      let syncPromise = canonicalSyncPromiseByUser.get(user.id)
      if (!syncPromise) {
        syncPromise = syncCanonicalBrandsForUser(user.id, rawRows)
        canonicalSyncPromiseByUser.set(user.id, syncPromise)
      }
      const migrated = await syncPromise
      if (migrated) {
        const { data: again, error: err2 } = await withAuthLockRetry(() =>
          sb
            .from('brands')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
        )
        if (!err2 && again) {
          rawRows = again
        }
      }
      setBrands(sortBrandsForDisplay(rawRows.map(mapBrand)))
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!supabase || !user?.id || loading) return
    // Leer heißt nur dann WIRKLICH leer, wenn der letzte Lesevorgang geglückt ist.
    if (!ladErfolgRef.current || error !== null) return
    if (brands.length > 0) {
      seedAttemptedRef.current = false
      return
    }
    if (seedAttemptedRef.current) return
    if (defaultSeedAttemptedByUser.has(user.id)) return
    seedAttemptedRef.current = true
    defaultSeedAttemptedByUser.add(user.id)
    void (async () => {
      const rows = DEFAULT_BRANDS.map((b) => ({
        user_id: user.id,
        name: b.name,
        slug: b.slug,
        color: b.color,
      }))
      const { error: insErr } = await supabase.from('brands').insert(rows)
      if (insErr) {
        if (isMissingSupabaseTableError(insErr.message)) {
          console.warn(
            '[useBrands] Seed übersprungen (keine Tabelle) — Fallback-Nodes.',
            insErr.message,
          )
          setBrands(sortBrandsForDisplay(FALLBACK_BRANDS))
          setError(null)
        } else {
          console.warn('[useBrands] Standard-Brands:', insErr.message)
        }
        seedAttemptedRef.current = false
        return
      }
      await reload()
    })()
  }, [user?.id, brands.length, loading, error, reload])

  return { brands, loading, error, reload }
}
