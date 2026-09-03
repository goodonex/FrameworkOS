import { useCallback, useEffect, useRef, useState } from 'react'
import { CONTACT_FOLLOW_UP_CLEARED_EVENT } from '../lib/contactFollowUpSync'
import { logActivity } from '../lib/activityLog'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { normalizeContactType } from '../lib/crmContacts'
import type {
  Contact,
  ContactActivityEntry,
  ContactStatus,
  FollowUpType,
  LeadQuality,
  LeadSource,
  PipelineStage,
  PotenzialTyp,
} from '../types/db'
import { useBrandIdStatus } from './useBrandId'

export type CreateContactResult =
  | { ok: true; contact: Contact }
  /** Dublette gefunden — der bestehende Kontakt kommt zurück. */
  | { ok: false; duplicate: Contact; error?: undefined }
  /**
   * Schreiben war nicht möglich (Supabase nicht erreichbar oder Insert abgelehnt).
   * O1: Es gibt bewusst KEINE lokale Ersatzwahrheit mehr — nichts wurde angelegt.
   */
  | { ok: false; duplicate?: undefined; error: string }

export type CreateContactOptions = {
  /** Wenn true: Duplikat-Check (E-Mail / Name) überspringen */
  skipDuplicateCheck?: boolean
}

function parseActivityLog(raw: unknown): ContactActivityEntry[] {
  if (!Array.isArray(raw)) return []
  const out: ContactActivityEntry[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const text = typeof o.text === 'string' ? o.text : ''
    const at = typeof o.at === 'string' ? o.at : new Date().toISOString()
    if (id && text) out.push({ id, text, at })
  }
  return out
}

function parseCustomFields(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return out
}

function normalizeLeadQuality(raw: unknown): LeadQuality {
  const s = typeof raw === 'string' ? raw : ''
  if (s === 'good' || s === 'bad') return s
  return 'unqualified'
}

const CONTACT_STATUSES: ContactStatus[] = [
  'not_contacted',
  'not_reached',
  'in_contact',
  'high_potential',
  'followup_planned',
  'offer_made',
  'unqualified',
  'deal_won',
  'customer_inactive',
  'deal_lost',
]

function normalizeContactStatus(raw: unknown): ContactStatus {
  const s = typeof raw === 'string' ? raw : ''
  return CONTACT_STATUSES.includes(s as ContactStatus) ? (s as ContactStatus) : 'not_contacted'
}

function normalizeLeadSource(raw: unknown): LeadSource {
  const s = typeof raw === 'string' ? raw : ''
  const ok: LeadSource[] = ['', 'cold', 'referral', 'linkedin', 'website', 'event', 'other']
  return ok.includes(s as LeadSource) ? (s as LeadSource) : ''
}

function normalizeFollowUpType(raw: unknown): FollowUpType {
  const s = typeof raw === 'string' ? raw : ''
  const ok: FollowUpType[] = ['', 'call', 'meeting', 'email', 'other']
  return ok.includes(s as FollowUpType) ? (s as FollowUpType) : ''
}

function normalizePotenzialTyp(raw: unknown): PotenzialTyp {
  const s = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (s === 'monatlich' || s === 'jährlich' || s === 'jaehrlich') {
    return s === 'monatlich' ? 'monatlich' : 'jährlich'
  }
  return 'einmalig'
}

/** Vor create: gleiche Brand-Liste (items) nach Dubletten durchsuchen */
export function findDuplicateInContacts(
  items: Contact[],
  partial: Partial<Pick<Contact, 'name' | 'email'>>,
): Contact | null {
  const email = (partial.email ?? '').trim().toLowerCase()
  if (email.length > 0) {
    const hit = items.find((c) => (c.email ?? '').trim().toLowerCase() === email)
    if (hit) return hit
  }
  const name = (partial.name ?? '').trim().toLowerCase()
  if (name.length >= 2) {
    const hit = items.find((c) => (c.name ?? '').trim().toLowerCase() === name)
    if (hit) return hit
  }
  return null
}

