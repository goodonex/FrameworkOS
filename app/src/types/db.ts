export type ModeKey =
  | 'building'
  | 'promo'
  | 'sales'
  | 'intelligence'
  | 'discovery'
  | 'deliver'

export type AssetType = 'website' | 'instagram' | 'linkedin' | 'document' | 'social'

export type SocialPlatform =
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'twitter'

export interface Asset {
  id: string
  brand_id: string
  name: string
  type: AssetType
  url: string
  embed: boolean
  notes: string
  social_platform?: SocialPlatform | null
  created_at: string
  updated_at: string
}

export interface SOP {
  id: string
  brand_id: string
  title: string
  content: Record<string, unknown>
  category: string
  updated_at: string
}

/** Standalone Business Model doc (localStorage key …:businessmodel). */
export interface BusinessModelDoc {
  id: string
  brand_id: string
  who: string
  what: string
  how: string
  for_whom: string
  revenue: string
  updated_at: string
}

export interface Brand {
  id: string
  user_id: string | null
  name: string
  slug: string
  color: string
  created_at: string
}

export type ICPPriority = 1 | 2 | 3

export interface ICP {
  id: string
  brand_id: string
  name: string
  age_range: string
  location: string
  pain_points: string[]
  word_clusters: string[]
  priority: ICPPriority
  notes: string
  updated_at: string
}

export type WordBankType = 'yes' | 'no'

export interface WordBankEntry {
  id: string
  brand_id: string
  word: string
  type: WordBankType
  cluster: string
  updated_at: string
}

export interface BusinessModel {
  who: string
  what: string
  how: string
  for_whom: string
  revenue: string
}

export interface Positioning {
  id: string
  brand_id: string
  statement: string
  tone_of_voice: string
  business_model: BusinessModel | null
  updated_at: string
}

/* --- Discovery Mode (Phase 3) --- */

export type DiscoveryFeedCategory =
  | 'competitor'
  | 'format'
  | 'trend'
  | 'icp_search'

export interface DiscoveryIcpDraft {
  name: string
  age_range: string
  location: string
  pain_hint: string
}

export interface DiscoveryWordSuggestion {
  word: string
  type: WordBankType
  cluster: string
}

export type DiscoveryAnalysisStatus =
  | 'idle'
  | 'running'
  | 'complete'
  | 'error'

export interface DiscoveryContentFormatInsight {
  format_name: string
  rationale: string
}

export interface DiscoveryCompetitorInsightBrief {
  headline: string
  detail: string
}

export interface DiscoveryAnalysis {
  icp_drafts: DiscoveryIcpDraft[]
  word_bank_suggestions: DiscoveryWordSuggestion[]
  positioning_ideas: string[]
  /** Aus Claude-Analyse */
  content_formats?: DiscoveryContentFormatInsight[]
  competitor_insights?: DiscoveryCompetitorInsightBrief[]
  tone_of_voice?: string
  /** Gekürzte Perplexity-Auszüge (optional) */
  research_snippets?: string[]
}

export interface DiscoveryFoundationDoc {
  id: string
  brand_id: string
  market: string
  competitors: string
  niche: string
  analysis: DiscoveryAnalysis | null
  analysis_run_at: string | null
  analysis_status?: DiscoveryAnalysisStatus
  updated_at: string
}

export interface DiscoveryFeedItem {
  id: string
  brand_id: string
  category: DiscoveryFeedCategory
  title: string
  summary: string
  signal_strength: 'low' | 'medium' | 'high'
  recorded_at: string
  archived_at?: string | null
}

export type DiscoveryFeedIntervalDays = 1 | 7 | 14

export interface DiscoverySettingsDoc {
  feed_interval_days: DiscoveryFeedIntervalDays
  last_feed_generated_at: string | null
  updated_at: string
}

/* --- Promo Mode (Phase 4) --- */

export type ContentFormat =
  | 'post'
  | 'reel'
  | 'story'
  | 'article'
  | 'email'
  | 'carousel'
  | 'other'

export type ContentChannel =
  | 'instagram'
  | 'linkedin'
  | 'website'
  | 'email'
  | 'tiktok'
  | 'other'

