import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OPPORTUNITY_PRODUCT_META, OPPORTUNITY_PRODUCTS } from '../../lib/opportunityMeta'
import { getProjectAreaChips } from '../../lib/projectAreas'
import type {
  Contact,
  DeliverProject,
  Opportunity,
  OpportunityProduct,
  OpportunityStage,
  PipelineStage,
} from '../../types/db'
import { ContactStageStepper } from './ContactStageStepper'
import { ContactStatusDropdown } from './ContactStatusDropdown'
import { OpportunityStageStepper } from './OpportunityStageStepper'

export function ContactPhaseHeader({
  contact,
  onField,
  brandSlug,
  project,
  opportunities,
  error,
  onOpportunityStage,
  onCreatePitchProject,
  availableOpportunityProducts = [],
  onAddOpportunity,
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  brandSlug?: string
  project?: DeliverProject | null
  opportunities: Opportunity[]
  error?: string | null
  onOpportunityStage: (id: string, stage: OpportunityStage) => void
  onCreatePitchProject: () => void
  availableOpportunityProducts?: OpportunityProduct[]
  onAddOpportunity?: (product: OpportunityProduct) => void
}) {
  const navigate = useNavigate()
  const areaChips = useMemo(() => getProjectAreaChips(project ?? null), [project])
  const [activeProduct, setActiveProduct] = useState<OpportunityProduct | null>(null)

  const activeOpportunity = useMemo(() => {
    if (opportunities.length === 0) return null
    if (opportunities.length === 1) return opportunities[0]!
    const picked = activeProduct ?? opportunities[0]!.product
    return opportunities.find((o) => o.product === picked) ?? opportunities[0]!
  }, [activeProduct, opportunities])

  useEffect(() => {
    if (opportunities.length === 0) {
      setActiveProduct(null)
      return
    }
    if (opportunities.length === 1) {
      setActiveProduct(opportunities[0]!.product)
      return
    }
    setActiveProduct((prev) => {
      if (prev && opportunities.some((o) => o.product === prev)) return prev
      return opportunities[0]!.product
    })
  }, [opportunities])

  const productMeta = activeOpportunity
    ? OPPORTUNITY_PRODUCT_META[activeOpportunity.product]
    : null

  const pipelineStage: PipelineStage =
    contact.pipeline_stage === 'paused' ? 'paused' : contact.pipeline_stage

  /** Deliver-Leiste nur im echten Deal — nicht bei Pitch-Projekt / Pipeline Pitch. */
  const showDealDeliverNav =
    Boolean(brandSlug && project) &&
    contact.pipeline_stage === 'deal' &&
    (opportunities.length === 0 || activeOpportunity?.stage === 'deal')

  const showPitchProjectAction =
    !project &&
    (activeOpportunity?.stage === 'pitch' ||
      (opportunities.length === 0 && contact.pipeline_stage === 'proposal'))

  const compactProjectLink =
    Boolean(brandSlug && project) && !showDealDeliverNav ? (
      <button
        type="button"
        className="font-mono"
        onClick={() => navigate(`/projekte/${project!.id}`)}
        style={{
          fontSize: 10,
          padding: '4px 8px',
          borderRadius: 999,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-2)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        → Pitch-Projekt
      </button>
    ) : null

  const pitchProjectBtn = showPitchProjectAction ? (
    <button
      type="button"
      className="font-mono"
      onClick={onCreatePitchProject}
      style={{
        fontSize: 10,
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid var(--glass-border-2)',
        background: 'var(--glass-2)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      + Pitch-Projekt
    </button>
  ) : null

  const customerToggleBtn = showDealDeliverNav ? (
    <button
      type="button"
      className="font-mono"
      onClick={() =>
        onField({
          contact_status:
            contact.contact_status === 'customer_inactive'
              ? 'deal_won'
              : 'customer_inactive',
        })
      }
      style={{
        fontSize: 9,
        padding: '3px 7px',
        borderRadius: 999,
        border: '1px solid var(--glass-border-2)',
        background: 'var(--glass-2)',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      {contact.contact_status === 'customer_inactive'
        ? 'Kunde wieder aktiv'
        : 'Kunde nicht aktiv'}
    </button>
  ) : null

  const opportunityTabs =
    opportunities.length > 0 && activeOpportunity && productMeta ? (
      <div
        className="font-mono"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
          fontSize: 9,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {OPPORTUNITY_PRODUCTS.map((product) => {
          const opp = opportunities.find((o) => o.product === product)
          const meta = OPPORTUNITY_PRODUCT_META[product]
          if (opp) {
            const active = activeOpportunity.id === opp.id
            return (
              <button
                key={opp.id}
                type="button"
                onClick={() => setActiveProduct(product)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: active ? `1px solid ${meta.color}` : '1px solid transparent',
                  background: active ? meta.bg : 'transparent',
                  color: active ? meta.color : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {meta.label}
              </button>
            )
          }
          if (!availableOpportunityProducts.includes(product) || !onAddOpportunity) return null
          return (
            <button
              key={product}
              type="button"
              onClick={() => onAddOpportunity(product)}
              title={`${meta.label} als Opportunity anlegen`}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px dashed var(--glass-border-2)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              + {meta.label}
            </button>
          )
        })}
      </div>
    ) : null

  const stageControl =
    opportunities.length > 0 && activeOpportunity && productMeta ? (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <OpportunityStageStepper
          current={activeOpportunity.stage}
          accentColor={productMeta.color}
          onChange={(stage) => onOpportunityStage(activeOpportunity.id, stage)}
        />
        {compactProjectLink}
        {pitchProjectBtn}
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <ContactStageStepper
            current={pipelineStage}
            onChange={(stage) => onField({ pipeline_stage: stage })}
            inline
            fullWidth
          />
        </div>
        {compactProjectLink}
        {pitchProjectBtn}
      </div>
    )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
      }}
    >
      {!showDealDeliverNav ? (
        <div style={{ flexShrink: 0, paddingTop: 1 }}>
          <ContactStatusDropdown contact={contact} onField={onField} compact mini />
        </div>
      ) : null}

      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error ? (
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--accent-coral)', margin: 0 }}>
            {error}
          </p>
        ) : null}

        {showDealDeliverNav ? (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="font-mono"
              onClick={() => {
                if (!brandSlug || !project) return
                navigate(`/projekte/${project.id}`)
              }}
              style={{
                fontSize: 12,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--accent-teal)',
                color: 'var(--accent-teal)',
                background: 'color-mix(in srgb, var(--accent-teal) 10%, transparent)',
                textAlign: 'left',
                cursor: 'pointer',
                width: 'fit-content',
                maxWidth: '100%',
              }}
            >
              → Zum Projekt {project?.name}
            </button>
            {areaChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="font-mono"
                onClick={() =>
                  brandSlug && project
                    ? navigate(`/projekte/${project.id}?area=${chip.key}`)
                    : null
                }
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--accent-teal)',
                  color: 'var(--accent-teal)',
                  background: 'var(--glass-2)',
                  cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            ))}
            {customerToggleBtn}
          </div>
        ) : null}

        {opportunityTabs}
        {stageControl}
      </div>
    </div>
  )
}
