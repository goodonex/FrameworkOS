/**
 * send-email — Versendet E-Mails via Resend.
 * Modes: sales (default) | project_message (Deliver notifications)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SalesSendBody {
  mode?: 'sales'
  brand_id: string
  contact_id: string
  subject: string
  body: string
  template_id?: string | null
  sequence_id?: string | null
  enrollment_id?: string | null
  from_email?: string | null
  from_name?: string | null
  to_email?: string | null
}

interface ProjectMessageBody {
  mode: 'project_message'
  project_id: string
  message_id: string
  sender_role: 'owner' | 'client'
}

type SendBody = SalesSendBody | ProjectMessageBody

interface ResendResp {
  id?: string
  message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) return json({ error: 'resend_api_key_missing' }, 500)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const PUBLIC_API_BASE = Deno.env.get('PUBLIC_API_BASE') ?? SUPABASE_URL
  // Fallback ist die Live-Domain. Die frühere Vercel-Adresse ist tot — als
  // Notnagel hätte sie stumme Links erzeugt. Gesetzt ist der Wert ohnehin
  // (Secret `PUBLIC_APP_URL`), der Fallback greift nur, wenn jemand ihn löscht.
  const PUBLIC_APP_URL = (
    Deno.env.get('PUBLIC_APP_URL') ?? 'https://frameworkos.de'
  ).replace(/\/$/, '')

  const auth = req.headers.get('authorization') ?? ''
  const isInternal = auth.includes(SERVICE_ROLE)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: isInternal ? undefined : { headers: { Authorization: auth } },
  })

  let payload: SendBody
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (payload.mode === 'project_message') {
    return handleProjectMessage(
      supabase,
      payload,
      auth,
      isInternal,
      RESEND_API_KEY,
      PUBLIC_APP_URL,
    )
  }

  return handleSalesEmail(
    supabase,
    payload as SalesSendBody,
    auth,
    isInternal,
    RESEND_API_KEY,
    PUBLIC_API_BASE,
    PUBLIC_APP_URL,
  )
})

async function handleProjectMessage(
  supabase: ReturnType<typeof createClient>,
  payload: ProjectMessageBody,
  auth: string,
  isInternal: boolean,
  resendKey: string,
  publicAppUrl: string,
) {
  if (!payload.project_id || !payload.message_id || !payload.sender_role) {
    return json({ error: 'missing_fields' }, 400)
  }

  const { data: message, error: mErr } = await supabase
    .from('project_messages')
    .select('id, project_id, sender_role, sender_name, body')
    .eq('id', payload.message_id)
    .eq('project_id', payload.project_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (mErr || !message) return json({ error: 'message_not_found' }, 404)

  const { data: project, error: pErr } = await supabase
    .from('deliver_projects')
    .select('id, name, owner_brand_id, client_email, client_name, deleted_at')
    .eq('id', payload.project_id)
    .maybeSingle()

  if (pErr || !project || project.deleted_at) {
    return json({ error: 'project_not_found' }, 404)
  }

  const { data: brand, error: bErr } = await supabase
    .from('brands')
    .select('id, user_id, name, slug')
    .eq('id', project.owner_brand_id)
    .maybeSingle()

  if (bErr || !brand) return json({ error: 'brand_not_found' }, 404)

  if (!isInternal) {
    const { data: userResp } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
    if (!userResp.user) return json({ error: 'unauthorized' }, 401)
    const uid = userResp.user.id
    const isOwner = brand.user_id === uid
    const isClient =
      payload.sender_role === 'client' &&
      (await clientOwnsProject(supabase, uid, payload.project_id))
    const isOwnerSender =
      payload.sender_role === 'owner' && isOwner
    if (!isOwnerSender && !isClient) {
      return json({ error: 'forbidden' }, 403)
    }
  }

  let toEmail = ''
  let subject = ''
  let deepLink = ''
  const preview = message.body.slice(0, 240)

  if (payload.sender_role === 'client') {
    const { data: ownerUser } = await supabase.auth.admin.getUserById(brand.user_id)
    toEmail = ownerUser?.user?.email ?? ''
    subject = `Neue Nachricht von ${message.sender_name ?? project.client_name ?? 'Kunde'} — ${project.name}`
    // Cockpit-Route. Die alte Brand-Welt `/brand/:slug/deliver/:id` wurde in
    // Etappe 4 abgerissen — der Link lief bis hierher ins Leere.
    deepLink = `${publicAppUrl}/projekte/${project.id}`
  } else {
    toEmail = project.client_email ?? ''
    subject = `Neue Nachricht zu „${project.name}"`
    deepLink = `${publicAppUrl}/portal/${project.id}`
  }

  if (!toEmail) return json({ error: 'recipient_has_no_email' }, 400)

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'
  const fromName = Deno.env.get('RESEND_FROM_NAME') ?? brand.name ?? 'Brand OS'

  const htmlBody = `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;font-family:system-ui,sans-serif;">
  <h2 style="font-size:18px;margin:0 0 12px;color:#111;">${escapeHtml(subject)}</h2>
  <p style="font-size:14px;line-height:1.6;color:#444;white-space:pre-wrap;">${escapeHtml(preview)}</p>
  <p style="margin:24px 0 0;">
    <a href="${deepLink}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;">Nachricht öffnen</a>
  </p>
</div></body></html>`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject,
      html: htmlBody,
      text: `${preview}\n\nNachricht öffnen: ${deepLink}`,
    }),
  })

  const resendJson: ResendResp = await resendRes.json().catch(() => ({}))
  if (!resendRes.ok) {
    return json(
      { ok: false, error: 'resend_failed', detail: resendJson.message ?? 'unknown' },
      resendRes.status,
    )
  }

  return json({ ok: true, resend_id: resendJson.id })
}

async function clientOwnsProject(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('project_id')
    .eq('user_id', userId)
    .eq('role', 'client')
    .maybeSingle()
  return data?.project_id === projectId
}

/**
 * Öffentliche Asset-URL für Mail-Bilder (Logo). Der Kommentar „frameworkos.de hat
 * kein /email/*" stimmt nicht mehr: die Dateien liegen in `app/public/email/` und
 * werden von Netlify ausgeliefert (06.08.2026 geprüft, 200 image/png). Damit fällt
 * die Abhängigkeit von der alten Vercel-Adresse weg.
 */
