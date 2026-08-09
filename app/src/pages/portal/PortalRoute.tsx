import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { RequireAuthShell } from '../../components/RequireAuthShell'
import { useAuth } from '../../hooks/useAuth'
import { ClientPortal } from './ClientPortal'

function RequireClientPortalGate({
  children,
  ownerView = false,
}: {
  children: ReactNode
  ownerView?: boolean
}) {
  const { user, role, clientProjectId, loading } = useAuth()
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()

  if (loading) {
    return (
      <div
        className="font-mono animate-pulse"
        style={{
          pointerEvents: 'auto',
          padding: 32,
          color: 'var(--text-tertiary)',
          fontSize: 12,
          background: 'var(--bg-base)',
          minHeight: '100vh',
        }}
      >
        Session wird geladen…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/portal/login" replace state={{ from: location.pathname }} />
  }

  if (role === 'owner' && !ownerView) {
    return <Navigate to="/" replace />
  }

  if (role === 'client' && !clientProjectId) {
    return (
      <div
        className="font-mono"
        style={{
          pointerEvents: 'auto',
          padding: 32,
          color: 'var(--accent-coral)',
          fontSize: 13,
          background: 'var(--bg-base)',
          minHeight: '100vh',
        }}
      >
        Deinem Konto ist noch kein Projekt zugeordnet. Bitte melde dich bei deinem
        Ansprechpartner.
      </div>
    )
  }

  if (role === 'client' && clientProjectId && projectId !== clientProjectId) {
    return <Navigate to={`/portal/${clientProjectId}`} replace />
  }

  return <>{children}</>
}

/**
 * Preview: ?preview=true — lädt Projekt aus localStorage (Entwicklung, kein Login).
 * Kunden-Ansicht: ?als=kunde — Owner sieht das Portal wie der Kunde (Banner).
 *
 * D10 (O13): Der Preview-Parameter gilt nur noch im Dev-Build. In Produktion
 * war er ein Auth-Bypass, der an einem localStorage-Eintrag hing — als
 * Entwicklungswerkzeug wertvoll, live nur Risiko ohne Gegenwert. Auf der
 * Live-Domain läuft `?preview=true` jetzt ins normale Login-Gate.
 */
export function PortalRoute({ crm = false }: { crm?: boolean }) {
  const [searchParams] = useSearchParams()
  const preview = import.meta.env.DEV && searchParams.get('preview') === 'true'
  const ownerView = searchParams.get('als') === 'kunde'

  if (preview) {
    return <ClientPortal preview crm={crm} />
  }

  return (
    <RequireAuthShell>
      <RequireClientPortalGate ownerView={ownerView}>
        <ClientPortal preview={false} crm={crm} ownerView={ownerView} />
      </RequireClientPortalGate>
    </RequireAuthShell>
  )
}
