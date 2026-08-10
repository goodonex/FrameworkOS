import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCurrentBrandSlug } from '../../hooks/useCurrentBrandSlug'
import { FollowUpAgentButton } from '../../cockpit/components/FollowUpAgentButton'
import { Drawer } from '../../components/Drawer'
import { findDeliverProjectForContact } from '../../components/sales/ContactDeliverCard'
import { ContactOverviewPanel } from '../../components/sales/ContactOverviewPanel'
import { ContactPhaseHeader } from '../../components/sales/ContactPhaseHeader'
import { ContactActivityActionBar } from '../../components/sales/activity/ContactActivityActionBar'
import { ActivityModalHost } from '../../components/sales/activity/ActivityModalHost'
import { EmailComposeDialog } from '../../components/sales/EmailComposeDialog'
import type { ActivityModalType } from '../../lib/activityTypes'
import { usePostCallFlowOptional } from '../../hooks/usePostCallFlow'
import { useCallLogs } from '../../hooks/useSalesPro'
import { useViewport } from '../../hooks/useViewport'
import { useContactScrollLock } from '../../hooks/useContactScrollLock'
import { useContactFieldConfig } from '../../hooks/useContactFieldConfig'
import { readContactsLocal, useContacts } from '../../hooks/useContacts'
import { useContactFieldSave } from '../../hooks/useContactFieldSave'
import { ContactSaveStatusIndicator } from '../../components/sales/ContactSaveStatusIndicator'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useOpportunities } from '../../hooks/useOpportunities'
import { pitchWebsiteDeliverables } from '../../lib/deliverableCatalog'
import { OPPORTUNITY_PRODUCTS, PIPELINE_TO_OPPORTUNITY } from '../../lib/opportunityMeta'
import { useToast } from '../../components/Toast'
import type {
  ActivityEntry,
  Contact,
  OpportunityProduct,
  OpportunityStage,
  PipelineStage,
  SalesFieldItem,
} from '../../types/db'

const OPPORTUNITY_TO_PIPELINE: Partial<Record<OpportunityStage, PipelineStage>> = {
  erstkontakt: 'first_contact',
  gespraech: 'conversation',
  pitch: 'proposal',
  deal: 'deal',
}
const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
} as const

