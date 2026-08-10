import { NavLink, Route, Routes } from 'react-router-dom'
import { CallModePage } from '../../pages/sales/CallModePage'
import { ContactListsPage } from '../../pages/sales/ContactListsPage'
import { SalesMode } from '../../pages/sales/SalesMode'
import { SalesNewLeadPage } from '../../pages/sales/SalesNewLeadPage'
import { SalesBibliothek } from './SalesBibliothek'
import { SalesDashboard } from './SalesDashboard'
import { LeadListe } from './sales/LeadListe'
import { LeadDetail } from './sales/LeadDetail'
import { LinkedinArea } from './LinkedinArea'

function SalesSubNav() {
  const items = [
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
  return (
    <nav
      aria-label="Sales-Unterbereiche"
      style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', flexWrap: 'nowrap' }}
    >
      {items.map((i) => (
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
