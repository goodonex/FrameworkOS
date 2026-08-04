import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CollapsibleSection } from '../CollapsibleSection'
import { useContacts } from '../../hooks/useContacts'
import { useProjectLeads } from '../../hooks/useProjectLeads'
import type { DeliverProject } from '../../types/db'

const STAGE_LABEL: Record<string, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pausiert',
}

interface ProjectLeadsPanelProps {
  slug: string
  project: DeliverProject
}

export function ProjectLeadsPanel({ slug, project }: ProjectLeadsPanelProps) {
  const { leads, loading, error, assignLead, reload } = useProjectLeads(
    slug,
    project.id,
    project.client_contact_id,
  )
  const contacts = useContacts(slug)
  const [selectedContactId, setSelectedContactId] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [assigning, setAssigning] = useState(false)

  const unassigned = useMemo(() => {
    return contacts.items.filter(
      (c) => !c.deliver_project_id && c.id !== project.client_contact_id,
    )
  }, [contacts.items, project.client_contact_id])

  const handleAssign = async () => {
    if (!selectedContactId) return
    setAssigning(true)
    await assignLead(selectedContactId)
    setSelectedContactId('')
    setAssigning(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setAssigning(true)
    const result = await contacts.create(
      {
        name: newName.trim(),
        email: newEmail.trim(),
        deliver_project_id: project.id,
        portal_lead_status: 'new',
      },
      { skipDuplicateCheck: true },
    )
    if (result.ok) {
      setNewName('')
      setNewEmail('')
      await reload()
    }
    setAssigning(false)
  }

  return (
    <CollapsibleSection
      title="Leads im Projekt"
      meta={leads.length > 0 ? `${leads.length} Kontakte` : undefined}
      status={leads.length > 0 ? 'partial' : 'empty'}
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--ck-warn)' }}>
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            style={{
              flex: '1 1 180px',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--ck-border-strong)',
              background: 'var(--ck-panel)',
              color: 'var(--ck-text-1)',
              fontSize: 12,
            }}
          >
            <option value="">Bestehenden Kontakt zuweisen…</option>
            {unassigned.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.email || c.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="font-mono"
            disabled={!selectedContactId || assigning}
            onClick={() => void handleAssign()}
            style={{
              fontSize: 11,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--ck-accent)',
              color: 'var(--ck-accent)',
            }}
          >
            Zuweisen
          </button>
        </div>

        <div
          className="flex flex-wrap gap-2 rounded-xl p-3"
          style={{ border: '1px solid var(--ck-border-strong)' }}
        >
          <input
            type="text"
            placeholder="Neuer Lead — Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              flex: '1 1 140px',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--ck-border)',
              background: 'var(--ck-panel)',
              color: 'var(--ck-text-1)',
              fontSize: 12,
            }}
          />
          <input
            type="email"
            placeholder="E-Mail (optional)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{
              flex: '1 1 140px',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--ck-border)',
              background: 'var(--ck-panel)',
              color: 'var(--ck-text-1)',
              fontSize: 12,
            }}
          />
          <button
            type="button"
            className="font-mono"
            disabled={!newName.trim() || assigning}
            onClick={() => void handleCreate()}
            style={{
              fontSize: 11,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--ck-border-strong)',
              color: 'var(--ck-text-2)',
            }}
          >
            + Lead anlegen
          </button>
        </div>

        {loading ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
            Laden…
          </p>
        ) : leads.length === 0 ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
            Noch keine Leads zugeordnet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr className="font-mono" style={{ color: 'var(--ck-text-3)', fontSize: 10 }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Pipeline</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Datum</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--ck-border)' }}>
                    <td style={{ padding: '8px' }}>{c.name || '—'}</td>
                    <td style={{ padding: '8px' }}>
                      {STAGE_LABEL[c.pipeline_stage] ?? c.pipeline_stage}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--ck-text-2)' }}>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString('de-DE')
                        : '—'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <Link
                        to={`/sales/${c.id}`}
                        className="font-mono"
                        style={{ fontSize: 10, color: 'var(--ck-accent)' }}
                      >
                        Öffnen →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
