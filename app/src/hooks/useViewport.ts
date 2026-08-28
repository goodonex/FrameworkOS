/**
 * Reaktive Viewport-Information für Responsive-Logic.
 * Hauptzweck: Mobile-Erkennung für Drawer-Sidebar, Single-Column-Layouts und Call-Mode.
 */
import { useEffect, useState } from 'react'

/**
 * Die eine Mobil-Grenze des Cockpits (O10, 06.08.2026).
 *
 * Vorher schaltete `useViewport` bei 768, `NavRail` und `cockpit.css` bei 900 —
 * zwischen 768 und 900 lagen zwei halbe Welten: Bottom-Bar da, `isMobile` aber
 * false. Wer diesen Wert ändert, muss `cockpit.css` mitziehen; die dortigen
 * `@media (max-width: 900px)` sind die einzigen Stellen, die ihn nicht
 * importieren können.
 *
 * Inklusiv wie in CSS: `max-width: 900px` schließt 900 ein, `isMobile` also auch.
 */
export const MOBILE_MAX_WIDTH = 900

/**
 * Ab hier tragen Funnel und Tagesliste nebeneinander (28.08.2026, Blaupause
 * `docs/wargames/sales-canvas-v2.md`, Zug 1).
 *
 * Gerechnet, nicht geschaetzt: 148 (Nav-Rail) + 36 (Innenabstand von
 * `.ck-main`) + 760 (die Kartenspalte, so breit wie bisher die ganze Seite)
 * + 18 (Spalte) + 340 (Tagesliste) = 1302. 1180 ist der Punkt, ab dem beides
 * nebeneinander noch atmet; eine eingeklappte Nav-Rail verschafft zusaetzlich
 * 96 px Luft.
 *
 * **Steht hier und nicht im Sales-Bereich**, obwohl nur der sie benutzt: Das
 * Cockpit hat seine Viewport-Grenzen an genau einer Stelle (O10), und
 * `scripts/verify-breakpoint.ts` haelt das fest. Eine zweite Zahl irgendwo in
 * `cockpit/pages/` waere der Anfang derselben Drift, die am 06.08. eine halbe
 * Welt zwischen 768 und 900 aufgemacht hat.
 */
export const SALES_ZWEISPALTIG_AB = 1180

/** Passende Media-Query-Zeichenkette, damit niemand die Zahl abtippt. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`

export interface Viewport {
  width: number
  height: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

function read(): Viewport {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768, isMobile: false, isTablet: false, isDesktop: true }
  }
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    width: w,
    height: h,
    isMobile: w <= MOBILE_MAX_WIDTH,
    isTablet: w > MOBILE_MAX_WIDTH && w < 1100,
    isDesktop: w >= 1100,
  }
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read)
  useEffect(() => {
    let raf: number | null = null
    const onResize = () => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setVp(read()))
    }
    // Zusätzlich auf die MediaQuery hören — dieselbe Härtung, die `NavRail`
    // schon hat: beim Umschalten des Viewports (Vorschau-Pane, DevTools-
    // Gerätemodus) feuert `change` der Query, aber nicht immer `resize`. Ohne
    // diesen Listener stand beim Prüfen von O18 die Bottom-Bar schon mobil,
    // während `isMobile` noch false meldete — die Home zeigte den Desktop-
    // Stapel in einer Handy-Breite.
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY)
    mq.addEventListener('change', onResize)
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onResize, { passive: true })
    return () => {
      mq.removeEventListener('change', onResize)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])
  return vp
}

export function useIsMobile(): boolean {
  return useViewport().isMobile
}