function normalizeContact(
  c: Partial<Contact> & Pick<Contact, 'id' | 'brand_id'>,
): Contact {
  const now = new Date().toISOString()
  const prob = Number(c.abschluss_wahrscheinlichkeit)
  const clampedProb =
    Number.isFinite(prob) ? Math.max(0, Math.min(100, Math.round(prob))) : 0
  const potRaw = Number(c.potenzial_betrag)
  const potenzial_betrag = Number.isFinite(potRaw) ? Math.max(0, Math.round(potRaw)) : 0
  return {
    id: c.id,
    brand_id: c.brand_id,
    contact_type: normalizeContactType(c.contact_type),
    parent_company_id: c.parent_company_id ?? null,
    contact_status: normalizeContactStatus(c.contact_status),
    first_name: c.first_name ?? '',
    last_name: c.last_name ?? '',
    job_title: c.job_title ?? '',
    address: c.address ?? '',
    rechnung_firma: c.rechnung_firma ?? '',
    rechnung_strasse: c.rechnung_strasse ?? '',
    rechnung_plz: c.rechnung_plz ?? '',
    rechnung_ort: c.rechnung_ort ?? '',
    rechnung_email: c.rechnung_email ?? '',
    lead_source: normalizeLeadSource(c.lead_source),
    follow_up_type: normalizeFollowUpType(c.follow_up_type),
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    instagram: c.instagram ?? '',
    linkedin: c.linkedin ?? '',
    company: c.company ?? '',
    source_content_piece_id: c.source_content_piece_id ?? null,
    source_campaign_id: c.source_campaign_id ?? null,
    source_funnel_id: c.source_funnel_id ?? null,
    lead_quality: normalizeLeadQuality(c.lead_quality),
    lead_value:
      c.lead_value != null && Number.isFinite(Number(c.lead_value))
        ? Math.max(0, Number(c.lead_value))
        : null,
    pipeline_stage: (c.pipeline_stage ?? 'first_contact') as PipelineStage,
    last_contact_at: c.last_contact_at ?? null,
    next_follow_up_at: c.next_follow_up_at ?? null,
    notes: c.notes ?? '',
    call_notes: c.call_notes ?? '',
    activity_log: Array.isArray(c.activity_log)
      ? parseActivityLog(c.activity_log)
      : [],
    bedarf: c.bedarf ?? '',
    ansprechpartner: c.ansprechpartner ?? '',
    aktuelle_situation: c.aktuelle_situation ?? '',
    hauptproblem: c.hauptproblem ?? '',
    timeline: c.timeline ?? '',
    budget: c.budget ?? '',
    ist_entscheider: Boolean(c.ist_entscheider),
    entscheider_name: c.entscheider_name ?? '',
    einwaende: c.einwaende ?? '',
    naechste_schritte: c.naechste_schritte ?? '',
    abschluss_wahrscheinlichkeit: clampedProb,
    potenzial_betrag,
    potenzial_typ: normalizePotenzialTyp(c.potenzial_typ),
    potenzial_notiz: c.potenzial_notiz ?? '',
    custom_fields: parseCustomFields(c.custom_fields),
    pipeline_id: c.pipeline_id ?? null,
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
    stage_changed_at: c.stage_changed_at ?? null,
    won_at: c.won_at ?? null,
    lost_at: c.lost_at ?? null,
    lost_reason: c.lost_reason ?? '',
    referred_by_id: c.referred_by_id ?? null,
    referral_source: c.referral_source ?? '',
    deliver_project_id: c.deliver_project_id ?? null,
    portal_lead_status: c.portal_lead_status ?? 'new',
    created_at: c.created_at ?? now,
    updated_at: c.updated_at ?? now,
  }
}

