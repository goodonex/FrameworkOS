import { Outlet, useLocation } from 'react-router-dom'
import { ChatBubble } from './components/ChatBubble'
import { NavRail } from './components/NavRail'
import { RundeTor } from './components/RundeTor'
import { RunWatcher } from './components/RunWatcher'
import { StatusBar } from './components/StatusBar'
import { UrielAura } from './components/UrielAura'
import { UrielDock } from './components/UrielDock'
import { ActiveBrandProvider } from './lib/activeBrand'
import '../styles/cockpit.css'

/**
 * Neue App-Shell (REBUILD-PLAN §5): Statusleiste oben, Nav-Rail links,
 * Inhalt rechts. Volle Viewport-Höhe, eigenes Scroll-Management im Content.
 * Kein Canvas, kein Glas — bewusst schlichtes DOM-Layout.
 */
export function CockpitShell() {
  /**
   * Der Homescreen bekommt seit Phase 2 (D4) eine eigene Uriel-Eingabe direkt
   * unter dem Ring. Der schwebende ✦-Knopf ist dort also ein zweiter Weg zur
   * selben Sache — und er lag mit seinen 48px genau auf der Aktion der ersten
   * „Jetzt dran"-Zeile. Am Handy blendet ihn die Regel in cockpit.css hier
   * aus; auf allen anderen Bereichen bleibt er.
   */
  const loc = useLocation()
  const istHome = loc.pathname === '/cockpit'
  /**
   * Im Zähl-Modus IST die Fläche der Knopf — ein Schwebeknopf darauf fängt
   * genau die Tipps ab, für die der Bildschirm da ist. Beide sind hier aus.
   */
  const istZaehlen = loc.pathname.startsWith('/tracking/zaehlen')

  return (
    <ActiveBrandProvider>
      {/* Das Tor zur Runde umschliesst die ganze Shell: Der Ladeschirm liegt
          ueber allem, und der Knopf in der Statusleiste liest denselben Zustand
          (31.08.2026, siehe components/RundeTor.tsx). */}
      <RundeTor>
      <div
        className="ck-root"
        data-home={istHome ? 'true' : undefined}
        data-zaehlen={istZaehlen ? 'true' : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          zIndex: 2,
        }}
      >
        <UrielAura />
        <StatusBar />
        {/* Der Wächter rendert den Sperrbalken („Anmeldung abgelaufen — Uriel
            läuft nicht") und steht deshalb hier oben statt am Ende: zwischen
            Statusleiste und Inhalt, ausserhalb des scrollenden Bereichs. */}
        <RunWatcher />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <NavRail />
          <main className="ck-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            <Outlet />
          </main>
        </div>
        <ChatBubble />
        <UrielDock />
      </div>
      </RundeTor>
    </ActiveBrandProvider>
  )
}
