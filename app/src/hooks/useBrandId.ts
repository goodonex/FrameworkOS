import { useMemo } from 'react'
import { brandIdFromSlug } from '../lib/brandResolve'
import { useBrands } from './useBrands'

export interface BrandIdStatus {
  brandId: string | null
  /**
   * Die Brands sind noch unterwegs — `brandId === null` heißt hier **nicht**
   * „es gibt keine Brand", sondern „wir wissen es noch nicht".
   *
   * Ohne diese Unterscheidung meldete jeder Daten-Hook beim ersten Render
   * `loading: false` mit leerer Liste: das Sales-Dashboard zeigte für einen
   * Wimpernschlag „Alles abgearbeitet", /projekte „Noch keine Projekte" plus
   * die Warnung „Keine Brand verbunden", und die Erstnachrichten „Noch keine
   * gespiegelt" — obwohl alles da war. Genau die Sorte falscher Zahl, die
   * Kevin morgens stolpern lässt.
   */
  pending: boolean
}

export function useBrandIdStatus(brandSlug: string | undefined): BrandIdStatus {
  const { brands, loading } = useBrands()
  const brandId = useMemo(() => {
    if (!brandSlug) return null
    return brandIdFromSlug(brands, brandSlug)
  }, [brands, brandSlug])
  // Ist der Lesevorgang durch, ist `null` eine echte Antwort — auch bei
  // fehlendem Slug, denn der kommt aus derselben Brands-Liste.
  return { brandId, pending: brandId === null && loading }
}

export function useBrandId(brandSlug: string | undefined): string | null {
  return useBrandIdStatus(brandSlug).brandId
}