const EMAIL_ASSETS_BASE = (
  Deno.env.get('EMAIL_ASSETS_BASE_URL') ?? 'https://frameworkos.de'
).replace(/\/$/, '')

const BRAND_EMAIL: Record<string, { fromName: string; logoPath: string }> = {
  herrmann: {
    fromName: 'Herrmann & Co.',
    logoPath: '/email/herrmann-logo.png',
  },
}

type ContactRow = {
  id: string
  brand_id: string
  email: string | null
  name: string | null
  company: string | null
  ansprechpartner: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  contact_type: string | null
  parent_company_id: string | null
}

function personDisplayName(c: ContactRow): string {
  const fn = (c.first_name ?? '').trim()
  const ln = (c.last_name ?? '').trim()
  const combined = `${fn} ${ln}`.trim()
  if (combined) return combined
  return (c.name ?? '').trim() || 'Ansprechpartner'
}

function resolveFirstName(c: ContactRow): string {
  const fn = (c.first_name ?? '').trim()
  if (fn) return fn
  const ap = (c.ansprechpartner ?? '').trim()
  if (ap) return ap.split(/\s+/)[0] ?? ''
  return (c.name ?? '').trim().split(/\s+/)[0] ?? ''
}

function renderTemplateString(
  template: string,
  vars: Record<string, string>,
): string {
  if (!template) return ''
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, raw: string) => {
    const key = raw.trim()
    return vars[key] ?? ''
  })
}

