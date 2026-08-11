import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Background } from './components/Background'
import { CommandPalette } from './components/CommandPalette'
import { RequireAuthShell } from './components/RequireAuthShell'
import { RequireOwnerGate } from './components/RequireOwnerGate'
import { SaveStatusIndicator } from './components/SaveStatusIndicator'
import { ShortcutsOverlay } from './components/ShortcutsOverlay'
import { ToastProvider } from './components/Toast'
import { CommandPaletteContext } from './lib/commandPaletteContext'
import { COCKPIT_PREFIXES } from './cockpit/lib/bereiche'
import { SaveStatusProvider } from './lib/saveStatusContext'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PortalLoginPage } from './pages/portal/PortalLoginPage'
import { PortalRoute } from './pages/portal/PortalRoute'
import { PortalSetupPage } from './pages/portal/PortalSetupPage'
import { BookingPublicPage } from './pages/public/BookingPublicPage'
import { LeadIntakePage } from './pages/public/LeadIntakePage'
import { useViewport } from './hooks/useViewport'
import { LegacySalesRedirect } from './cockpit/lib/LegacySalesRedirect'
import { LegacyBrandRedirect, LegacyDeliverRedirect } from './cockpit/lib/LegacyBrandRedirect'
import { OnboardingPublicPage } from './pages/onboarding/OnboardingPublicPage'
import { CockpitShell } from './cockpit/CockpitShell'
import { CockpitHome } from './cockpit/pages/CockpitHome'
import { MorgenArea } from './cockpit/pages/MorgenArea'
import { SalesArea } from './cockpit/pages/SalesArea'
import { ProjekteArea } from './cockpit/pages/ProjekteArea'
import { ZaehlModus } from './cockpit/pages/ZaehlModus'
import { TrackingArea } from './cockpit/pages/TrackingArea'
import { AdsArea } from './cockpit/pages/AdsArea'
import { SocialArea } from './cockpit/pages/SocialArea'
import { AgentsArea } from './cockpit/pages/AgentsArea'
import { AufgabenArea } from './cockpit/pages/AufgabenArea'
import { TermineArea } from './cockpit/pages/TermineArea'
import { FreigabenArea } from './cockpit/pages/FreigabenArea'
import { LinkedinArea } from './cockpit/pages/LinkedinArea'
import { SalesVorschau } from './dev/SalesVorschau'
import { ZielVorschau } from './dev/ZielVorschau'
import { NavVorschau } from './dev/NavVorschau'
import { ShellVorschau } from './dev/ShellVorschau'
import { PosteingangVorschau } from './dev/PosteingangVorschau'


/** CRM → Sales (Juli 2026): alte /crm-Links/Bookmarks/Deep-Links auf /sales umleiten. */
function CrmRedirect() {
  const location = useLocation()
  const rest = location.pathname.replace(/^\/crm/, '')
  const target = rest === '' || rest === '/' ? '/pipeline' : rest
  return <Navigate to={`/sales${target}${location.search}`} replace />
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

function OwnerWorkspaceShell() {
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const navigate = useNavigate()

  const gPrefixRef = useRef<{ active: boolean; timeout: number | null }>({
    active: false,
    timeout: null,
  })

  useEffect(() => {
    const clearGPrefix = () => {
      if (gPrefixRef.current.timeout) {
        window.clearTimeout(gPrefixRef.current.timeout)
        gPrefixRef.current.timeout = null
      }
      gPrefixRef.current.active = false
    }

    const handler = (e: KeyboardEvent) => {
      const isCmdK =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.shiftKey && !e.altKey
      if (isCmdK) {
        e.preventDefault()
        setCmdkOpen((o) => !o)
        return
      }

      if (isEditableTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen((o) => !o)
        return
      }

      if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false)
        return
      }

      const key = e.key.toLowerCase()

      if (gPrefixRef.current.active) {
        // Denk-Modi (Phase 6) und Brand-Oberfläche (Etappe 4/2) abgerissen:
        // g-Shortcuts zeigen ausnahmslos in die Cockpit-Welt.
        const map: Record<string, string> = {
          c: '/cockpit',
          s: '/sales',
          t: '/tracking',
          p: '/projekte',
          h: '/cockpit',
        }
        const target = map[key]
        if (target) {
          e.preventDefault()
          navigate(target)
        }
        clearGPrefix()
        return
      }

      if (key === 'g') {
        gPrefixRef.current.active = true
        gPrefixRef.current.timeout = window.setTimeout(clearGPrefix, 1200)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      clearGPrefix()
    }
  }, [navigate, shortcutsOpen])

  return (
    <RequireAuthShell>
      <RequireOwnerGate>
        <CommandPaletteContext.Provider
          value={{
            open: cmdkOpen,
            openPalette: () => setCmdkOpen(true),
            closePalette: () => setCmdkOpen(false),
          }}
        >
          <Outlet />
          <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
          <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </CommandPaletteContext.Provider>
      </RequireOwnerGate>
    </RequireAuthShell>
  )
}