function rowToContact(row: Record<string, unknown>): Contact {
  const probRaw = row.abschluss_wahrscheinlichkeit
  const prob =
    typeof probRaw === 'number'
      ? probRaw
      : typeof probRaw === 'string'
        ? Number(probRaw)
        : 0
  const potRaw = row.potenzial_betrag
  const pot =
    typeof potRaw === 'number' ? potRaw : potRaw != null ? Number(potRaw) : 0
  return normalizeContact({
    id: row.id as string,
    brand_id: row.brand_id as string,
    contact_type: normalizeContactType(row.contact_type),
    parent_company_id: (row.parent_company_id as string | null) ?? null,
    contact_status: normalizeContactStatus(row.contact_status),
    first_name: (row.first_name as string | undefined) ?? '',
    last_name: (row.last_name as string | undefined) ?? '',
    job_title: (row.job_title as string | undefined) ?? '',
    address: (row.address as string | undefined) ?? '',
    rechnung_firma: (row.rechnung_firma as string | undefined) ?? '',
    rechnung_strasse: (row.rechnung_strasse as string | undefined) ?? '',
    rechnung_plz: (row.rechnung_plz as string | undefined) ?? '',
    rechnung_ort: (row.rechnung_ort as string | undefined) ?? '',
    rechnung_email: (row.rechnung_email as string | undefined) ?? '',
    lead_source: normalizeLeadSource(row.lead_source),
    follow_up_type: normalizeFollowUpType(row.follow_up_type),
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string | undefined) ?? '',
    website: (row.website as string | undefined) ?? '',
    instagram: (row.instagram as string | undefined) ?? '',
    linkedin: (row.linkedin as string | undefined) ?? '',
    company: (row.company as string | undefined) ?? '',
    source_content_piece_id: (row.source_content_piece_id as string | null) ?? null,
    source_campaign_id: (row.source_campaign_id as string | null) ?? null,
    source_funnel_id: (row.source_funnel_id as string | null) ?? null,
    lead_quality: normalizeLeadQuality(row.lead_quality),
    lead_value:
      row.lead_value != null && Number.isFinite(Number(row.lead_value))
        ? Math.max(0, Number(row.lead_value))
        : null,
    pipeline_stage: row.pipeline_stage as PipelineStage,
    last_contact_at: (row.last_contact_at as string | null) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
    notes: row.notes as string,
    call_notes: ((row.call_notes as string | undefined) ?? ''),
    activity_log: parseActivityLog(row.activity_log),
    bedarf: (row.bedarf as string | undefined) ?? '',
    ansprechpartner: (row.ansprechpartner as string | undefined) ?? '',
    aktuelle_situation: (row.aktuelle_situation as string | undefined) ?? '',
    hauptproblem: (row.hauptproblem as string | undefined) ?? '',
    timeline: (row.timeline as string | undefined) ?? '',
    budget: (row.budget as string | undefined) ?? '',
    ist_entscheider: Boolean(row.ist_entscheider),
    entscheider_name: (row.entscheider_name as string | undefined) ?? '',
    einwaende: (row.einwaende as string | undefined) ?? '',
    naechste_schritte: (row.naechste_schritte as string | undefined) ?? '',
    abschluss_wahrscheinlichkeit: Number.isFinite(prob) ? prob : 0,
    potenzial_betrag: Number.isFinite(pot) ? Math.max(0, Math.round(pot)) : 0,
    potenzial_typ: normalizePotenzialTyp(row.potenzial_typ),
    potenzial_notiz: (row.potenzial_notiz as string | undefined) ?? '',
    custom_fields: parseCustomFields(row.custom_fields),
    pipeline_id: (row.pipeline_id as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    stage_changed_at: (row.stage_changed_at as string | null) ?? null,
    won_at: (row.won_at as string | null) ?? null,
    lost_at: (row.lost_at as string | null) ?? null,
    lost_reason: (row.lost_reason as string | undefined) ?? '',
    referred_by_id: (row.referred_by_id as string | null) ?? null,
    referral_source: (row.referral_source as string | undefined) ?? '',
    deliver_project_id: (row.deliver_project_id as string | null) ?? null,
    portal_lead_status: (row.portal_lead_status as Contact['portal_lead_status']) ?? 'new',
    created_at: (row.created_at as string | undefined) ?? undefined,
    updated_at: row.updated_at as string,
  })
}

