import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useUiSetting } from '../lib/uiSettings'
import { CallModePage } from '../../pages/sales/CallModePage'
import { ContactListsPage } from '../../pages/sales/ContactListsPage'
import { SalesMode } from '../../pages/sales/SalesMode'
import { SalesNewLeadPage } from '../../pages/sales/SalesNewLeadPage'
import { SalesBibliothek } from './SalesBibliothek'
import { SalesDashboard } from './SalesDashboard'
import { LeadListe } from './sales/LeadListe'
import { LeadDetail } from './sales/LeadDetail'
import { LinkedinArea } from './LinkedinArea'

interface SubNavItem {
  to: string
  label: string
  end: boolean
}

/**
 * Kevins Ritual laeuft auf dem Dashboard. Die sieben anderen Ziele sind
 * Nachschlagewerk — und standen bis zum 28.08.2026 trotzdem permanent als
 * Reihe darueber. Kevins Wort: *„Mach mal bitte dieses ganze LinkedIn, Leads,
 * Listen, Call-Mode, neuer Lead, Ressourcen, Pipeline — kannst du das
 * einklappbar machen?"*
 *
 * Zugeklappt bleibt genau EIN Eintrag stehen: der, auf dem man gerade ist.
 * Eine Leiste, die verraet, wo man steht, ist Orientierung; eine, die
 * ausserdem sieben Orte anbietet, an denen man nicht ist, ist Rauschen.
 */
const SUB_NAV: SubNavItem[] = [
  { to: '/sales', label: 'Dashboard', end: true },
  // LinkedIn-Akquise ist Vertriebsarbeit — sie gehört hierher, nicht nur unter „Heute".
  { to: '/sales/linkedin', label: 'LinkedIn', end: false },
  { to: '/sales/leads', label: 'Leads', end: false },
  { to: '/sales/lists', label: 'Listen', end: false },
  { to: '/sales/call-mode', label: 'Call-Mode', end: false },
  { to: '/sales/new', label: 'Neuer Lead', end: false },
  { to: '/sales/bibliothek', label: 'Ressourcen', end: false },
  // Die Glass-Pipeline bleibt erreichbar, bis die Paritaets-Karte
  // (docs/phase2/sales-paritaet.md) abgehakt ist — sie kann neun Dinge,
  // die der Neubau (noch) nicht kann.
  { to: '/sales/pipeline', label: 'Pipeline (klassisch)', end: false },
]

/** Auf welchem Eintrag steht man gerade? Laengster Treffer gewinnt. */
function aktiverEintrag(pathname: string): SubNavItem {
  let treffer = SUB_NAV[0]
  for (const i of SUB_NAV) {
    const passt = i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`)
    if (passt && i.to.length >= treffer.to.length) treffer = i
  }
  return treffer
}

function SalesSubNav() {
  const loc = useLocation()
  /**
   * Zustand in `ui_settings` (0068) — er ueberlebt damit das Loeschen-und-neu-
   * Hinzufuegen der PWA. **`=== true` statt Truthiness:** Der Wert kommt aus
   * einer Key-Value-Tabelle und war dort schon alles Moegliche.
   *
   * Vorgabe ist ZU. Kevin arbeitet den Tag ueber auf dem Dashboard; die Leiste
   * aufgeklappt zu zeigen hiesse, ihm bei jedem Aufruf sieben Ziele
   * anzubieten, die er an neun von zehn Tagen nicht braucht.
   */
  const { wert: offenRoh, setzen: setzeOffen } = useUiSetting<boolean>('salesSubNavOffen', false)
  const offen = offenRoh === true
  const aktiv = aktiverEintrag(loc.pathname)
  const sichtbar = offen ? SUB_NAV : [aktiv]

  return (
    <nav
      aria-label="Sales-Unterbereiche"
      style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', flexWrap: 'nowrap', alignItems: 'center' }}
    >
      <button
        type="button"
        className="ck-nav-item"
        style={{ padding: '6px 9px', flexShrink: 0, background: 'none', minHeight: 34 }}
        aria-expanded={offen}
        aria-controls="ck-sales-subnav"
        title={offen ? 'Bereiche einklappen' : 'Alle Sales-Bereiche zeigen'}
        onClick={() => setzeOffen(!offen)}
      >
        <span aria-hidden>{offen ? '▾' : '▸'}</span>
        <span className="ck-nur-vorlesen">{offen ? 'Bereiche einklappen' : 'Alle Sales-Bereiche zeigen'}</span>
      </button>
      <span id="ck-sales-subnav" style={{ display: 'flex', gap: 6, minWidth: 0 }}>
        {sichtbar.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={({ isActive }) => `ck-nav-item${isActive ? ' active' : ''}`}
            style={{ padding: '6px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {i.label}
          </NavLink>
        ))}
      </span>
    </nav>
  )
}

/**
 * Die Glass-Pipeline mit ihrem Schild (Phase 2, Zug B7).
 *
 * B7 sah den Abriss der Altwelt vor — die Paritäts-Karte
 * (`docs/phase2/sales-paritaet.md`) sagt aber: neun Funktionen haben im Neubau
 * keinen Ersatz. Damit greift die Regel „Abbruch statt Abriss": nichts wird
 * gelöscht, und dieses Banner sagt dem, der hier landet, warum es die Seite
 * noch gibt und was nur hier liegt.
 */
function KlassischePipeline() {
  return (
    <div>
      <div
        className="ck-panel"
        style={{ padding: '11px 14px', marginBottom: 10, fontSize: 12.5, lineHeight: 1.55, color: 'var(--ck-text-2)' }}
      >
        <strong style={{ color: 'var(--ck-text-1)', fontWeight: 600 }}>Die alte Pipeline.</strong>{' '}
        Der Neubau steht unter „Leads“. Hier liegt, was dort (noch) fehlt:
        Kanban zum Ziehen, die fünf Ansichts-Modi, Mehrfachauswahl mit
        Bulk-Aktionen, E-Mail-Vorlagen, Meeting-Links und der
        Pipeline-Umschalter.
      </div>
      <SalesMode panel="full" scrollEmbed />
    </div>
  )
}

/**
 * Sales (ehem. CRM, Home-Refactor Juli 2026): Dashboard (Agenten + Funnel +
 * Ressourcen-Schnellzugriff) + die bestehenden Sales-Seiten in der
 * Cockpit-Shell. CRM-Logik unangetastet — Brand kommt über
 * useCurrentBrandSlug aus dem ActiveBrand-Context statt aus der URL.
 */
export function SalesArea() {
  return (
    <div>
      <SalesSubNav />
      <Routes>
        <Route index element={<SalesDashboard />} />
        <Route path="linkedin" element={<LinkedinArea eingebettet />} />
        <Route path="leads" element={<LeadListe />} />
        <Route path="pipeline" element={<KlassischePipeline />} />
        <Route path="lists" element={<ContactListsPage />} />
        <Route path="lists/:listId" element={<ContactListsPage />} />
        <Route path="call-mode" element={<CallModePage />} />
        <Route path="new" element={<SalesNewLeadPage />} />
        <Route path="bibliothek" element={<SalesBibliothek />} />
        <Route path=":contactId" element={<LeadDetail />} />
      </Routes>
    </div>
  )
}
