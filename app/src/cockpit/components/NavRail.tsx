import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Badge, BadgeText } from './Badge'
import { AppGrid } from './home/AppGrid'
import { PALETTEN_BEREICHE, bereichIcon } from '../lib/bereiche'
import { useSocialUnread } from '../lib/socialApi'
import { MOBILE_MEDIA_QUERY } from '../../hooks/useViewport'
import { Benachrichtigungen } from './Benachrichtigungen'

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
 *
 * O18, Zug 1: Hier stehen nur noch **Auswahl, Reihenfolge und Beschriftung**.
 * Die Zeichen kommen aus der Bereichs-Registry (`bereiche.ts`) — dort steht
 * auch die O13-Regel gegen bunte Emoji auf iOS. Sonst hätte das App-Grid des
 * Homescreens seine eigenen Icons, und die zweite Bereichs-Wahrheit, die
 * Etappe 4 gerade zugenäht hat, wäre zurück.
 */
const ARBEIT: NavItem[] = [
  { to: '/cockpit', label: 'Cockpit', icon: bereichIcon('/cockpit') },
  // „Heute" fasst die täglichen Operativ-Bereiche zusammen (Sub-Tabs: HeuteTabs) —
  // deshalb hier ein anderes Label als in der Registry, aber dasselbe Zeichen.
  // O13: '\uFE0E' (Variation Selector-15) erzwingt die Text-Variante. Ohne ihn
  // rendert iOS ☑ und ⚙ als buntes Emoji — die einzigen zwei Zeichen der Leiste
  // mit Emoji-Default; alle anderen sind Geometric Shapes ohne Emoji-Form.
  { to: '/aufgaben', label: 'Heute', icon: bereichIcon('/aufgaben'), paths: ['/aufgaben', '/termine', '/freigaben'] },
  { to: '/sales', label: 'Sales', icon: bereichIcon('/sales') },
  { to: '/projekte', label: 'Projekte', icon: bereichIcon('/projekte') },
]

const NACHSCHLAGEN: NavItem[] = [
  { to: '/ads', label: 'Ads', icon: bereichIcon('/ads') },
  { to: '/content', label: 'Content', icon: bereichIcon('/content') },
  { to: '/agenten', label: 'Agenten', icon: bereichIcon('/agenten') },
  { to: '/tracking', label: 'Tracking', icon: bereichIcon('/tracking') },
]

/**
 * Bottom-Bar oder Rail? Eine Grenze für alle (O10): `MOBILE_MEDIA_QUERY` ist
 * derselbe Wert, den `useViewport().isMobile` und die `@media`-Blöcke in
 * cockpit.css benutzen. Bis zum 06.08. stand hier 900 und in useViewport 768.
 */
function useBottomBar(): boolean {
  const [schmal, setSchmal] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY)
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

/**
 * Die Bibliothek hinter „Mehr" (O18, Zug 5) — ein Tipp öffnet, ein Tipp wählt.
 *
 * Bis dahin standen hier vier Zeilen (nur NACHSCHLAGEN). Jetzt liegt hier
 * **alles, was man machen kann**: dasselbe Kachel-Grid wie auf dem Homescreen,
 * aber vollständig — auch die vier Bereiche, die schon in der Bar stehen. Das
 * ist der Unterschied zwischen einem Rest-Menü und einer Bibliothek.
 */
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
        aria-label="Bibliothek"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ck-label" style={{ padding: '2px 4px 8px' }}>
          Bibliothek
        </div>
        {/* Wächst die Registry, scrollt das Grid — der Schalter darunter bleibt
            erreichbar, statt unter den unteren Bildschirmrand zu rutschen. */}
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          <AppGrid
            bereiche={PALETTEN_BEREICHE}
            badgeFuer={badgeFuer}
            istAktiv={(path) => istAktiv({ to: path, label: '', icon: '' }, loc.pathname)}
            onWaehle={(path) => {
              navigate(path)
              onClose()
            }}
          />
        </div>

        {/* O3, Zug 5: Der Schalter fuer Benachrichtigungen gehoert dorthin, wo
            man ihn sucht, wenn der Morgen-Push mal ausbleibt — und nicht nur
            auf /morgen, das man ohne Push gar nicht erst aufmacht. */}
        <div style={{ borderTop: '1px solid var(--ck-border)', marginTop: 10, paddingTop: 10, flexShrink: 0 }}>
          <Benachrichtigungen kompakt />
        </div>
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
