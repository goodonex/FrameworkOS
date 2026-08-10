import { NavLink, Route, Routes } from 'react-router-dom'
import { CallModePage } from '../../pages/sales/CallModePage'
import { ContactListsPage } from '../../pages/sales/ContactListsPage'
import { ContactPage } from '../../pages/sales/ContactPage'
import { SalesMode } from '../../pages/sales/SalesMode'
import { SalesNewLeadPage } from '../../pages/sales/SalesNewLeadPage'
import { SalesBibliothek } from './SalesBibliothek'
import { SalesDashboard } from './SalesDashboard'
import { LeadListe } from './sales/LeadListe'
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
    { to: '/sales/bibliothek', label: 'Bibliothek', end: false },
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
 * Sales (ehem. CRM, Home-Refactor Juli 2026): Dashboard (Agenten + Funnel +
 * Bibliothek-Schnellzugriff) + die bestehenden Sales-Seiten in der Cockpit-Shell.
 * CRM-Logik unangetastet — Brand kommt über useCurrentBrandSlug aus dem
 * ActiveBrand-Context statt aus der URL.
 */
export function SalesArea() {
  return (
    <div>
      <SalesSubNav />
      <Routes>
        <Route index element={<SalesDashboard />} />
        <Route path="linkedin" element={<LinkedinArea eingebettet />} />
        <Route path="leads" element={<LeadListe />} />
        <Route path="pipeline" element={<SalesMode panel="full" scrollEmbed />} />
        <Route path="lists" element={<ContactListsPage />} />
        <Route path="lists/:listId" element={<ContactListsPage />} />
        <Route path="call-mode" element={<CallModePage />} />
        <Route path="new" element={<SalesNewLeadPage />} />
        <Route path="bibliothek" element={<SalesBibliothek />} />
        <Route path=":contactId" element={<ContactPage variant="page" />} />
      </Routes>
    </div>
  )
}