export type ContentGoal =
  | 'awareness'
  | 'leads'
  | 'nurture'
  | 'sales'
  | 'other'

export interface ContentPieceTags {
  icp_ids: string[]
  cluster_tags: string[]
  format: ContentFormat
  channel: ContentChannel
  goal: ContentGoal
}

export interface ContentPerformanceManual {
  impressions: number | null
  engagements: number | null
  leads: number | null
  notes: string
  updated_at: string | null
}

/** Platzhalter für Instagram / LinkedIn APIs — später echte Keys & Sync. */
export interface ContentPerformanceApiStub {
  instagram_last_sync_at: string | null
  linkedin_last_sync_at: string | null
  instagram_metrics_json: Record<string, unknown> | null
  linkedin_metrics_json: Record<string, unknown> | null
}

export interface ContentPiece {
  id: string
  brand_id: string
  title: string
  content: Record<string, unknown>
  /** Kalender-Datum (YYYY-MM-DD oder ISO mit Zeit) */
  scheduled_at: string
  published_at: string | null
  campaign_id: string | null
  tags: ContentPieceTags
  performance_manual: ContentPerformanceManual
  performance_api: ContentPerformanceApiStub
  updated_at: string
}

export interface Campaign {
  id: string
  brand_id: string
  name: string
  goal: string
  start_at: string
  end_at: string | null
  content_piece_ids: string[]
  updated_at: string
}

/* --- Sales CRM (Phase 5) --- */

export type PipelineStage =
  | 'first_contact'
  | 'conversation'
  | 'follow_up'
  | 'proposal'
  | 'deal'
  | 'paused'

export interface ContactActivityEntry {
  id: string
  text: string
  /** ISO timestamp */
  at: string
}

export type PotenzialTyp = 'einmalig' | 'monatlich' | 'jährlich'

export type LeadQuality = 'unqualified' | 'good' | 'bad'

export type ContactType = 'company' | 'person'

export type ContactStatus =
  | 'not_contacted'
  | 'not_reached'
  | 'in_contact'
  | 'high_potential'
  | 'followup_planned'
  | 'offer_made'
  | 'unqualified'
  | 'deal_won'
  | 'customer_inactive'
  | 'deal_lost'

export type LeadSource =
  | ''
  | 'cold'
  | 'referral'
  | 'linkedin'
  | 'website'
  | 'event'
  | 'other'

export type FollowUpType = '' | 'call' | 'meeting' | 'email' | 'other'

export type ContactListType = 'static' | 'dynamic'

export interface Contact {
  id: string
  brand_id: string
  contact_type: ContactType
  parent_company_id: string | null
  contact_status: ContactStatus
  first_name: string
  last_name: string
  job_title: string
  address: string
  lead_source: LeadSource
  follow_up_type: FollowUpType
  name: string
  email: string
  phone: string
  website: string
  instagram: string
  linkedin: string
  company: string
  source_content_piece_id: string | null
  source_campaign_id: string | null
  source_funnel_id: string | null
  lead_quality: LeadQuality
  lead_value: number | null
  pipeline_stage: PipelineStage
  last_contact_at: string | null
  /**
   * O2 (06.08.2026) — Zuständigkeitsgrenze, festgeschrieben:
   * `contacts.next_follow_up_at` trägt **Kunden- und Deal-Follow-ups**.
   * Der LinkedIn-Funnel (wer im Postfach als Nächstes dran ist) läuft
   * ausschließlich über `linkedin_threads` (`followup_stage`/`last_message_at`).
   * Wer noch in `first_contact` steht, gehört dorthin und nicht hierher —
   * `dueFollowupContacts` (cockpit/lib/approvalDrafts.ts) setzt das durch.
   */
  next_follow_up_at: string | null
  notes: string
  call_notes: string
  activity_log: ContactActivityEntry[]
  /** Erstgespräch */
  bedarf: string
  ansprechpartner: string
  aktuelle_situation: string
  hauptproblem: string
  timeline: string
  /** Qualifikation */
  budget: string
  ist_entscheider: boolean
  entscheider_name: string
  einwaende: string
  naechste_schritte: string
  abschluss_wahrscheinlichkeit: number
  /** Geschätzter Auftragswert EUR */
  potenzial_betrag: number
  potenzial_typ: PotenzialTyp
  potenzial_notiz: string
  /** Konfigurierbare Felder, key = Feld-id */
  custom_fields: Record<string, string | number | boolean>
  /** Sales-Pro */
  pipeline_id?: string | null
  tags?: string[]
  stage_changed_at?: string | null
  won_at?: string | null
  lost_at?: string | null
  lost_reason?: string
  referred_by_id?: string | null
  referral_source?: string
  /** Deliver-Portal: zugeordnetes Projekt */
  deliver_project_id?: string | null
  /** Client-sichtbarer Lead-Status im Portal */
  portal_lead_status?: PortalLeadStatus
  /** Client-Notizen pro Lead im Portal-CRM */
  portal_notes?: string | null
  created_at?: string
  updated_at: string
}

