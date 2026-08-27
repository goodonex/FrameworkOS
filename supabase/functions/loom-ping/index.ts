// loom-ping — trackt, ob und wie lange ein Lead das Loom-Video angesehen hat.
// POST /functions/v1/loom-ping
// Body: { token, lead, sekunden, gesamt }
// Öffentlich, kein Auth, schreibt mit SUPABASE_SERVICE_ROLE_KEY, schluckt Fehler
// still - der Player (sendBeacon) bekommt die Antwort nie zu sehen, siehe track-open.
//
// Zuordnung über leads.name statt eine ID mitzuschicken: Jophiel kennt beim
// Deploy den Lead-Namen, keine ID - dieselbe Klammer wie überall in Uriel,
// weil die zwei LinkedIn-ID-Sorten nicht zueinander passen (0076).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Body {
  token: string
  lead: string
  sekunden?: number
  gesamt?: number
}

// sendBeacon liest die Antwort nie - immer 200, egal was innen passiert ist.
function ok () {
  return new Response('ok', { status: 200, headers: cors })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return ok()

  try {
    const body: Body = await req.json()
    if (!body.token || !body.lead) return ok()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: lead } = await supabase
      .from('leads')
      .select('id, brand_id')
      .eq('name', body.lead)
      .maybeSingle()
    if (!lead) return ok()

    const sekunden = Math.max(0, Math.round(body.sekunden ?? 0))
    const gesamt = Math.max(0, Math.round(body.gesamt ?? 0))

    const { data: bestehend } = await supabase
      .from('lead_ereignisse')
      .select('id, details')
      .eq('lead_id', lead.id)
      .eq('typ', 'loom_angesehen')
      .eq('details->>token', body.token)
      .maybeSingle()

    if (bestehend) {
      // Update statt Insert, sonst erzeugt ein einzelner Aufruf zwanzig Zeilen.
      // Sekunden nie zurückdrehen, falls ein Beacon verspätet ankommt.
      const bisher = Number(bestehend.details?.sekunden ?? 0)
      await supabase
        .from('lead_ereignisse')
        .update({ details: { token: body.token, sekunden: Math.max(bisher, sekunden), gesamt } })
        .eq('id', bestehend.id)
    } else {
      await supabase.from('lead_ereignisse').insert({
        brand_id: lead.brand_id,
        lead_id: lead.id,
        typ: 'loom_angesehen',
        at: new Date().toISOString(),
        quelle: 'ui',
        details: { token: body.token, sekunden, gesamt },
      })
    }
  } catch {
    // Bewusst still, siehe track-open.
  }

  return ok()
})
