import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useSocialUnread } from '../lib/socialApi'

interface NavItem {
  to: string
  label: string
  icon: string
  paths?: string[]
}

/**
 * Warteschlange vorn, Nachschlagewerk hinten (Leitprinzip Klick-Ökonomie):
 * die vier Bereiche, in denen Kevin morgens arbeitet, stehen am Daumen —
 * Ads/Content/Agenten/Tracking sind Nachschlagen und liegen mobil hinter „Mehr".
 * Am Desktop ist Platz, dort steht weiter alles untereinander.
 */
const ARBEIT: NavItem[] = [
  { to: '/cockpit', label: 'Cockpit', icon: '◉' },
  // „Heute" fasst die täglichen Operativ-Bereiche zusammen (Sub-Tabs: HeuteTabs).
  { to: '/aufgaben', label: 'Heute', icon: '☑', paths: ['/aufgaben', '/termine', '/freigaben'] },
  { to: '/sales', label: 'Sales', icon: '▤' },
  { to: '/projekte', label: 'Projekte', icon: '◈' },
]

const NACHSCHLAGEN: NavItem[] = [
  { to: '/ads', label: 'Ads', icon: '◨' },
  { to: '/content', label: 'Content', icon: '◐' },
  { to: '/agenten', label: 'Agenten', icon: '⚙' },
  { to: '/tracking', label: 'Tracking', icon: '▦' },
]

/**
 * Bottom-Bar oder Rail? Bewusst dieselbe Grenze wie in cockpit.css (900px) —
 * useViewport schaltet bei 768 und läge hier eine halbe Welt daneben.
 */
function useBottomBar(): boolean {
  const [schmal, setSchmal] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    // Zusätzlich auf resize/orientationchange hören und jedes Mal neu abfragen:
    // das change-Event der MediaQuery kommt nicht überall verlässlich an
    // (u.a. bei Viewport-Umschaltung im Test), dann bliebe die Bar hängen.
    const pruefe = () => setSchmal(mq.matches)
    mq.addEventListener('change', pruefe)
    window.addEventListener('resize', pruefe, { passive: true })
    window.addEventListener('orientationchange', pruefe, { passive: true })
    pruefe()
    return () => {
      mq.removeEventListener('change', pruefe)
      window.removeEventListener('resize', pruefe)
      window.removeEventListener('orientationchange', pruefe)
    }
  }, [])
  return schmal
}

function istAktiv(item: NavItem, pathname: string): boolean {
  const pfade = item.paths ?? [item.to]
  return pfade.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function Badge({ anzahl }: { anzahl: number }) {
  if (anzahl <= 0) return null
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: -3,
        right: -6,
        minWidth: 14,
        height: 14,
        padding: '0 3px',
        borderRadius: 99,
        background: 'var(--ck-accent)',
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        lineHeight: '14px',
        textAlign: 'center',
      }}
    >
      {anzahl}
    </span>
  )
}

/** Nur fürs Vorlese-Programm — der Badge selbst ist aria-hidden. */
function BadgeText({ anzahl }: { anzahl: number }) {
  if (anzahl <= 0) return null
  return (
    <span
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
    >
      {' '}
      ({anzahl} neu)
    </span>
  )
}

function NavEintrag({ item, badge }: { item: NavItem; badge: number }) {
  const loc = useLocation()
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `ck-nav-item${(item.paths ? istAktiv(item, loc.pathname) : isActive) ? ' active' : ''}`
      }
    >
      <span aria-hidden className="ck-nav-icon" style={{ position: 'relative' }}>
        {item.icon}
        <Badge anzahl={badge} />
      </span>
      <span className="ck-nav-label">
        {item.label}
        <BadgeText anzahl={badge} />
      </span>
    </NavLink>
  )
}

/** Bottom-Sheet hinter „Mehr" — ein Tipp öffnet, ein Tipp wählt, fertig. */
function MehrSheet({ onClose, badgeFuer }: { onClose: () => void; badgeFuer: (to: string) => number }) {
  const navigate = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="ck-mehr-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ck-mehr-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Weitere Bereiche"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ck-label" style={{ padding: '2px 4px 8px' }}>
          Weitere Bereiche
        </div>
        {NACHSCHLAGEN.map((item) => {
          const badge = badgeFuer(item.to)
          return (
            <button
              key={item.to}
              type="button"
              className={`ck-nav-item${istAktiv(item, loc.pathname) ? ' active' : ''}`}
              style={{ width: '100%', minHeight: 48, background: 'none' }}
              onClick={() => {
                navigate(item.to)
                onClose()
              }}
            >
              <span aria-hidden className="ck-nav-icon" style={{ position: 'relative' }}>
                {item.icon}
                <Badge anzahl={badge} />
              </span>
              <span className="ck-nav-label">
                {item.label}
                <BadgeText anzahl={badge} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function NavRail() {
  const socialUnread = useSocialUnread()
  const bottomBar = useBottomBar()
  const loc = useLocation()
  // Gemerkt wird die Route, auf der geöffnet wurde: damit schließt sich das
  // Sheet bei jedem Bereichswechsel von selbst (die Bar bleibt ja tippbar,
  // während es offen steht) — ohne Effekt, der Zustand nachzieht.
  const [mehrOffenBei, setMehrOffenBei] = useState<string | null>(null)
  const mehrOffen = mehrOffenBei === loc.pathname

  const badgeFuer = (to: string) => (to === '/content' ? socialUnread : 0)

  const sichtbar = bottomBar ? ARBEIT : [...ARBEIT, ...NACHSCHLAGEN]
  // Der Content-Badge darf mobil nicht verschwinden, nur weil Content hinter
  // „Mehr" liegt — er wandert auf den Mehr-Knopf.
  const mehrBadge = bottomBar ? NACHSCHLAGEN.reduce((s, i) => s + badgeFuer(i.to), 0) : 0
  const mehrAktiv = bottomBar && NACHSCHLAGEN.some((i) => istAktiv(i, loc.pathname))

  return (
    <>
      <nav aria-label="Cockpit-Bereiche" className="ck-nav-rail">
        {sichtbar.map((item) => (
          <NavEintrag key={item.to} item={item} badge={badgeFuer(item.to)} />
        ))}
        {bottomBar ? (
          <button
            type="button"
            className={`ck-nav-item${mehrAktiv ? ' active' : ''}`}
            style={{ background: 'none' }}
            aria-haspopup="dialog"
            aria-expanded={mehrOffen}
            onClick={() => setMehrOffenBei(mehrOffen ? null : loc.pathname)}
          >
            <span aria-hidden className="ck-nav-icon" style={{ position: 'relative' }}>
              ⋯
              <Badge anzahl={mehrBadge} />
            </span>
            <span className="ck-nav-label">
              Mehr
              <BadgeText anzahl={mehrBadge} />
            </span>
          </button>
        ) : null}
      </nav>
      {bottomBar && mehrOffen ? (
        <MehrSheet onClose={() => setMehrOffenBei(null)} badgeFuer={badgeFuer} />
      ) : null}
    </>
  )
}