export type LinkedinThreadStatus = 'active' | 'waiting_reply' | 'won' | 'lost' | 'archived'
export type LinkedinLastFrom = 'me' | 'them' | 'unknown'
export type LoomStatus = 'offen' | 'aufgenommen' | 'verschickt' | 'entfaellt'

/** Eine Nachricht im gespiegelten Gesprächsverlauf (0064). */
export interface LinkedinNachricht {
  sender: LinkedinLastFrom
  text: string
  /** ISO-Zeitstempel; null, wenn Voyager keinen brauchbaren geliefert hat. */
  ts: string | null
}

/**
 * Siehe supabase/migrations/0058_linkedin_threads.sql + 0061_loom_status.sql.
 *
 * O2 (06.08.2026) — Zuständigkeitsgrenze, festgeschrieben:
 * `linkedin_threads` ist die **einzige** Wahrheit für den LinkedIn-Funnel —
 * wer im Postfach als Nächstes dran ist, entscheidet `followup_stage` gegen
 * `last_message_at`, nicht `contacts.next_follow_up_at`. Kunden- und
 * Deal-Follow-ups liegen umgekehrt allein an `contacts`.
 * Die beiden Mengen sind heute fast disjunkt (2 von 44 Kontakten haben einen
 * Thread) — `contact_id` ist die Brücke, wenn ein Lead zum Deal wird.
 */
export interface LinkedinThread {
  id: string
  brand_id: string
  thread_key: string
  contact_id: string | null
  name: string
  company: string
  profile_url: string
  preview: string
  last_message_at: string | null
  last_from: LinkedinLastFrom
  unread: boolean
  /** LinkedIn-Stern = Lead hat Ja zur Loom-Analyse gesagt. */
  starred: boolean
  followup_stage: number
  snoozed_until: string | null
  status: LinkedinThreadStatus
  first_seen_at: string
  last_synced_at: string
  /** 0061: Status des zugesagten Looms — nur relevant, wenn `starred`. */
  loom_status: LoomStatus
  loom_erledigt_at: string | null
  /**
   * 0064: die letzten ~10 Nachrichten, älteste zuerst. Optional, weil die Spalte
   * vor der Migration schlicht fehlt — immer über `verlaufVon()` lesen.
   */
  verlauf?: LinkedinNachricht[]
  /** 0065: versandfertiger Antwort-Entwurf des Agenten; null = keiner offen. */
  entwurf?: string | null
  /** 0065: wann der Entwurf entstand — älter als `last_message_at` heißt veraltet. */
  entwurf_at?: string | null
  /** 0065: Run, aus dem der Entwurf stammt (Nachvollziehbarkeit). */
  entwurf_run_id?: string | null
  /**
   * 0075: Was der Entwurfs-Agent nach dem Lesen der NACHRICHT über die Person
   * urteilt — die Headline allein reicht nicht (`icpRegeln.json` hielt Coaches
   * für Leads und Makler für Fremde). `null` = noch nicht beurteilt und zählt
   * wie `lead`; `akquise` fliegt aus der Antworten-Spur.
   */
  agent_urteil?: AgentUrteil | null
  /** 0075: wann das Urteil entstand. */
  agent_urteil_at?: string | null
  /** 0076: Verweis auf den Lead. Der Sync schickt die Spalte nie mit. */
  lead_id?: string | null
}

/** 0075: Urteil des Entwurfs-Agenten über den Absender eines Threads. */
export type AgentUrteil = 'lead' | 'kontakt' | 'akquise'