function contactToRow(
  c: Contact,
  brandId: string,
): Record<string, unknown> {
  return {
    id: c.id,
    brand_id: brandId,
    contact_type: c.contact_type,
    parent_company_id: c.parent_company_id,
    contact_status: c.contact_status,
    first_name: c.first_name,
    last_name: c.last_name,
    job_title: c.job_title,
    address: c.address,
    rechnung_firma: c.rechnung_firma,
    rechnung_strasse: c.rechnung_strasse,
    rechnung_plz: c.rechnung_plz,
    rechnung_ort: c.rechnung_ort,
    rechnung_email: c.rechnung_email,
    lead_source: c.lead_source,
    follow_up_type: c.follow_up_type,
    name: c.name,
    email: c.email,
    phone: c.phone,
    website: c.website,
    instagram: c.instagram,
    linkedin: c.linkedin,
    company: c.company,
    source_content_piece_id: c.source_content_piece_id,
    source_campaign_id: c.source_campaign_id,
    source_funnel_id: c.source_funnel_id,
    lead_quality: c.lead_quality,
    lead_value: c.lead_value,
    pipeline_stage: c.pipeline_stage,
    pipeline_id: c.pipeline_id ?? null,
    tags: c.tags ?? [],
    last_contact_at: c.last_contact_at,
    next_follow_up_at: c.next_follow_up_at,
    notes: c.notes,
    call_notes: c.call_notes,
    activity_log: c.activity_log,
    bedarf: c.bedarf,
    ansprechpartner: c.ansprechpartner,
    aktuelle_situation: c.aktuelle_situation,
    hauptproblem: c.hauptproblem,
    timeline: c.timeline,
    budget: c.budget,
    ist_entscheider: c.ist_entscheider,
    entscheider_name: c.entscheider_name,
    einwaende: c.einwaende,
    naechste_schritte: c.naechste_schritte,
    abschluss_wahrscheinlichkeit: c.abschluss_wahrscheinlichkeit,
    potenzial_betrag: c.potenzial_betrag,
    potenzial_typ: c.potenzial_typ,
    potenzial_notiz: c.potenzial_notiz,
    custom_fields: c.custom_fields,
    stage_changed_at: c.stage_changed_at ?? new Date().toISOString(),
    won_at: c.won_at,
    lost_at: c.lost_at,
    lost_reason: c.lost_reason ?? '',
    referred_by_id: c.referred_by_id ?? null,
    referral_source: c.referral_source ?? '',
    deliver_project_id: c.deliver_project_id ?? null,
    portal_lead_status: c.portal_lead_status ?? 'new',
    updated_at: c.updated_at,
  }
}

const STORAGE_KEY = 'contacts' as const

/**
 * O1 (06.08.2026): Der Tombstone-Schlüssel `contacts-deleted-ids` ist ersatzlos
 * entfallen. Er existierte nur, weil localStorage gelöschte Kontakte sonst beim
 * nächsten Merge wieder auferstehen ließ — mit Supabase als einziger Wahrheit
 * gibt es keinen Merge und damit nichts zu beerdigen.
 */

export interface UseContactsResult {
  items: Contact[]
  loading: boolean
  error: string | null
  /**
   * O1: true, wenn Supabase gerade nicht antwortet und nur der Lese-Cache
   * angezeigt wird. In diesem Zustand schreibt der Hook nichts — create/update/
   * remove lehnen ab, statt eine zweite Wahrheit im Browser aufzubauen.
   */
  readOnly: boolean
  reload: () => Promise<void>
  create: (
    partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
    options?: CreateContactOptions,
  ) => Promise<CreateContactResult>
  update: (
    id: string,
    patch: Partial<Omit<Contact, 'id' | 'brand_id'>>,
  ) => void
  remove: (id: string) => Promise<boolean>
  clearError: () => void
}

