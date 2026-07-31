import { NavRail } from '../cockpit/components/NavRail'
import { ActiveBrandProvider } from '../cockpit/lib/activeBrand'
import '../styles/cockpit.css'

/**
 * Dev-Vorschau (nur import.meta.env.DEV, ohne Login): zeigt die Nav in der
 * Shell-Geometrie, damit die mobile Bottom-Bar (5 Ziele + „Mehr"-Sheet) bei
 * 390×664 prüfbar ist. Grund wie bei SalesVorschau/ZielVorschau: die echte
 * Shell liegt hinter dem Supabase-Login. Kein Produktions-Code-Pfad.
 */
export function NavVorschau() {
  return (
    <ActiveBrandProvider>
      <div
        className="ck-root"
        style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'auto', zIndex: 2 }}
      >
        <div className="ck-statusbar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ck-wordmark">URIEL</span>
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <NavRail />
          <main className="ck-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)', margin: '0 0 10px' }}>
              Nav-Vorschau
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ck-text-2)', lineHeight: 1.6 }}>
              Bottom-Bar bei ≤900px: Cockpit · Heute · Sales · Projekte · Mehr. Hinter „Mehr" liegen
              Ads, Content, Agenten und Tracking. Am Desktop steht weiter alles in der Rail.
            </p>
          </main>
        </div>
      </div>
    </ActiveBrandProvider>
  )
}