function App() {
  const location = useLocation()
  useViewport() // hält Viewport-Listener aktiv (Mobile-Gates in Unterseiten)
  const isHome = location.pathname === '/'
  // Die Cockpit-Shell (.ck-root) liegt fixed über dem ganzen Viewport, ist
  // deckend und darüber (z-index 2). Die drei blur(80px)-Blobs des Backgrounds
  // wurden dort also jeden Frame umsonst compositet — auf Cockpit-Routen aus.
  const isCockpit = COCKPIT_PREFIXES.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  )
  /**
   * Zug C3: Dasselbe gilt fuers Kundenportal. Es bringt seit Welt 2 seinen
   * eigenen Navy-Verlauf mit — die bunten Blobs des alten Hintergrunds lagen
   * darunter und schauten links und rechts neben der Portal-Spalte heraus.
   */
  const isPortal = location.pathname.startsWith('/portal')

  return (
    <ToastProvider>
      <SaveStatusProvider>
      {isCockpit || isPortal ? null : <Background />}
      {/* Phase 6: Three.js-Welt abgerissen — reines DOM-Layout. */}
      <div
        id="app-ui-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'hidden',
          outline: 'none',
          border: 'none',
        }}
      >
        <main
          className={
            isHome
              ? 'relative mx-0 px-0 pb-0 pt-0'
              : 'relative mx-auto px-4 pb-10 pt-6 md:px-8 md:pb-12 md:pt-6'
          }
          style={{
            pointerEvents: 'none',
            background: 'transparent',
            maxWidth: isHome ? 'none' : 1100,
            margin: isHome ? 0 : '0 auto',
            minHeight: '100vh',
            maxHeight: '100vh',
            overflowY: isHome ? 'hidden' : 'auto',
            WebkitOverflowScrolling: 'touch',
            outline: 'none',
            border: 'none',
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding/:brandId" element={<OnboardingPublicPage />} />
            <Route path="/portal/login" element={<PortalLoginPage />} />
            <Route path="/portal/setup" element={<PortalSetupPage />} />
            <Route path="/portal/:projectId/crm" element={<PortalRoute crm />} />
            <Route path="/portal/:projectId" element={<PortalRoute />} />
            <Route path="/book/:brandSlug/:linkSlug" element={<BookingPublicPage />} />
            <Route path="/leads/:brandSlug" element={<LeadIntakePage />} />
            {/* Dev-only: Sales-Bausteine mit Fixtures, ohne Login prüfbar */}
            {import.meta.env.DEV ? <Route path="/dev/sales-vorschau" element={<SalesVorschau />} /> : null}
            {import.meta.env.DEV ? <Route path="/dev/ziel-vorschau" element={<ZielVorschau />} /> : null}
            {import.meta.env.DEV ? <Route path="/dev/nav-vorschau" element={<NavVorschau />} /> : null}
            {import.meta.env.DEV ? <Route path="/dev/shell-vorschau" element={<ShellVorschau />} /> : null}
            {import.meta.env.DEV ? <Route path="/dev/posteingang-vorschau" element={<PosteingangVorschau />} /> : null}
            <Route element={<OwnerWorkspaceShell />}>
              {/* Neue Cockpit-Shell (REBUILD-PLAN §5) */}
              <Route element={<CockpitShell />}>
                <Route path="/cockpit" element={<CockpitHome />} />
                {/* O3: Ziel des Morgen-Push. Am Desktop leitet die Seite selbst
                    auf /cockpit um — Vollbild ist ein Handy-Konzept. */}
                <Route path="/morgen" element={<MorgenArea />} />
                <Route path="/aufgaben" element={<AufgabenArea />} />
                <Route path="/termine" element={<TermineArea />} />
                <Route path="/freigaben" element={<FreigabenArea />} />
                <Route path="/linkedin" element={<LinkedinArea />} />
                <Route path="/sales/*" element={<SalesArea />} />
                <Route path="/crm/*" element={<CrmRedirect />} />
                <Route path="/projekte/*" element={<ProjekteArea />} />
                <Route path="/ads/*" element={<AdsArea />} />
              <Route path="/content/*" element={<SocialArea />} />
              <Route path="/agenten" element={<AgentsArea />} />
                <Route path="/tracking" element={<TrackingArea />} />
                {/* Zähl-Modus (11.08.): Raster und Vollbild teilen sich eine
                    Komponente — mit :feld ist es das Vollbild, ohne das Raster. */}
                <Route path="/tracking/zaehlen" element={<ZaehlModus />} />
                <Route path="/tracking/zaehlen/:feld" element={<ZaehlModus />} />
              </Route>
              {/* Phase 6: Universe + Denk-Modi abgerissen → Cockpit ist Home */}
              <Route path="/" element={<Navigate to="/cockpit" replace />} />
              {/* Etappe 4/2: Die alte Brand-Oberfläche ist abgerissen. Was bleibt,
                  sind Weichen für alte Lesezeichen — Sales ins Cockpit-Sales,
                  Deliver in die Projekte, alles übrige auf die Cockpit-Home. */}
              <Route path="/brand/:slug/sales/*" element={<LegacySalesRedirect />} />
              <Route path="/brand/:slug/deliver/*" element={<LegacyDeliverRedirect />} />
              <Route path="/brand/:slug/*" element={<LegacyBrandRedirect />} />
              <Route path="/brand/:slug" element={<LegacyBrandRedirect />} />
            </Route>
          </Routes>
        </main>
      </div>
      <SaveStatusIndicator />
      </SaveStatusProvider>
    </ToastProvider>
  )
}

export default App