async function renderSalesEmailContent(
  supabase: ReturnType<typeof createClient>,
  contact: ContactRow,
  brandId: string,
  toEmail: string,
  subjectTpl: string,
  bodyTpl: string,
  brandName: string | null,
): Promise<{ subject: string; body: string }> {
  let ctx: ContactRow = contact

  if ((contact.contact_type ?? 'company') === 'company') {
    const { data: people } = await supabase
      .from('contacts')
      .select(
        'id, brand_id, email, name, company, ansprechpartner, first_name, last_name, phone, contact_type, parent_company_id',
      )
      .eq('brand_id', brandId)
      .eq('parent_company_id', contact.id)
      .eq('contact_type', 'person')

    const person = (people ?? []).find(
      (p) => (p.email ?? '').trim().toLowerCase() === toEmail.trim().toLowerCase(),
    ) as ContactRow | undefined

    if (person) {
      const personName = personDisplayName(person)
      ctx = {
        ...contact,
        name: personName || contact.ansprechpartner || contact.name,
        ansprechpartner: personName || contact.ansprechpartner,
        email: person.email ?? contact.email,
        phone: person.phone ?? contact.phone,
        first_name: person.first_name ?? contact.first_name,
        last_name: person.last_name ?? contact.last_name,
      }
    }
  }

  const parts = (ctx.name ?? '').trim().split(/\s+/)
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? ''

  const vars: Record<string, string> = {
    name: ctx.name ?? '',
    first_name: resolveFirstName(ctx),
    email: ctx.email ?? '',
    phone: ctx.phone ?? '',
    company: ctx.company ?? ctx.name ?? '',
    ansprechpartner: ctx.ansprechpartner ?? '',
    datum: new Date().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    anrede: last ? `Herr/Frau ${last}` : '',
    'brand.name': brandName ?? '',
    'brand.positioning': '',
  }

  return {
    subject: renderTemplateString(subjectTpl, vars),
    body: renderTemplateString(bodyTpl, vars),
  }
}

function resolveSalesFromName(
  slug: string | null | undefined,
  brandName: string | null | undefined,
  payloadName?: string | null,
): string {
  const explicit = payloadName?.trim()
  if (explicit) return explicit
  if (slug && BRAND_EMAIL[slug]?.fromName) return BRAND_EMAIL[slug].fromName
  const name = (brandName ?? '').trim()
  if (name && !/^framework\s*os$/i.test(name)) return name
  const envName = Deno.env.get('RESEND_FROM_NAME')?.trim()
  if (envName && !/^framework\s*os$/i.test(envName)) return envName
  return 'Herrmann & Co.'
}