export type SalesFieldType = 'textarea' | 'text' | 'number' | 'toggle'

export interface SalesFieldItem {
  id: string
  label: string
  placeholder: string
  type: SalesFieldType
  required: boolean
  order: number
  /** contacts-Spalte oder Key in custom_fields */
  db_key: string
}

export interface SalesFieldConfigRow {
  id: string
  brand_id: string
  tab: 'erstgespraech' | 'qualifikation'
  fields: SalesFieldItem[]
  created_at: string
  updated_at: string
}

/** Promo: Ideen-Tabelle (Migration 0020) */
export type ContentIdeaFormat =
  | 'post'
  | 'reel'
  | 'story'
  | 'mail'
  | 'artikel'
  | 'karussell'
  | 'ad'

export type ContentIdeaStatus = 'idee' | 'skript' | 'produktion' | 'fertig'

export interface ContentIdea {
  id: string
  brand_id: string
  title: string
  hook: string
  a_roll: string
  b_roll: string
  skript: string
  format: string
  kanal: string
  status: string
  woche: number | null
  created_at: string
}

export interface ContentSequencePlanPiece {
  format: string
  titel: string
  kanal: string
}

export interface ContentSequencePlanWeek {
  woche: number
  thema: string
  pieces: ContentSequencePlanPiece[]
}

export interface ContentSequence {
  id: string
  brand_id: string
  name: string
  description: string
  wochen: number
  plan: ContentSequencePlanWeek[]
  status: string
  /** 'content' = Social/Kalender, 'email' = E-Mail-Sequenzen */
  sequence_kind: 'content' | 'email'
  created_at: string
}

export type ContactListItemStatus =
  | 'offen'
  | 'angerufen'
  | 'kein_interesse'
  | 'in_pipeline'

export interface ContactList {
  id: string
  brand_id: string
  name: string
  description: string | null
  is_favorite: boolean
  is_hidden: boolean
  list_type: ContactListType
  filter_json: Record<string, unknown> | null
  created_at: string
}

export interface ContactListItem {
  id: string
  list_id: string
  name: string
  email: string
  phone: string
  company: string
  linkedin_url: string
  ansprechpartner: string
  standort: string
  aufhaenger_angriffsflaeche: string
  outcome: string
  prio: string
  im_crm: boolean | null
  g_ads: string
  keyword: string
  website: string
  notes: string
  status: ContactListItemStatus
  called_at: string | null
  created_at: string
}

export type PortalLeadStatus = 'new' | 'contacted' | 'qualified' | 'closed' | 'lost'

export const PORTAL_LEAD_STATUS_LABEL: Record<PortalLeadStatus, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  closed: 'Abgeschlossen',
  lost: 'Verloren',
}

export type DeliverableStatus = 'geplant' | 'in_arbeit' | 'fertig'

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  geplant: 'Ausstehend',
  in_arbeit: 'In Arbeit',
  fertig: 'Fertig',
}

export type DeliverableType =
  | 'brand_strategy'
  | 'logo'
  | 'brand_guidelines'
  | 'color_palette'
  | 'typography'
  | 'moodboard'
  | 'sitemap'
  | 'design_concept'
  | 'website_development'
  | 'website_live_url'
  | 'performance_score'
  | 'custom'

export type DeliverableArea = 'branding' | 'website' | 'leadgen'

export interface DeliverableItem {
  id: string
  type?: DeliverableType
  title: string
  status: DeliverableStatus
  updated_at: string
  url?: string
  description?: string
  added_at?: string
  progress?: number
  area?: DeliverableArea
}

export type DeliverProjectStage =
  | 'onboarding'
  | 'discover'
  | 'inner_world'
  | 'visual_world'
  | 'execute'

export const DELIVER_STAGE_ORDER: DeliverProjectStage[] = [
  'onboarding',
  'discover',
  'inner_world',
  'visual_world',
  'execute',
]

export interface ClientDocumentLink {
  label: string
  url: string
  /** Optional — Kurzbeschreibung im Kundenportal */
  description?: string
}

export type DeliverStageDurations = Record<DeliverProjectStage, string>

