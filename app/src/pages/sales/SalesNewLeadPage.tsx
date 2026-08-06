import { useNavigate } from 'react-router-dom'
import { useCurrentBrandSlug } from '../../hooks/useCurrentBrandSlug'
import { NewLeadWizardModal } from '../../components/sales/NewLeadWizardModal'
import { useToast } from '../../components/Toast'
import { useActivityEntries } from '../../hooks/useActivityEntries'
import { useContacts } from '../../hooks/useContacts'

export function SalesNewLeadPage() {
  const slug = useCurrentBrandSlug()
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const activities = useActivityEntries(slug)
  const { show: showToast } = useToast()

  return (
    <NewLeadWizardModal
      open
      onClose={() => navigate(`/brand/${slug}/sales`)}
      existingContacts={contacts.items}
      onSubmit={async ({ company, person, initialNote }, options) => {
        const r1 = await contacts.create(company, {
          skipDuplicateCheck: options?.skipDuplicateCheck ?? false,
        })
        if (!r1.ok) {
          showToast(
            r1.error ? `Firma nicht angelegt: ${r1.error}` : 'Firma konnte nicht angelegt werden',
            'error',
          )
          return
        }
        const r2 = await contacts.create(
          { ...person, parent_company_id: r1.contact.id },
          { skipDuplicateCheck: options?.skipDuplicateCheck ?? false },
        )
        if (!r2.ok && r2.error) {
          showToast(`Person nicht angelegt: ${r2.error}`, 'error')
        }
        if (initialNote && initialNote.trim()) {
          const personId = r2.ok ? r2.contact.id : null
          await activities.create({
            contact_id: personId ?? r1.contact.id,
            activity_type: 'notiz',
            data: { text: initialNote.trim() },
          })
        }
        navigate(`/brand/${slug}/sales/${r1.contact.id}`)
      }}
    />
  )
}