/**
 * Liest den **Lese-Cache** aus dem localStorage. O1 (06.08.2026): Das ist keine
 * zweite Datenquelle mehr, sondern ein Abbild des letzten erfolgreichen
 * Supabase-Ladevorgangs — nützlich, um bei einem Ausfall etwas zeigen zu können
 * und für Nachschlagen ohne Hook (useTasks, ContactPage). Wer hier schreibt,
 * baut die Geisterwelt neu auf, die dieser Umbau beseitigt hat.
 */
export function readContactsLocal(brandSlug: string): Contact[] {
  const raw = loadList<Partial<Contact> & { id: string; brand_id: string }>([
    brandSlug,
    STORAGE_KEY,
  ])
  return raw.map((r) => normalizeContact(r as Contact))
}

export function useContacts(brandSlug: string | undefined): UseContactsResult {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Contact[]>([])
  itemsRef.current = items
  /**
   * O1: löst `localOnlyRef` ab. Früher hieß der Zustand „ab jetzt ist der
   * Browser die Wahrheit" und Schreibvorgänge liefen still ins localStorage.
   * Jetzt heißt er „Supabase antwortet nicht — nur gucken".
   */
  const [readOnly, setReadOnly] = useState(false)
  const readOnlyRef = useRef(false)
  const setzeReadOnly = useCallback((v: boolean) => {
    readOnlyRef.current = v
    setReadOnly(v)
  }, [])

  /** Zeigt den Lese-Cache an, ohne ihn zur Wahrheit zu erklären. */
  const zeigeCache = useCallback(
    (meldung: string) => {
      if (!brandSlug) return
      const cache = readContactsLocal(brandSlug)
      setzeReadOnly(true)
      setItems(cache)
      setError(cache.length > 0 ? meldung : `${meldung} Es liegt auch kein Cache vor.`)
    },
    [brandSlug, setzeReadOnly],
  )

  const persistLocal = useCallback(
    (next: Contact[]) => {
      if (!brandSlug) return
      saveList([brandSlug, STORAGE_KEY], next)
    },
    [brandSlug],
  )

  /**
   * O1 (06.08.2026): Supabase ist die einzige Wahrheit. Was der Server liefert,
   * ist die Liste — kein Merge, kein Anreichern aus dem Cache, kein Wiederbeleben
   * lokaler Zeilen. Antwortet der Server nicht, zeigt der Hook den Cache und
   * schaltet auf Nur-Lesen; er baut nie eine zweite Wahrheit auf.
   */
  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      setError(null)
      setzeReadOnly(false)
      return
    }
    if (!supabase || !brandId) {
      // Brand noch unterwegs: nicht auf „schreibgeschützt" schalten — das ist
      // eine Diagnose, keine Ladeanzeige.
      if (brandPending) {
        setLoading(true)
        return
      }
      zeigeCache('Keine Verbindung zu Supabase — Kontakte sind schreibgeschützt.')
      setLoading(false)
      return
    }
    setLoading(true)

    // Seitenweise — PostgREST deckelt still bei 1.000 Zeilen, und absteigend
    // nach `updated_at` fielen die am längsten unangetasteten Kontakte weg:
    // ausgerechnet der Retainer-Bestand hinter der Nordstern-Zahl.
    const rohZeilen: unknown[] = []
    const SEITE = 1000
    let ladeFehler: { message: string } | null = null
    for (let von = 0; ; von += SEITE) {
      const { data, error: e } = await supabase
        .from('contacts')
        .select('*')
        .eq('brand_id', brandId)
        .order('updated_at', { ascending: false })
        .range(von, von + SEITE - 1)
      if (e) {
        ladeFehler = e
        break
      }
      const stapel = data ?? []
      rohZeilen.push(...stapel)
      if (stapel.length < SEITE) break
    }
    const err = ladeFehler

    if (err) {
      const grund = isMissingSupabaseTableError(err.message)
        ? 'Tabelle `contacts` ist nicht erreichbar'
        : err.message
      console.warn('[useContacts] Supabase-Fehler — Cache, schreibgeschützt:', err.message)
      zeigeCache(`${grund} — Kontakte sind schreibgeschützt.`)
      setLoading(false)
      return
    }

    const serverRows = rohZeilen.map((r) => rowToContact(r as Record<string, unknown>))
    const cache = readContactsLocal(brandSlug)

    // 0 Zeilen bei gefülltem Cache ist fast immer RLS oder ein halb aufgebauter
    // Client, nicht „alle Kontakte gelöscht". Anzeigen ja, überschreiben nein:
    // ein persistLocal([]) an dieser Stelle würde den Cache vernichten.
    if (serverRows.length === 0 && cache.length > 0) {
      console.warn('[useContacts] Supabase liefert 0 Zeilen bei gefülltem Cache — schreibgeschützt.')
      zeigeCache(
        'Supabase lieferte 0 Kontakte, der Cache ist aber gefüllt. Angezeigt wird der Cache, Änderungen sind gesperrt. Seite neu laden; besteht das Problem, RLS/Verbindung prüfen.',
      )
      setLoading(false)
      return
    }

    setzeReadOnly(false)
    setError(null)
    setItems(serverRows)
    persistLocal(serverRows)
    setLoading(false)
  }, [brandId, brandSlug, brandPending, persistLocal, setzeReadOnly, zeigeCache])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!brandSlug) return
    const onCleared = (e: Event) => {
      const contactId = (e as CustomEvent<{ contactId: string }>).detail?.contactId
      if (!contactId) return
      setItems((prev) => {
        const next = prev.map((c) =>
          c.id === contactId
            ? { ...c, next_follow_up_at: null, follow_up_type: '' as Contact['follow_up_type'] }
            : c,
        )
        persistLocal(next)
        return next
      })
    }
    window.addEventListener(CONTACT_FOLLOW_UP_CLEARED_EVENT, onCleared)
    return () => window.removeEventListener(CONTACT_FOLLOW_UP_CLEARED_EVENT, onCleared)
  }, [brandSlug, persistLocal])

  const create = useCallback(
    async (
      partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
      options?: CreateContactOptions,
    ): Promise<CreateContactResult> => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      if (readOnlyRef.current || !supabase || !brandId) {
        const meldung = 'Kontakt konnte nicht angelegt werden: keine Verbindung zu Supabase.'
        setError(meldung)
        return { ok: false, error: meldung }
      }
      if (!options?.skipDuplicateCheck) {
        const dup = findDuplicateInContacts(itemsRef.current, {
          name: partial?.name,
          email: partial?.email,
        })
        if (dup) return { ok: false, duplicate: dup }
      }
      const now = new Date().toISOString()
      const item = normalizeContact({
        id: generateId(),
        brand_id: brandId,
        stage_changed_at: now,
        ...partial,
        updated_at: now,
      })

      // O1: erst schreiben, dann anzeigen. Der frühere optimistische Einschub
      // blieb bei einem Insert-Fehler als Geist in Liste und Cache zurück.
      const row = contactToRow(item, brandId)
      const { error: insErr } = await supabase.from('contacts').insert(row)
      if (insErr) {
        console.warn('[useContacts] insert fehlgeschlagen — nichts angelegt', insErr.message)
        setError(insErr.message)
        return { ok: false, error: insErr.message }
      }

      const next = [...itemsRef.current, item]
      itemsRef.current = next
      setItems(next)
      persistLocal(next)

      logActivity({
        brand_id: brandId,
        entity_type: 'contact',
        entity_id: item.id,
        action: 'created',
        summary: `Neuer Kontakt: ${item.name || item.email || 'Unbenannt'}`,
        metadata: { stage: item.pipeline_stage },
      })
      return { ok: true, contact: item }
    },
    [brandId, brandSlug, persistLocal],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      if (readOnlyRef.current || !supabase || !brandId) {
        setError('Änderung nicht gespeichert: keine Verbindung zu Supabase.')
        return
      }
      const now = new Date().toISOString()
      const prev = itemsRef.current.find((c) => c.id === id)
      if (!prev) return
      const basePatch = { ...patch }
      if (patch.custom_fields && prev.custom_fields) {
        basePatch.custom_fields = {
          ...prev.custom_fields,
          ...patch.custom_fields,
        } as Contact['custom_fields']
      }
      // Win/Loss-Stamping bei Stage-Wechsel
      if (patch.pipeline_stage && patch.pipeline_stage !== prev.pipeline_stage) {
        if (patch.pipeline_stage === 'deal' && !prev.won_at) {
          basePatch.won_at = now
          basePatch.lost_at = null
          // Deal bedeutet Kunde aktiv, außer es wurde explizit bereits auf inaktiv gesetzt.
          if (prev.contact_status !== 'customer_inactive') {
            basePatch.contact_status = 'deal_won'
          }
        }
      }
      const merged = normalizeContact({ ...prev, ...basePatch, updated_at: now })
      const next = itemsRef.current.map((c) => (c.id === id ? merged : c))
      itemsRef.current = next
      setItems(next)
      persistLocal(next)
      // Optimistisch bleibt erlaubt — aber jeder Fehler zieht die Wahrheit vom
      // Server nach, statt die Abweichung im Browser einzufrieren.
      void supabase
        .from('contacts')
        .update({ ...basePatch, updated_at: now })
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: updErr }) => {
          if (updErr) {
            console.warn('[useContacts] update fehlgeschlagen — lade neu', updErr.message)
            setError(updErr.message)
            void reload()
          }
        })

      if (
        patch.pipeline_stage &&
        patch.pipeline_stage !== prev.pipeline_stage &&
        brandId
      ) {
        logActivity({
          brand_id: brandId,
          entity_type: 'contact',
          entity_id: id,
          action: 'stage_changed',
          summary: `${merged.name || merged.email || 'Kontakt'}: ${prev.pipeline_stage} → ${patch.pipeline_stage}`,
          metadata: {
            from: prev.pipeline_stage,
            to: patch.pipeline_stage,
          },
        })
      }
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const clearError = useCallback(() => setError(null), [])

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!brandSlug) return false
      const prev = itemsRef.current
      const next = prev.filter((c) => c.id !== id)
      if (next.length === prev.length) return false
      if (readOnlyRef.current || !supabase || !brandId) {
        setError('Kontakt nicht gelöscht: keine Verbindung zu Supabase.')
        return false
      }

      // O1: erst der Server, dann die Liste. Vorher wurde lokal gelöscht und ein
      // Tombstone gesetzt, damit der Merge die Zeile nicht wieder auferstehen
      // lässt — beides entfällt, weil es keinen Merge mehr gibt.
      const { data, error: delErr } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .select('id')

      if (delErr) {
        console.warn('[useContacts] delete fehlgeschlagen', delErr.message)
        setError(delErr.message)
        return false
      }
      if (!data?.length) {
        // Keine Zeile getroffen: entweder schon weg oder die Policy hat sie
        // ausgeblendet. Nachsehen statt blind ein zweites Mal löschen.
        const { data: remote } = await supabase.from('contacts').select('id').eq('id', id).maybeSingle()
        if (remote) {
          setError('Kontakt konnte nicht gelöscht werden — die Zeile existiert weiter (RLS?).')
          return false
        }
      }

      itemsRef.current = next
      setItems(next)
      persistLocal(next)
      return true
    },
    [brandId, brandSlug, persistLocal],
  )

  return { items, loading, error, readOnly, reload, create, update, remove, clearError }
}
