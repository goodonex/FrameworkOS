import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { DeleteProjectConfirm } from '../../components/deliver/DeleteProjectConfirm'
import {
  OwnerClientPreviewPhaseContent,
  OwnerDeliverPhaseContent,
} from '../../components/deliver/OwnerDeliverPhaseContent'
import { ProjectTimelinePanel } from '../../components/deliver/ProjectTimelinePanel'
import { OutcomeHeader } from '../../components/phase/OutcomeHeader'
import { PhaseDashboard } from '../../components/phase/PhaseDashboard'
import { useToast } from '../../components/Toast'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useAuth } from '../../hooks/useAuth'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useProjectLeads } from '../../hooks/useProjectLeads'
import { useProjectOutcomes } from '../../hooks/useProjectOutcomes'
import { inviteClient } from '../../lib/inviteClientService'
import { supabase } from '../../lib/supabase'
import { PortalFilesSection } from '../../components/portal/PortalFilesSection'
import { SiteContentAdmin } from '../../components/deliver/SiteContentAdmin'
import {
  createCustomDeliverable,
  DELIVERABLE_TYPE_OPTIONS,
  deliverablesForArea,
} from '../../lib/deliverableCatalog'
import { isPitchProject } from '../../lib/projectAreas'
import type { PhaseKey } from '../../lib/phaseMapping'
import type { DeliverableArea } from '../../types/db'
import type { ClientDocumentLink, DeliverableItem, DeliverProjectStage } from '../../types/db'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import { DELIVER_STAGE_LABEL } from './stageLabels'

function InternalNotesEditor({
  doc,
  onDebouncedSave,
}: {
  doc: Record<string, unknown>
  onDebouncedSave: (next: Record<string, unknown>) => void
}) {
  const debounced = useDebouncedCallback((d: Record<string, unknown>) => {
    onDebouncedSave(d)
  }, 450)

  const editor = useEditor({
    extensions: [StarterKit],
    content: doc,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'deliver-internal-editor',
        style: 'font-family: var(--font-body); min-height: 220px; outline: none;',
      },
    },
    onUpdate: ({ editor: ed }) => {
      debounced(ed.getJSON() as Record<string, unknown>)
    },
  })

  useEffect(() => {
    if (!editor) return
    const a = JSON.stringify(editor.getJSON())
    const b = JSON.stringify(doc)
    if (a !== b) {
      editor.commands.setContent(doc, { emitUpdate: false })
    }
  }, [editor, doc])

  return (
    <div
      className="ck-panel"
      style={{ overflow: 'hidden' }}
    >
      <EditorContent editor={editor} />
    </div>
  )
}

const PITCH_STAGE_ORDER: DeliverProjectStage[] = ['inner_world']
const PITCH_PHASES: PhaseKey[] = ['website']

