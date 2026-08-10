import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ContactPage } from '../../../pages/sales/ContactPage'
import { readContactsLocal, useContacts } from '../../../hooks/useContacts'
import { useCurrentBrandSlug } from '../../../hooks/useCurrentBrandSlug'
import { STAGE_LABEL } from '../../../lib/salesPipelineFilters'
import { RessourcenPanel } from '../../components/sales/RessourcenPanel'

/**
 * Das Lead-Detail im Cockpit-Look (Phase 2, Zug B2 · D5).
 *
 * **Was hier neu ist:** der Rahmen. Ein Kopf in der Cockpit-Grammatik (Zurück,
 * Name, Stufe als Statusmarke), die Close-Anordnung — Timeline in der Mitte,
 * Stammdaten in der Seitenspalte rechts — und das Ressourcen-Panel am Lead
 * (D8).
 *
 * **Was hier bewusst NICHT neu ist:** die Maschine darunter. Feld-Speicherung
 * mit Entprellung, Aktivitäts-Modale, Anruf-Protokoll, Opportunities,
 * Feld-Konfiguration und der Post-Call-Flow hängen in `ContactPage` zusammen.
 * Das nachzubauen hiesse, Kernlogik zu duplizieren (Gesetz 4) und die Parität
 * aufs Spiel zu setzen — für eine Phase, die ändert, WIE Dinge aussehen, nie
 * WAS sie bedeuten. `ContactPage` rendert deshalb weiter, nur ohne eigenen
 * Kopf und mit den Stammdaten auf der anderen Seite; die Glas-Bausteine darin
 * tragen über `.ck-lead` die Welt-1-Werte (dasselbe Muster wie `.ck-deliver`).
 */
export function LeadDetail() {
  const { contactId } = useParams<{ contactId: string }>()
  const slug = useCurrentBrandSlug()
  const navigate = useNavigate()
  const contacts = useContacts(slug)

  /**
   * Beim ersten Frame ist die Liste noch leer — dann steht der Name im lokalen
   * Zwischenspeicher, den `useContacts` ohnehin fuellt. Ohne diese Weiche
   * stuende oben kurz „Lead" statt des Namens (im Gegenblick gefunden).
   */
  const contact = useMemo(() => {
    const ausListe = contacts.items.find((c) => c.id === contactId) ?? null
    if (ausListe) return ausListe
    if (!slug || !contactId) return null
    return readContactsLocal(slug).find((c) => c.id === contactId) ?? null
  }, [contacts.items, contactId, slug])

  return (
    <div className="ck-lead" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="ck-btn" onClick={() => navigate('/sales/leads')}>
          ← Leads
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {contact?.name || 'Lead'}
        </span>
        {contact ? <span className="ck-chip">{STAGE_LABEL[contact.pipeline_stage]}</span> : null}
      </div>

      {contact ? <RessourcenPanel contact={contact} /> : null}

      <ContactPage variant="page" scrollInParent ohneKopf seitenspalte="rechts" />
    </div>
  )
}