export const DEFAULT_STAGE_DURATIONS: DeliverStageDurations = {
  onboarding: '1 Woche',
  discover: '2 Wochen',
  inner_world: '2 Wochen',
  visual_world: '3 Wochen',
  execute: '4 Wochen',
}

export interface DeliverProject {
  id: string
  brand_id: string
  name: string
  client_name: string
  client_email: string
  client_contact_id: string | null
  status: 'active' | 'completed'
  internal_stage: DeliverProjectStage
  client_stage: DeliverProjectStage
  /** Tiptap JSON */
  internal_notes_doc: Record<string, unknown>
  internal_file_links: string[]
  team_notes: string
  client_welcome_text: string
  client_documents: ClientDocumentLink[]
  deliverables: DeliverableItem[]
  booking_url: string
  stage_durations: DeliverStageDurations
  deleted_at: string | null
  /**
   * Anlagedatum — letzter Anker für `liegtSeitTagen` (kundenarbeit.ts, D1).
   * Die Tabelle `deliver_projects` (0008) hat diese Spalte **nicht**; das Feld ist
   * deshalb heute überall `null` und füllt sich von selbst, sobald sie nachgezogen wird.
   */
  created_at: string | null
  updated_at: string
}

export interface ProjectMessage {
  id: string
  project_id: string
  sender_role: 'owner' | 'client'
  sender_name: string | null
  body: string
  read_at: string | null
  deleted_at: string | null
  created_at: string
}

/* --- Intelligence / Focus (Phase 6) --- */

export type FocusTaskImpact = 'high' | 'medium' | 'low'

export type FocusTaskSource =
  | 'promo'
  | 'sales'
  | 'discovery'
  | 'building'
  | 'intelligence'