function StageKanban({
  current,
  onPick,
  stages = DELIVER_STAGE_ORDER,
}: {
  current: DeliverProjectStage
  onPick: (s: DeliverProjectStage) => void
  stages?: DeliverProjectStage[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((s) => {
        const active = s === current
        return (
          <button
            key={s}
            type="button"
            className={`ck-btn${active ? ' ck-btn--primary' : ''}`}
            onClick={() => onPick(s)}
            style={{
              flex: '1 1 100px',
              minWidth: 88,
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            {DELIVER_STAGE_LABEL[s]}
          </button>
        )
      })}
    </div>
  )
}

export function ProjectPage({
  slugOverride,
  projectIdOverride,
  embeddedInTabs = false,
}: {
  slugOverride?: string
  projectIdOverride?: string
  embeddedInTabs?: boolean
} = {}) {
  const params = useParams<{ slug: string; projectId: string }>()
  const slug = slugOverride ?? params.slug
  const projectId = projectIdOverride ?? params.projectId
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { show } = useToast()
  const { user } = useAuth()
  const projects = useDeliverProjects(slug)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteState, setInviteState] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [existingClientUser, setExistingClientUser] = useState<boolean | null>(null)

  useEffect(() => {
    const s = location.state as { showClientInvite?: boolean } | undefined
    if (s?.showClientInvite) {
      setInviteOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const project = useMemo(() => {
    if (!projectId) return null
    return projects.items.find((p) => p.id === projectId) ?? null
  }, [projects.items, projectId])

  const pitchMode = isPitchProject(project)
  const dashboardPhases = pitchMode ? PITCH_PHASES : undefined
  const stageKanbanOrder = pitchMode ? PITCH_STAGE_ORDER : DELIVER_STAGE_ORDER

  const { outcomes, loading: outcomesLoading } = useProjectOutcomes(slug, projectId)
  const { leads } = useProjectLeads(slug, projectId, project?.client_contact_id ?? null)

  const senderName =
    (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) ??
    'Team'

  useEffect(() => {
    if (project?.client_email) setInviteEmail(project.client_email)
    if (project?.client_name) setInviteName(project.client_name)
  }, [project?.id, project?.client_email, project?.client_name])

  // Prefill aus dem verknüpften CRM-Kontakt, wenn das Projekt selbst noch
  // keine Kunden-E-Mail trägt (Deal im CRM → Projekt anlegen → einladen).
  useEffect(() => {
    if (!supabase || !project?.client_contact_id || project.client_email) return
    let cancelled = false
    void supabase
      .from('contacts')
      .select('email, name')
      .eq('id', project.client_contact_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        if (data.email) setInviteEmail((cur) => cur || data.email)
        if (data.name) setInviteName((cur) => cur || data.name)
      })
    return () => {
      cancelled = true
    }
  }, [project?.client_contact_id, project?.client_email])

  const handleDeleteProject = useCallback(async () => {
    if (!project || !slug) return
    setDeleting(true)
    try {
      await projects.remove(project.id)
      show('Projekt gelöscht', 'success')
      setDeleteOpen(false)
      navigate('/projekte')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error')
    } finally {
      setDeleting(false)
    }
  }, [navigate, project, projects, show, slug])

  const [tab, setTab] = useState<'internal' | 'client'>('internal')

  useEffect(() => {
    if (!project) return
    const area = searchParams.get('area')
    if (!area) return
    const stageByArea: Record<string, DeliverProjectStage> = pitchMode
      ? { website: 'inner_world' }
      : {
          branding: 'discover',
          website: 'inner_world',
          leadgen: 'execute',
        }
    const target = stageByArea[area]
    if (!target) return
    setTab('internal')
    if (project.internal_stage !== target) {
      void projects.update(project.id, { internal_stage: target })
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('area')
      return next
    }, { replace: true })
  }, [pitchMode, project, projects, searchParams, setSearchParams])

  const [linksText, setLinksText] = useState('')
  useEffect(() => {
    if (project) setLinksText(project.internal_file_links.join('\n'))
  }, [project?.id, project?.internal_file_links])

  const debouncedLinks = useDebouncedCallback((text: string) => {
    if (!projectId || !slug) return
    const links = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    projects.update(projectId, { internal_file_links: links })
  }, 500)

  const onLinksChange = useCallback(
    (text: string) => {
      setLinksText(text)
      debouncedLinks(text)
    },
    [debouncedLinks],
  )

  const [docs, setDocs] = useState<ClientDocumentLink[]>([])
  useEffect(() => {
    if (project) setDocs(project.client_documents)
  }, [project?.id, project?.client_documents])

  const debouncedDocs = useDebouncedCallback((next: ClientDocumentLink[]) => {
    if (!projectId) return
    projects.update(projectId, { client_documents: next })
  }, 250)

  const patchDocs = useCallback(
    (next: ClientDocumentLink[]) => {
      setDocs(next)
      debouncedDocs(next)
    },
    [debouncedDocs, projectId],
  )

  const [teamLocal, setTeamLocal] = useState('')
  const [welcomeLocal, setWelcomeLocal] = useState('')
  const [deliverablesLocal, setDeliverablesLocal] = useState<DeliverableItem[]>([])
  const [bookingLocal, setBookingLocal] = useState('')
  useEffect(() => {
    if (project) {
      setTeamLocal(project.team_notes)
      setWelcomeLocal(project.client_welcome_text)
      setDeliverablesLocal(project.deliverables)
      setBookingLocal(project.booking_url)
    }
  }, [project?.id, project?.team_notes, project?.client_welcome_text, project?.deliverables, project?.booking_url])

  const debouncedTeamNotes = useDebouncedCallback((id: string, v: string) => {
    projects.update(id, { team_notes: v })
  }, 450)

  const debouncedWelcome = useDebouncedCallback((id: string, v: string) => {
    projects.update(id, { client_welcome_text: v })
  }, 450)

  const debouncedDeliverables = useDebouncedCallback(
    (id: string, list: DeliverableItem[]) => {
      projects.update(id, { deliverables: list })
    },
    450,
  )

  const debouncedBookingUrl = useDebouncedCallback((id: string, v: string) => {
    projects.update(id, { booking_url: v })
  }, 450)

  const patchDeliverables = useCallback(
    (next: DeliverableItem[]) => {
      setDeliverablesLocal(next)
      if (!projectId) return
      debouncedDeliverables(projectId, next)
    },
    [debouncedDeliverables, projectId],
  )

  const onBookingChange = useCallback(
    (v: string) => {
      setBookingLocal(v)
      if (!projectId) return
      debouncedBookingUrl(projectId, v)
    },
    [debouncedBookingUrl, projectId],
  )

  const renderDeliverablesEditor = useCallback(
    (area: DeliverableArea) => {
      const areaItems = deliverablesForArea(deliverablesLocal, area)
      return (
        <div>
          <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
            Deliverables bearbeiten ({area})
          </div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
              Status &amp; URL für Kundenportal
            </span>
            {area === 'branding' ? (
              <button
                type="button"
                className="ck-btn"
                style={{ padding: '5px 9px', color: 'var(--ck-accent)' }}
                onClick={() =>
                  patchDeliverables([...deliverablesLocal, createCustomDeliverable()])
                }
              >
                + Eigene Position
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            {areaItems.map((row) => {
              const i = deliverablesLocal.findIndex((d) => d.id === row.id)
              if (i < 0) return null
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 rounded-xl p-3"
                  style={{ border: '1px solid var(--ck-border-strong)' }}
                >
                  <div className="flex flex-wrap gap-2">
                    {row.type === 'custom' ? (
                      <select
                        value={row.type}
                        onChange={(e) => {
                          const next = deliverablesLocal.slice()
                          const picked = DELIVERABLE_TYPE_OPTIONS.find(
                            (o) => o.type === e.target.value,
                          )
                          next[i] = {
                            ...row,
                            type: e.target.value as DeliverableItem['type'],
                            title: picked?.label ?? row.title,
                            updated_at: new Date().toISOString(),
                          }
                          patchDeliverables(next)
                        }}
                        className="ck-input" style={{ flex: 1, minWidth: 140 }}
                      >
                        {DELIVERABLE_TYPE_OPTIONS.map((o) => (
                          <option key={o.type} value={o.type}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div
                        className="font-mono flex items-center px-3"
                        style={{
                          fontSize: 10,
                          color: 'var(--ck-text-3)',
                          flex: 1,
                          minWidth: 120,
                        }}
                      >
                        {row.title}
                        {row.area ? ` · ${row.area}` : ''}
                      </div>
                    )}
                    <select
                      value={row.status}
                      onChange={(e) => {
                        const status = e.target.value as DeliverableItem['status']
                        const next = deliverablesLocal.slice()
                        next[i] = {
                          ...row,
                          status,
                          updated_at: new Date().toISOString(),
                          added_at:
                            status === 'fertig'
                              ? row.added_at ?? new Date().toISOString()
                              : row.added_at,
                        }
                        patchDeliverables(next)
                      }}
                      className="ck-input" style={{ flex: 1, minWidth: 120 }}
                    >
                      <option value="geplant">Ausstehend</option>
                      <option value="in_arbeit">In Arbeit</option>
                      <option value="fertig">Fertig</option>
                    </select>
                    {row.type === 'custom' ? (
                      <button
                        type="button"
                        className="ck-btn"
                        style={{ padding: '5px 9px', color: 'var(--ck-warn)', borderColor: 'var(--ck-warn)' }}
                        onClick={() => {
                          patchDeliverables(deliverablesLocal.filter((_, j) => j !== i))
                        }}
                      >
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                  {row.type === 'custom' ? (
                    <input
                      type="text"
                      value={row.title}
                      placeholder="Titel"
                      onChange={(e) => {
                        const next = deliverablesLocal.slice()
                        next[i] = {
                          ...row,
                          title: e.target.value,
                          updated_at: new Date().toISOString(),
                        }
                        patchDeliverables(next)
                      }}
                      className="ck-input"
                      style={{ width: '100%' }}
                    />
                  ) : null}
                  <input
                    type="url"
                    value={row.url ?? ''}
                    placeholder="URL / Download-Link (optional)"
                    onChange={(e) => {
                      const next = deliverablesLocal.slice()
                      next[i] = {
                        ...row,
                        url: e.target.value.trim() || undefined,
                        updated_at: new Date().toISOString(),
                      }
                      patchDeliverables(next)
                    }}
                    className="ck-input"
                    style={{ width: '100%' }}
                  />
                  {row.type === 'website_development' ? (
                    <div className="flex items-center gap-2">
                      <label
                        className="font-mono"
                        style={{ fontSize: 10, color: 'var(--ck-text-3)' }}
                      >
                        Fortschritt {row.progress ?? 0}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={row.progress ?? 0}
                        onChange={(e) => {
                          const next = deliverablesLocal.slice()
                          next[i] = {
                            ...row,
                            progress: Number(e.target.value),
                            updated_at: new Date().toISOString(),
                          }
                          patchDeliverables(next)
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )
    },
    [deliverablesLocal, patchDeliverables],
  )

  if (!slug || !projectId) {
    return <Navigate to="/projekte" replace />
  }

  if (!projects.loading && !projects.error && !project) {
    return <Navigate to="/projekte" replace />
  }

  if (projects.loading && !project) {
    return (
      <div
        className="ck-panel animate-pulse"
        style={{ minHeight: 400 }}
      />
    )
  }

  if (!project) return null

  return (
    <motion.div
      key={projectId}
      // ck-deliver schiebt den geteilten Portal-Bausteinen die Cockpit-Werte
      // unter (siehe cockpit.css) — das Portal selbst bleibt unberührt.
      className="ck-deliver"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: 'auto', background: 'transparent' }}
    >
      {/* Eingebettet (Cockpit /projekte) stellt die Hülle den Zurück-Weg —
          sonst stehen zwei „Alle Projekte" übereinander. */}
      {embeddedInTabs ? null : (
        <div className="mb-5">
          <Link to="/projekte" className="ck-btn" style={{ textDecoration: 'none' }}>
            ← Alle Projekte
          </Link>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ck-label">Projekt</div>
          <h1 className="mt-1" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ck-text-1)' }}>
            {project.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="ck-btn" onClick={() => setInviteOpen(true)}>
            Kunden einladen
          </button>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            onClick={() => {
              const origin =
                typeof window !== 'undefined' ? window.location.origin : ''
              const url = `${origin}/portal/${project.id}`
              if (!navigator.clipboard) {
                show('Clipboard nicht verfügbar', 'error')
                return
              }
              void navigator.clipboard.writeText(url).then(
                () =>
                  show(
                    'Link kopiert — teile ihn mit deinem Kunden.',
                    'success',
                  ),
                () => show('Kopieren fehlgeschlagen', 'error'),
              )
            }}
          >
            Portal-Link kopieren
          </button>
          <button
            type="button"
            className="ck-btn"
            onClick={() => window.open(`/portal/${project.id}?als=kunde`, '_blank', 'noopener')}
            title="Portal genau so sehen, wie es dein Kunde sieht"
          >
            Als Kunde ansehen
          </button>
          <button
            type="button"
            className="ck-btn"
            onClick={() => setDeleteOpen(true)}
            style={{
              color: 'var(--ck-warn)',
              borderColor: 'color-mix(in srgb, var(--ck-warn) 40%, var(--ck-border-strong))',
            }}
          >
            Projekt löschen
          </button>
          {project.brand_id ? (
            <button
              type="button"
              className="ck-btn"
              onClick={() => {
                const origin =
                  typeof window !== 'undefined' ? window.location.origin : ''
                const url = `${origin}/onboarding/${project.brand_id}`
                if (!navigator.clipboard) {
                  show('Clipboard nicht verfügbar', 'error')
                  return
                }
                void navigator.clipboard.writeText(url).then(
                  () => show('Fragebogen-Link kopiert', 'success'),
                  () => show('Kopieren fehlgeschlagen', 'error'),
                )
              }}
              title="Onboarding-Fragebogen für den Kunden"
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M7 9.5 L4.5 12 a2 2 0 0 1 -2.8 -2.8 L4 7" />
                <path d="M9 6.5 L11.5 4 a2 2 0 0 1 2.8 2.8 L12 9" />
                <path d="M6 10 L10 6" />
              </svg>
              Fragebogen-Link
            </button>
          ) : null}
        </div>
      </div>

      {/* Ansicht-Umschalter — eigene Zeile, damit er nicht als sechste Aktion
          zwischen den Knöpfen verschwindet. */}
      <nav aria-label="Projekt-Ansicht" className="mb-4 flex gap-1.5">
        {(['internal', 'client'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`ck-nav-item${tab === t ? ' active' : ''}`}
            style={{ padding: '6px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {t === 'internal' ? 'Intern' : 'Kundenbereich'}
          </button>
        ))}
      </nav>

      {projects.error ? (
        <p style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{projects.error}</p>
      ) : null}

      {tab === 'internal' ? (
        <div className="flex flex-col gap-5">
          <OutcomeHeader
            outcomes={outcomes}
            projectName={project.name}
            startedAt={project.updated_at}
            loading={outcomesLoading}
          />

          <PhaseDashboard
            currentStage={project.internal_stage}
            deliverables={deliverablesLocal}
            stageDurations={project.stage_durations}
            leadCount={leads.length}
            phases={dashboardPhases}
            renderPhaseContent={(phase) => (
              <OwnerDeliverPhaseContent
                phase={phase}
                project={{ ...project, deliverables: deliverablesLocal }}
                slug={slug}
                senderName={senderName}
                renderDeliverablesEditor={renderDeliverablesEditor}
              />
            )}
          />

          <ProjectTimelinePanel
            project={project}
            onStageChange={(s) => void projects.update(project.id, { internal_stage: s })}
          />
          <div>
            <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
              Interne Projekt-Stages
            </div>
            <StageKanban
              current={project.internal_stage}
              stages={stageKanbanOrder}
              onPick={(s) => void projects.update(project.id, { internal_stage: s })}
            />
          </div>
          <div>
            <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
              Freie Notizen
            </div>
            <InternalNotesEditor
              doc={project.internal_notes_doc}
              onDebouncedSave={(d) => projects.update(project.id, { internal_notes_doc: d })}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
              Interne Dateien (eine URL pro Zeile)
            </label>
            <textarea
              value={linksText}
              onChange={(e) => onLinksChange(e.target.value)}
              rows={4}
              className="ck-input" style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--ck-font)' }}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
              Team-Notizen
            </label>
            <textarea
              value={teamLocal}
              onChange={(e) => {
                const v = e.target.value
                setTeamLocal(v)
                debouncedTeamNotes(project.id, v)
              }}
              rows={4}
              className="ck-input" style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
              Calendly oder Buchungs-Link (Kundenportal)
            </label>
            <input
              type="url"
              value={bookingLocal}
              onChange={(e) => onBookingChange(e.target.value)}
              placeholder="https://…"
              className="ck-input"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <OutcomeHeader
            outcomes={outcomes}
            projectName={project.name}
            startedAt={project.updated_at}
            loading={outcomesLoading}
          />

          <div className="font-mono mb-1" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
            Vorschau — Kundenportal (client_stage)
          </div>

          <PhaseDashboard
            currentStage={project.client_stage}
            deliverables={deliverablesLocal}
            stageDurations={project.stage_durations}
            leadCount={leads.length}
            readOnlyDeliverables
            phases={dashboardPhases}
            renderPhaseContent={(phase) => (
              <OwnerClientPreviewPhaseContent
                phase={phase}
                project={{ ...project, deliverables: deliverablesLocal }}
              />
            )}
          />

          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
              Willkommenstext (sichtbar für Kunden)
            </label>
            <textarea
              value={welcomeLocal}
              onChange={(e) => {
                const v = e.target.value
                setWelcomeLocal(v)
                debouncedWelcome(project.id, v)
              }}
              rows={4}
              className="ck-input" style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <div>
            <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
              Kunden-Stages (Kanban)
            </div>
            <StageKanban
              current={project.client_stage}
              stages={stageKanbanOrder}
              onPick={(s) => void projects.update(project.id, { client_stage: s })}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
                Dokumente &amp; Links
              </span>
              <button
                type="button"
                className="ck-btn"
                style={{ padding: '5px 9px', color: 'var(--ck-accent)' }}
                onClick={() =>
                  patchDocs([
                    ...docs,
                    { label: 'Neu', url: '', description: undefined },
                  ])
                }
              >
                + Zeile
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {docs.map((row, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl p-3" style={{ border: '1px solid var(--ck-border-strong)' }}>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={row.label}
                      onChange={(e) => {
                        const next = docs.slice()
                        next[i] = { ...row, label: e.target.value }
                        patchDocs(next)
                      }}
                      className="ck-input" style={{ flex: 1, minWidth: 120 }}
                    />
                    <input
                      type="text"
                      placeholder="https://…"
                      value={row.url}
                      onChange={(e) => {
                        const next = docs.slice()
                        next[i] = { ...row, url: e.target.value }
                        patchDocs(next)
                      }}
                      className="ck-input" style={{ flex: 2, minWidth: 160 }}
                    />
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ padding: '5px 9px', color: 'var(--ck-warn)', borderColor: 'var(--ck-warn)' }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Dieses Dokument aus dem Kundenportal entfernen?',
                          )
                        )
                          return
                        patchDocs(docs.filter((_, j) => j !== i))
                      }}
                    >
                      Entfernen
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Optionale Beschreibung (nur Kundenportal)"
                    value={row.description ?? ''}
                    onChange={(e) => {
                      const next = docs.slice()
                      const v = e.target.value.trim()
                      next[i] = {
                        ...row,
                        description: v ? v : undefined,
                      }
                      patchDocs(next)
                    }}
                    className="ck-input" style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="ck-panel" style={{ padding: 20, marginTop: 16 }}>
            <PortalFilesSection
              projectId={project.id}
              documents={project.client_documents}
              dark
              canDelete
              title="Geteilte Dateien (Portal)"
            />
          </div>

          <SiteContentAdmin projectId={project.id} />
        </div>
      )}

      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Kunden einladen"
        width={400}
      >
        <div className="flex flex-col gap-4">
          <p className="font-mono" style={{ fontSize: 12, color: 'var(--ck-text-2)', lineHeight: 1.55 }}>
            Der Kunde erhält eine E-Mail und legt einmalig sein eigenes Passwort fest — danach
            meldet er sich jederzeit mit E-Mail + Passwort an. Bestehende Accounts werden mit
            diesem Projekt verknüpft.
          </p>
          {existingClientUser !== null ? (
            <p className="font-mono" style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
              {existingClientUser
                ? 'Hinweis: Es existiert bereits ein Account mit dieser E-Mail.'
                : 'Neuer Account wird angelegt.'}
            </p>
          ) : null}
          {inviteState === 'sent' ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--ck-accent)' }}>
              Einladung gesendet. Der Kunde sollte die E-Mail in wenigen Minuten erhalten.
            </p>
          ) : null}
          {inviteError ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--ck-warn)' }}>
              {inviteError}
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
              Name des Kunden
            </span>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Max Mustermann"
              className="ck-input"
              style={{ width: '100%' }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--ck-text-3)' }}>
              E-Mail des Kunden
            </span>
            <input
              type="email"
              autoComplete="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="kunde@firma.de"
              className="ck-input"
              style={{ width: '100%' }}
            />
          </label>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            disabled={inviteState === 'sending'}
            style={{ justifyContent: 'center', padding: '10px 16px' }}
            onClick={() => {
              if (!inviteEmail.trim()) {
                show('Bitte eine E-Mail eingeben.', 'error')
                return
              }
              setInviteState('sending')
              setInviteError(null)
              void inviteClient({
                project_id: project.id,
                client_email: inviteEmail.trim(),
                client_name: inviteName.trim() || undefined,
              }).then(async (result) => {
                if (result.success) {
                  setInviteState('sent')
                  setExistingClientUser(result.existing_user ?? false)
                  show('Einladung gesendet.', 'success')
                  await projects.update(project.id, {
                    client_email: inviteEmail.trim(),
                    client_name: inviteName.trim() || project.client_name,
                    client_stage: project.client_stage || 'onboarding',
                  })
                  await projects.reload()
                } else {
                  setInviteState('error')
                  setInviteError(result.detail ?? result.error ?? 'Einladung fehlgeschlagen')
                  show(result.detail ?? result.error ?? 'Einladung fehlgeschlagen', 'error')
                }
              })
            }}
          >
            {inviteState === 'sending' ? 'Wird gesendet…' : 'Einladung senden'}
          </button>
        </div>
      </Drawer>

      <DeleteProjectConfirm
        open={deleteOpen}
        projectName={project.name}
        busy={deleting}
        onCancel={() => !deleting && setDeleteOpen(false)}
        onConfirm={() => void handleDeleteProject()}
      />
    </motion.div>
  )
}
