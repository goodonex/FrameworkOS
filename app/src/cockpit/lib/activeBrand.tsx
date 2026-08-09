import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useBrands } from '../../hooks/useBrands'
import type { Brand } from '../../types/db'

/**
 * **Eine Brand, fest verdrahtet (09.08.2026).** Das Cockpit hatte oben einen
 * Umschalter über fünf Brands — ein Rest aus der Brand-OS-Zeit. Real gibt es
 * nur noch HERRMANN & CO.: Wertavio ist ein Produkt darunter, CoLective ist
 * beendet, der Rest war nie mehr als ein Seed.
 *
 * Die Tabelle `brands` und der Kontext bleiben, weil jede Datenabfrage über
 * `brand_id` scopet — nur die *Auswahl* ist weg. Damit kann niemand mehr auf
 * einer leeren Brand landen und sich wundern, warum das Cockpit leer ist.
 * Der frühere localStorage-Schlüssel `cockpit.activeBrandSlug` wird bewusst
 * nicht mehr gelesen; ein alter Eintrag darf den Slug nicht mehr kapern.
 */
const DEFAULT_SLUG = 'herrmann'

interface ActiveBrandContextValue {
  brands: Brand[]
  loading: boolean
  /** Fehlermeldung der brands-Query (null = ok). Für Diagnose-Banner. */
  error: string | null
  activeSlug: string
  activeBrand: Brand | null
}

const ActiveBrandContext = createContext<ActiveBrandContextValue | null>(null)

/** Cockpit-weiter Brand-Kontext — fest auf HERRMANN & CO. */
export function ActiveBrandProvider({ children }: { children: ReactNode }) {
  const { brands, loading, error } = useBrands()
  const activeSlug = DEFAULT_SLUG

  const activeBrand = useMemo(
    () => brands.find((b) => b.slug === activeSlug) ?? brands[0] ?? null,
    [brands, activeSlug],
  )

  const value = useMemo(
    () => ({ brands, loading, error, activeSlug, activeBrand }),
    [brands, loading, error, activeSlug, activeBrand],
  )

  return <ActiveBrandContext.Provider value={value}>{children}</ActiveBrandContext.Provider>
}

export function useActiveBrand(): ActiveBrandContextValue {
  const ctx = useContext(ActiveBrandContext)
  if (!ctx) throw new Error('useActiveBrand muss innerhalb von ActiveBrandProvider laufen')
  return ctx
}

/** Null-tolerant — für Komponenten, die sowohl im Cockpit als auch in der alten Shell laufen. */
export function useActiveBrandOptional(): ActiveBrandContextValue | null {
  return useContext(ActiveBrandContext)
}

/** Letzter Fallback ohne Context (z.B. Redirect-Komponenten außerhalb des Providers). */
export function readStoredBrandSlug(): string {
  return DEFAULT_SLUG
}