export interface FocusTask {
  id: string
  brand_id: string
  title: string
  detail: string
  impact: FocusTaskImpact
  source: FocusTaskSource
  related_ids: string[]
  created_at: string
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 1 | 2 | 3
export type TaskSource = 'manual' | 'follow_up' | 'system' | 'onboarding' | 'brief_task'

export interface Task {
  id: string
  brand_id: string
  contact_id: string | null
  project_id: string | null
  title: string
  notes: string
  due_at: string | null
  status: TaskStatus
  priority: TaskPriority
  source: TaskSource
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ===== Sales-Pro =====

export interface PipelineStageDef {
  key: string
  label: string
  accent?: string
  won?: boolean
  lost?: boolean
}

export interface SalesPipeline {
  id: string
  brand_id: string
  name: string
  slug: string
  stages: PipelineStageDef[]
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SalesEmailTemplate {
  id: string
  brand_id: string
  name: string
  subject: string
  body: string
  stage: string | null
  variables: string[]
  sort_order: number
  last_used_at: string | null
  use_count: number
  created_at: string
  updated_at: string
}

export type ActivityEntryType =
  | 'presetting'
  | 'setting'
  | 'closing'
  | 'terminierung'
  | 'unqualified'
  | 'noshow'
  | 'followup'
  | 'formular'
  | 'notiz'
  | 'call'

export interface ActivityEntry {
  id: string
  brand_id: string
  contact_id: string
  activity_type: ActivityEntryType
  performed_by: string | null
  data: Record<string, unknown>
  created_at: string
}

export type OpportunityProduct = 'herrmann' | 'wertavio' | 'culturefit'
export type OpportunityStage =
  | 'erstkontakt'
  | 'gespraech'
  | 'pitch'
  | 'deal'
  | 'pause'
  | 'verloren'

export interface Opportunity {
  id: string
  contact_id: string
  product: OpportunityProduct
  stage: OpportunityStage
  notes: string
  created_at: string
  updated_at: string
}

export type SalesEmailDirection = 'outbound' | 'inbound'

export interface SalesEmailLog {
  id: string
  brand_id: string
  contact_id: string
  template_id: string | null
  direction: SalesEmailDirection
  subject: string
  body_preview: string
  sent_at: string
  opened_at: string | null
  replied_at: string | null
  bounced_at: string | null
  tracking_id: string | null
  resend_id: string
  from_email: string
  from_name: string
  to_email: string
  sequence_id: string | null
  enrollment_id: string | null
  created_at: string
  updated_at: string
}

// =================================================================
// E-Mail-Sequenzen (Whiteboard-Builder + Auto-Send)
// =================================================================

export type SequenceNodeType = 'start' | 'wait' | 'email' | 'condition' | 'end'

export type SequenceConditionCheck =
  | 'opened'
  | 'replied'
  | 'not_opened'
  | 'not_replied'

export interface SequenceNodeConfig {
  delay_days?: number
  delay_hours?: number
  template_id?: string | null
  subject?: string
  body?: string
  check?: SequenceConditionCheck
  within_days?: number
  label?: string
}

export interface SequenceNode {
  id: string
  type: SequenceNodeType
  position: { x: number; y: number }
  config: SequenceNodeConfig
  next?: string | null
  next_no?: string | null
}

export interface EmailSequence {
  id: string
  brand_id: string
  name: string
  slug: string
  description: string
  nodes: SequenceNode[]
  active: boolean
  from_email: string
  from_name: string
  created_at: string
  updated_at: string
}

// =================================================================
// Ads (Builder + Tracking + Lead-Intake)
// =================================================================

export type AdPlatform = 'linkedin' | 'meta' | 'google' | 'tiktok' | 'other'
export type AdStatus = 'draft' | 'live' | 'paused' | 'ended'

export interface AdCampaign {
  id: string
  brand_id: string
  name: string
  platform: AdPlatform
  status: AdStatus
  hook: string
  body: string
  cta: string
  target_url: string
  tracking_url: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  budget_total: number
  budget_spent: number
  cost_per_lead: number
  start_date: string | null
  end_date: string | null
  clicks_count: number
  leads_count: number
  created_at: string
  updated_at: string
}

export interface AdClick {
  id: string
  campaign_id: string
  brand_id: string
  clicked_at: string
  referrer: string
  user_agent: string
  ip_hash: string
  utm_content: string
}

// =================================================================
// Recruiting (Stellenanzeigen)
// =================================================================

export type RecruitingJobStatus = 'draft' | 'active' | 'paused' | 'closed'
export type RecruitingJobFormat =
  | 'linkedin_organic'
  | 'linkedin_ad'
  | 'culturefit'
  | 'other'

export interface RecruitingJob {
  id: string
  brand_id: string
  title: string
  description: string
  requirements: string
  benefits: string
  format: RecruitingJobFormat
  status: RecruitingJobStatus
  external_url: string
  utm_campaign: string
  utm_source: string
  utm_medium: string
  views_count: number
  applications_count: number
  created_at: string
  updated_at: string
}

export type SequenceEnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'error'

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id: string
  brand_id: string
  status: SequenceEnrollmentStatus
  current_node_id: string
  next_run_at: string
  started_at: string
  completed_at: string | null
  last_error: string
  history: Array<{ node_id: string; at: string; result?: string }>
}

export type SalesCallOutcome =
  | 'connected'
  | 'no_pickup'
  | 'voicemail'
  | 'wrong_number'
  | 'callback_requested'

export interface SalesCallLog {
  id: string
  brand_id: string
  contact_id: string
  outcome: SalesCallOutcome
  duration_seconds: number | null
  notes: string
  called_at: string
  created_at: string
}

export type SalesGoalPeriod = 'week' | 'month'

export interface SalesGoal {
  id: string
  brand_id: string
  period: SalesGoalPeriod
  period_start: string
  calls_target: number
  mails_target: number
  meetings_target: number
  deals_target: number
  linkedin_target: number
  qualifications_target: number
  created_at: string
  updated_at: string
}

export interface SalesViewFilter {
  stage?: string | null
  pipelineId?: string | null
  potential?: string | null
  follow?: string | null
  tags?: string[]
  search?: string
}

export interface DailyMetricTargets {
  id: string
  brand_id: string
  dial_attempts_target: number
  linkedin_target: number
  pitches_target: number
  created_at: string
  updated_at: string
}

export interface BusinessTargetMilestone {
  id: string
  label: string
  quarter: string
  target_date: string
  completed?: boolean
}

export interface BusinessTarget {
  id: string
  brand_id: string
  period_label: string
  north_star_mrr: number
  north_star_deadline: string
  mrr_dec_target: number
  total_revenue_target: number
  new_customers_target: number
  margin_min: number
  margin_max: number
  hire_trigger_mrr: number
  hire_trigger_profit: number
  milestones: BusinessTargetMilestone[]
  created_at: string
  updated_at: string
}

export interface WeeklyReviewSnapshot {
  conversations: number
  pitches: number
  deals: number
  newCustomers: Array<{ name: string; product: string }>
  projectRevenue: number
  newMrr: number
  youtubePublished: boolean
  linkedinPosts: number
  badLeads: number
  churnWarnings: number
}

export interface WeeklyReview {
  id: string
  brand_id: string
  week_start: string
  snapshot: WeeklyReviewSnapshot
  notes: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface MonthlySnapshot {
  id: string
  brand_id: string
  month: string
  mrr: number
  mrr_override: number | null
  mrr_delta: number
  project_revenue: number
  total_revenue: number
  active_customers: number
  churn_rate: number
  new_customers: number
  ads_cpl: number | null
  ads_cpk: number | null
  created_at: string
  updated_at: string
}

export interface SalesView {
  id: string
  brand_id: string
  name: string
  filter: SalesViewFilter
  is_pinned: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AvailabilitySlot {
  from: string // 'HH:MM'
  to: string
}

export interface AvailabilityWeek {
  mon?: AvailabilitySlot[]
  tue?: AvailabilitySlot[]
  wed?: AvailabilitySlot[]
  thu?: AvailabilitySlot[]
  fri?: AvailabilitySlot[]
  sat?: AvailabilitySlot[]
  sun?: AvailabilitySlot[]
}

export interface SalesMeetingLink {
  id: string
  brand_id: string
  slug: string
  title: string
  description: string
  duration_minutes: number
  availability: AvailabilityWeek
  buffer_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type SalesBookingStatus = 'confirmed' | 'cancelled' | 'no_show' | 'done'

export interface SalesBooking {
  id: string
  brand_id: string
  meeting_link_id: string | null
  contact_id: string | null
  name: string
  email: string
  phone: string
  message: string
  starts_at: string
  ends_at: string
  status: SalesBookingStatus
  cancelled_at: string | null
  created_at: string
}

/* ── 0076: Lead-System ─────────────────────────────────────────────────────
 * Die Identitäts- und Protokollschicht unter den LinkedIn-Spiegeln.
 * Blaupause: docs/wargames/lead-system.md
 */

export type LeadStatus = 'aktiv' | 'wiedervorlage' | 'ruht' | 'disqualifiziert' | 'kunde'

export interface Lead {
  id: string
  brand_id: string
  /** Lesbarer Slug aus `linkedin_netzwerk`; '' bei Leads, die nur im Postfach stehen. */
  profil_key: string
  /** Opake LinkedIn-ID aus `linkedin_threads.profile_url`; '' bis ein Thread existiert. */
  li_urn: string
  profile_url: string
  name: string
  headline: string
  lead_status: LeadStatus
  wiedervorlage_am: string | null
  wiedervorlage_grund: string
  disqualifiziert_grund: string
  markiert: boolean
  notiz: string
  /** Kanaldaten für den stillen Zweig — bewusst leer, Beschaffung ist eine eigene Runde. */
  email: string
  telefon: string
  anschrift: string
  first_seen_at: string
  updated_at: string
}

export type LeadEreignisTyp =
  | 'anfrage'
  | 'angenommen'
  | 'erstnachricht'
  | 'followup'
  | 'antwort_erhalten'
  | 'loom_zugesagt'
  | 'loom_gesendet'
  | 'inmail'
  | 'email'
  | 'postkarte'
  | 'anruf'
  | 'wiedervorlage_gesetzt'
  | 'disqualifiziert'
  | 'reaktiviert'
  | 'notiz'

export type LeadEreignisQuelle = 'sync' | 'ui' | 'backfill'

/** Append-only: nie ändern, nie löschen — Korrekturen sind neue Ereignisse. */
export interface LeadEreignis {
  id: string
  brand_id: string
  lead_id: string
  typ: LeadEreignisTyp
  at: string
  quelle: LeadEreignisQuelle
  details: Record<string, unknown>
  erstellt_at: string
}
