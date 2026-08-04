import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { getProjectAreaChips } from '../../lib/projectAreas'
import type { Contact } from '../../types/db'

export function findDeliverProjectForContact(
  projects: ReturnType<typeof useDeliverProjects>['items'],
  contact: Contact,
) {
  if (contact.deliver_project_id) {
    const linked = projects.find((p) => p.id === contact.deliver_project_id)
    if (linked) return linked
  }
  const emailKey = (contact.email ?? '').trim().toLowerCase()
  return (
    projects.find(
      (p) =>
        p.client_contact_id === contact.id ||
        (emailKey.length > 0 &&
          (p.client_email ?? '').trim().toLowerCase() === emailKey),
    ) ?? null
  )
}

export function ContactDeliverCard({
  brandSlug,
  contact,
}: {
  brandSlug: string
  contact: Contact
}) {
  const navigate = useNavigate()
  const deliver = useDeliverProjects(brandSlug)

  const project = useMemo(
    () => findDeliverProjectForContact(deliver.items, contact),
    [deliver.items, contact],
  )

  const areaChips = useMemo(() => getProjectAreaChips(project), [project])

  if (contact.pipeline_stage !== 'deal' && !project) return null

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        border: '1px solid color-mix(in srgb, var(--accent-teal) 35%, var(--glass-border-2))',
        background: 'color-mix(in srgb, var(--accent-teal) 8%, var(--glass-1))',
      }}
    >
      <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--accent-teal)' }}>
        Deliver · Projekt
      </div>
      {project ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="font-mono inline-flex max-w-full flex-1 items-center gap-2 truncate rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--glass-2)]"
            style={{
              fontSize: 12,
              color: 'var(--accent-teal)',
              border: '1px solid var(--glass-border-2)',
              background: 'transparent',
              cursor: 'pointer',
              minWidth: 0,
            }}
            onClick={() => navigate(`/projekte/${project.id}`)}
          >
            → Zum Projekt {project.name}
          </button>
          {areaChips.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {areaChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="font-mono"
                  onClick={() => navigate(`/projekte/${project.id}?area=${chip.key}`)}
                  style={{
                    fontSize: 10,
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--glass-border-2)',
                    color: 'var(--text-secondary)',
                    background: 'var(--glass-2)',
                    cursor: 'pointer',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="font-mono"
          onClick={() => {
            void deliver
              .create({
                name: `${contact.name || 'Kontakt'} — Projekt`,
                client_name: contact.name || '',
                client_email: contact.email?.trim() ?? '',
                client_contact_id: contact.id,
                internal_stage: 'onboarding',
                client_stage: 'onboarding',
                status: 'active',
              })
              .then((proj) => navigate(`/projekte/${proj.id}`))
          }}
          style={{
            fontSize: 12,
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent-teal)',
            color: 'var(--chip-text-on-accent)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Projekt erstellen
        </button>
      )}
    </div>
  )
}