async function handleSalesEmail(
  supabase: ReturnType<typeof createClient>,
  payload: SalesSendBody,
  auth: string,
  isInternal: boolean,
  resendKey: string,
  publicApiBase: string,
  publicAppUrl: string,
) {
  if (!payload.brand_id || !payload.contact_id || !payload.subject || !payload.body) {
    return json({ error: 'missing_fields' }, 400)
  }

  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .select(
      'id, brand_id, email, name, company, ansprechpartner, first_name, last_name, phone, contact_type, parent_company_id',
    )
    .eq('id', payload.contact_id)
    .maybeSingle()

  if (cErr || !contact) return json({ error: 'contact_not_found' }, 404)
  if (contact.brand_id !== payload.brand_id) return json({ error: 'brand_mismatch' }, 403)

  const toEmail = (payload.to_email && payload.to_email.trim()) || (contact.email ?? '').trim()
  if (!toEmail) return json({ error: 'contact_has_no_email' }, 400)

  const { data: brand } = await supabase
    .from('brands')
    .select('id, user_id, name, slug, email_signature')
    .eq('id', payload.brand_id)
    .maybeSingle()
  if (!brand) return json({ error: 'brand_not_found' }, 404)

  if (!isInternal) {
    const { data: userResp } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
    if (!userResp.user || userResp.user.id !== brand.user_id) {
      return json({ error: 'unauthorized' }, 403)
    }
  }

  const trackingId = crypto.randomUUID()
  const pixelUrl = `${publicApiBase}/functions/v1/track-open?id=${trackingId}`

  const fromEmail =
    (payload.from_email && payload.from_email.trim()) ||
    Deno.env.get('RESEND_FROM_EMAIL') ||
    'noreply@example.com'
  const fromName = resolveSalesFromName(brand.slug, brand.name, payload.from_name)

  const brandEmail = brand.slug ? BRAND_EMAIL[brand.slug] : undefined
  const logoUrl = brandEmail ? `${EMAIL_ASSETS_BASE}${brandEmail.logoPath}` : null

  const rendered = await renderSalesEmailContent(
    supabase,
    contact,
    payload.brand_id,
    toEmail,
    payload.subject,
    payload.body,
    brand.name,
  )

  const bodyWithSignature = appendEmailSignature(rendered.body, brand.email_signature ?? '')
  const htmlBody = wrapHtml(bodyWithSignature, pixelUrl, { logoUrl, fromName })
  const textBody = stripHtml(bodyWithSignature)

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: rendered.subject,
      html: htmlBody,
      text: textBody,
      headers: { 'X-Tracking-Id': trackingId },
    }),
  })

  const resendJson: ResendResp = await resendRes.json().catch(() => ({}))
  if (!resendRes.ok) {
    return json(
      { error: 'resend_failed', detail: resendJson.message ?? 'unknown' },
      resendRes.status,
    )
  }

  const { data: log, error: lErr } = await supabase
    .from('sales_email_logs')
    .insert({
      brand_id: payload.brand_id,
      contact_id: payload.contact_id,
      template_id: payload.template_id ?? null,
      sequence_id: payload.sequence_id ?? null,
      enrollment_id: payload.enrollment_id ?? null,
      subject: rendered.subject,
      body_preview: textBody.slice(0, 240),
      tracking_id: trackingId,
      direction: 'outbound',
      resend_id: resendJson.id ?? '',
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
    })
    .select('id')
    .maybeSingle()

  if (lErr) return json({ error: 'log_insert_failed', detail: lErr.message }, 500)

  await supabase
    .from('contacts')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', payload.contact_id)

  return json({
    ok: true,
    log_id: log?.id,
    tracking_id: trackingId,
    resend_id: resendJson.id,
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function appendEmailSignature(body: string, signature: string): string {
  const sig = (signature ?? '').trim()
  if (!sig) return body
  if (body.includes(sig)) return body
  const looksLikeHtml = /<\w+[^>]*>/.test(body)
  if (looksLikeHtml) {
    const htmlSig = sig
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
    return `${body}<br><br>--<br>${htmlSig}`
  }
  const base = body.trimEnd()
  const sep = base.endsWith('\n') ? '\n' : '\n\n'
  return `${base}${sep}--\n${sig}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapHtml(
  rawBody: string,
  pixelUrl: string,
  opts?: { logoUrl?: string | null; fromName?: string },
): string {
  const looksLikeHtml = /<\w+[^>]*>/.test(rawBody)
  const inner = looksLikeHtml
    ? rawBody
    : `<p style="font-family:system-ui,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a;white-space:pre-wrap;">${escapeHtml(rawBody)}</p>`
  const logoBlock = opts?.logoUrl
    ? `<div style="text-align:center;margin:0 0 28px;">
<img src="${opts.logoUrl}" alt="${escapeHtml(opts.fromName ?? '')}" width="128" height="128" style="display:inline-block;border:0;max-width:128px;height:auto;" />
</div>`
    : ''
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;">
${logoBlock}
${inner}
</div>
<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
</body></html>`
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}