export function ContactPage({
  variant = 'page',
  scrollInParent = false,
  slugOverride,
  contactIdOverride,
  seitenspalte = 'links',
  ohneKopf = false,
}: {
  variant?: 'page' | 'module'
  scrollInParent?: boolean
  slugOverride?: string
  contactIdOverride?: string
  /**
   * Auf welcher Seite die Stammdaten stehen (Phase 2, Zug B2). Close stellt
   * die Timeline in die Mitte und die Daten daneben — rein darstellend, die
   * DOM-Reihenfolge und damit die Vorlese-Reihenfolge bleibt gleich.
   */
  seitenspalte?: 'links' | 'rechts'
  /** Der Neubau setzt seinen eigenen Kopf darüber. */
  ohneKopf?: boolean
} = {}) {
  const params = useParams<{ slug: string; contactId: string }>()
  const routeSlug = useCurrentBrandSlug()
  const slug = slugOverride ?? routeSlug
  const contactId = contactIdOverride ?? params.contactId
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const deliver = useDeliverProjects(slug)
  const fieldCfgErst = useContactFieldConfig(slug, 'erstgespraech')
  const fieldCfgQual = useContactFieldConfig(slug, 'qualifikation')
  const [fieldDrawer, setFieldDrawer] = useState<
    null | 'erstgespraech' | 'qualifikation'
  >(null)
  const [editFields, setEditFields] = useState<SalesFieldItem[]>([])

  useEffect(() => {
    if (fieldDrawer === 'erstgespraech') setEditFields([...fieldCfgErst.fields])
    if (fieldDrawer === 'qualifikation') setEditFields([...fieldCfgQual.fields])
  }, [fieldDrawer, fieldCfgErst.fields, fieldCfgQual.fields])

  const activeFieldCfg =
    fieldDrawer === 'erstgespraech'
      ? fieldCfgErst
      : fieldDrawer === 'qualifikation'
        ? fieldCfgQual
        : null

  const contact = useMemo(() => {
    const fromList = contacts.items.find((c) => c.id === contactId) ?? null
    if (fromList) return fromList
    if (!slug || !contactId) return null
    return readContactsLocal(slug).find((c) => c.id === contactId) ?? null
  }, [contacts.items, contactId, slug])

  const [draft, setDraft] = useState<Contact | null>(null)
  const [allowMissing, setAllowMissing] = useState(false)

  // Draft nur bei Wechsel der contactId (oder beim initialen Load) syncen.
  // Würden wir bei jeder `contact`-Änderung syncen, überschreibt ein abgeschlossener
  // Save (der nur ein einzelnes Feld aktualisiert) die noch im Debounce schwebenden
  // Änderungen an anderen Feldern → Status/Tasks/Termin wirken "nicht gespeichert".
  useEffect(() => {
    setDraft(null)
  }, [contactId])

  useEffect(() => {
    if (contact) setDraft(contact)
  }, [contact])

  useEffect(() => {
    if (contact) {
      setAllowMissing(false)
      return
    }
    const t = window.setTimeout(() => setAllowMissing(true), 1200)
    return () => window.clearTimeout(t)
  }, [contact, contactId])

  const pushPatch = useCallback(
    (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      if (!contactId || !slug) return
      contacts.update(contactId, patch)
    },
    [contactId, contacts, slug],
  )

  const { state: saveState, onField: saveField } = useContactFieldSave(pushPatch)

  const onField = useCallback(
    (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>, fieldKey?: string) => {
      setDraft((prev) => {
        const base = prev ?? contact
        if (!base) return null
        return { ...base, ...patch }
      })
      const key = fieldKey ?? (Object.keys(patch)[0] as string) ?? 'field'
      saveField(patch, key)
    },
    [saveField, contact],
  )

  const d = draft ?? contact
  const scrollRef = useRef<HTMLDivElement>(null)
  const ownScroll = variant === 'page' && !scrollInParent
  useContactScrollLock(ownScroll ? (scrollRef as RefObject<HTMLElement | null>) : { current: null })
  const { isMobile } = useViewport()
  const wideLayout = variant === 'page' && !isMobile
  const [activityModal, setActivityModal] = useState<ActivityModalType | null>(null)
  const [editingActivity, setEditingActivity] = useState<ActivityEntry | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [callOutcomeOpen, setCallOutcomeOpen] = useState(false)
  const [timelineRefresh, setTimelineRefresh] = useState(0)
  const calls = useCallLogs(slug, { contactId: contactId ?? '' })
  const postCallFlow = usePostCallFlowOptional()
  const opportunities = useOpportunities()
  const { show: showToast } = useToast()

  const ensuredOpportunityRef = useRef<string | null>(null)

  useEffect(() => {
    if (!contactId) return
    void opportunities.loadByContact(contactId)
  }, [contactId, opportunities.loadByContact])

  useEffect(() => {
    if (!contactId || !d) return
    if (opportunities.items.length > 0) return
    const oppStage = PIPELINE_TO_OPPORTUNITY[d.pipeline_stage]
    if (!oppStage || oppStage === 'erstkontakt') return
    if (ensuredOpportunityRef.current === contactId) return
    ensuredOpportunityRef.current = contactId
    void (async () => {
      const created = await opportunities.create(contactId, 'herrmann')
      if (created) await opportunities.updateStage(created.id, oppStage)
    })()
  }, [contactId, d, opportunities.create, opportunities.items.length, opportunities.updateStage])

  const handleCreateOpportunity = useCallback(
    async (product: OpportunityProduct) => {
      if (!contactId) return
      const created = await opportunities.create(contactId, product)
      if (created) {
        const oppStage =
          d?.pipeline_stage != null
            ? PIPELINE_TO_OPPORTUNITY[d.pipeline_stage]
            : undefined
        if (oppStage && oppStage !== 'erstkontakt') {
          await opportunities.updateStage(created.id, oppStage)
          const pipelineStage = OPPORTUNITY_TO_PIPELINE[oppStage]
          if (pipelineStage) onField({ pipeline_stage: pipelineStage })
        }
        showToast('Opportunity angelegt', 'success')
        return
      }
      if (opportunities.error) showToast(opportunities.error, 'error')
    },
    [contactId, d?.pipeline_stage, onField, opportunities, showToast],
  )

  const handleOpportunityStage = useCallback(
    async (id: string, stage: OpportunityStage) => {
      const ok = await opportunities.updateStage(id, stage)
      if (!ok) {
        if (opportunities.error) showToast(opportunities.error, 'error')
        return
      }
      const pipelineStage = OPPORTUNITY_TO_PIPELINE[stage]
      if (pipelineStage) {
        onField({ pipeline_stage: pipelineStage })
      }
      if (stage === 'deal' && d?.contact_status !== 'customer_inactive') {
        onField({ contact_status: 'deal_won' })
      }
    },
    [d?.contact_status, onField, opportunities, showToast],
  )

  const duplicateProject = useMemo(() => {
    if (!d) return null
    return findDeliverProjectForContact(deliver.items, d)
  }, [deliver.items, d])

  const availableOpportunityProducts = useMemo(
    () => OPPORTUNITY_PRODUCTS.filter((p) => !opportunities.items.some((o) => o.product === p)),
    [opportunities.items],
  )
  const handleLogCall = useCallback(() => {
    if (!contactId || !d) return
    const phone = (d.phone ?? '').trim()
    if (phone) {
      window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`
      return
    }
    if (postCallFlow) {
      postCallFlow.openPostCall({ contactId, source: 'contact' })
      setCallOutcomeOpen(false)
      return
    }
    setCallOutcomeOpen(true)
  }, [contactId, d, postCallFlow])

  const handleCreatePitchProject = useCallback(() => {
    if (!d || !slug) return
    const existing = findDeliverProjectForContact(deliver.items, d)
    if (existing) {
      navigate(`/projekte/${existing.id}`)
      return
    }
    const payload = {
      name: `${d.name || 'Kontakt'} — Pitch`,
      client_name: d.name ?? '',
      client_email: d.email?.trim() ?? '',
      client_contact_id: d.id,
      internal_stage: 'inner_world' as const,
      client_stage: 'inner_world' as const,
      status: 'active' as const,
      deliverables: pitchWebsiteDeliverables(),
    }
    void deliver
      .create(payload)
      .then(async (proj) => {
        if (!opportunities.items.some((o) => o.product === 'herrmann')) {
          const created = await opportunities.create(d.id, 'herrmann')
          if (created) await opportunities.updateStage(created.id, 'pitch')
        } else {
          const herrmann = opportunities.items.find((o) => o.product === 'herrmann')
          if (herrmann && herrmann.stage !== 'pitch' && herrmann.stage !== 'deal') {
            await opportunities.updateStage(herrmann.id, 'pitch')
          }
        }
        if (d.pipeline_stage !== 'proposal') {
          onField({ pipeline_stage: 'proposal' })
        }
        showToast('Pitch-Projekt angelegt', 'success')
        navigate(`/projekte/${proj.id}`)
      })
      .catch(async (err) => {
        // Fallback: einige Kontakte sind nicht FK-kompatibel (z. B. legacy/local IDs).
        // Dann Projekt trotzdem anlegen, nur ohne harte Kontaktverknüpfung.
        try {
          const fallback = await deliver.create({
            ...payload,
            client_contact_id: null,
          })
          showToast('Pitch-Projekt angelegt (ohne Kontaktverknüpfung)', 'info')
          navigate(`/projekte/${fallback.id}`)
          return
        } catch (fallbackErr) {
          const msg =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : err instanceof Error
                ? err.message
                : 'Pitch-Projekt konnte nicht angelegt werden'
          showToast(msg, 'error')
        }
      })
  }, [d, slug, deliver, navigate, showToast])

  const openActivityModal = useCallback((type: ActivityModalType) => {
    setEditingActivity(null)
    setActivityModal(type)
  }, [])

  const editActivity = useCallback((entry: ActivityEntry) => {
    setActivityModal(null)
    setEditingActivity(entry)
  }, [])

  const closeActivityModal = useCallback(() => {
    setActivityModal(null)
    setEditingActivity(null)
  }, [])

  const activeActivityModal: ActivityModalType | null = editingActivity
    ? (editingActivity.activity_type as ActivityModalType)
    : activityModal

  if (!slug || !contactId) {
    return <Navigate to="/" replace />
  }

  if (!contacts.loading && !contacts.error && !contact && allowMissing) {
    return <Navigate to={`/brand/${slug}/sales`} replace />
  }

  if (contacts.loading && !d && !contact) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 400,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (!d) {
    return (
      <div
        className="animate-pulse font-mono"
        style={{
          minHeight: 280,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          pointerEvents: 'auto',
        }}
      />
    )
  }

  return (
    <div
      ref={ownScroll ? scrollRef : undefined}
      style={{
        pointerEvents: 'auto',
        background: 'transparent',
        maxHeight: ownScroll ? 'calc(100vh - 120px)' : undefined,
        overflowY: ownScroll ? 'auto' : undefined,
        overscrollBehavior: ownScroll ? 'contain' : undefined,
      }}
    >
      {ohneKopf ? null : (
      <>
      <div
        className="mb-4"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {variant === 'page' ? (
            <Link
              to={`/brand/${slug}/sales`}
              className="font-mono"
              style={{
                fontSize: 12,
                color: 'var(--mode-sales)',
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
              }}
            >
              ← Zurück zur Pipeline
            </Link>
          ) : null}
          {contact ? <FollowUpAgentButton contact={contact} /> : null}
          {duplicateProject ? (
            <button
              type="button"
              className="font-mono"
              onClick={() => navigate(`/projekte/${duplicateProject.id}`)}
              style={{
                fontSize: 12,
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent-teal)',
                color: 'var(--chip-text-on-accent)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              → Zum Projekt
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="mb-3"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--mode-sales)',
          }}
        >
          Sales · Kontakt
        </div>
        <ContactSaveStatusIndicator state={saveState} />
      </div>
      </>
      )}


      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: wideLayout
            ? seitenspalte === 'rechts'
              ? 'minmax(0, 1fr) minmax(300px, 380px)'
              : 'minmax(300px, 380px) minmax(0, 1fr)'
            : '1fr',
          alignItems: 'start',
        }}
      >
        {/* Stammdaten. Die DOM-Reihenfolge bleibt gleich (und damit die
            Vorlese-Reihenfolge), nur die Spalte wandert — Close stellt die
            Timeline in die Mitte und die Daten daneben. */}
        {slug ? (
          <div style={{ minWidth: 0, order: seitenspalte === 'rechts' ? 2 : 1 }}>
            <ContactOverviewPanel
              brandSlug={slug}
              contact={d}
              onField={onField}
              layout={variant === 'page' ? 'page' : 'narrow'}
              column="left"
              callOutcomeOpen={callOutcomeOpen}
              onCallOutcomeOpenChange={setCallOutcomeOpen}
              onTimelineRefresh={() => setTimelineRefresh((n) => n + 1)}
            />
          </div>
        ) : null}

        <div style={{ minWidth: 0, order: seitenspalte === 'rechts' ? 1 : 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ContactPhaseHeader
            contact={d}
            onField={onField}
            brandSlug={slug}
            project={duplicateProject}
            opportunities={opportunities.items}
            error={opportunities.error}
            availableOpportunityProducts={availableOpportunityProducts}
            onAddOpportunity={(product) => {
              void handleCreateOpportunity(product)
            }}
            onOpportunityStage={(id, stage) => {
              void handleOpportunityStage(id, stage)
            }}
            onCreatePitchProject={handleCreatePitchProject}
          />

          {slug ? (
            <ContactActivityActionBar
              variant="header"
              brandSlug={slug}
              contact={d}
              onOpenModal={openActivityModal}
              onOpenEmail={() => setComposeOpen(true)}
              onCall={handleLogCall}
              addOpportunityProducts={availableOpportunityProducts}
              onAddOpportunity={(product) => {
                void handleCreateOpportunity(product)
              }}
            />
          ) : null}

          {contacts.error ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
              {contacts.error}
            </p>
          ) : null}

          {slug ? (
            <ContactOverviewPanel
              brandSlug={slug}
              contact={d}
              onField={onField}
              layout={variant === 'page' ? 'page' : 'narrow'}
              column="right"
              timelineRefresh={timelineRefresh}
              onTimelineRefresh={() => setTimelineRefresh((n) => n + 1)}
              onEditActivity={editActivity}
            />
          ) : null}
        </div>
      </div>

      {slug ? (
        <>
          <ActivityModalHost
            brandSlug={slug}
            contact={d}
            modal={activeActivityModal}
            editingEntry={editingActivity}
            onClose={closeActivityModal}
            onDone={() => {
              setTimelineRefresh((n) => n + 1)
              void calls.reload()
            }}
            onField={onField}
            onOpenCompose={() => setComposeOpen(true)}
          />
          <EmailComposeDialog
            open={composeOpen}
            onClose={() => setComposeOpen(false)}
            brandSlug={slug}
            contact={d}
            onLogged={() => {
              onField({ last_contact_at: new Date().toISOString() })
            }}
          />
        </>
      ) : null}

      <Drawer
        open={fieldDrawer !== null}
        onClose={() => setFieldDrawer(null)}
        title="Felder anpassen"
        width={420}
      >
        {activeFieldCfg ? (
          <div className="flex flex-col gap-3" style={{ pointerEvents: 'auto' }}>
            {editFields.map((f, i) => (
              <div
                key={f.id}
                className="rounded-xl p-3"
                style={{
                  border: '1px solid var(--glass-border-1)',
                  background: 'var(--glass-1)',
                }}
              >
                <div className="mb-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="font-mono"
                    disabled={i === 0}
                    onClick={() => {
                      setEditFields((prev) => {
                        if (i <= 0) return prev
                        const next = [...prev]
                        const a = next[i - 1]!
                        const b = next[i]!
                        next[i - 1] = b
                        next[i] = a
                        return next.map((x, ord) => ({ ...x, order: ord }))
                      })
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      opacity: i === 0 ? 0.4 : 1,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="font-mono"
                    disabled={i >= editFields.length - 1}
                    onClick={() => {
                      setEditFields((prev) => {
                        if (i >= prev.length - 1) return prev
                        const next = [...prev]
                        const a = next[i]!
                        const b = next[i + 1]!
                        next[i] = b
                        next[i + 1] = a
                        return next.map((x, ord) => ({ ...x, order: ord }))
                      })
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      opacity: i >= editFields.length - 1 ? 0.4 : 1,
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() => setEditFields((prev) => prev.filter((x) => x.id !== f.id))}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      color: 'var(--accent-coral)',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <input
                  value={f.label}
                  onChange={(e) =>
                    setEditFields((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  style={FIELD}
                />
              </div>
            ))}
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

