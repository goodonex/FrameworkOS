/**
 * morgen-push — die Benachrichtigung, mit der Kevins Arbeitstag anfängt.
 * (O3, Zug 4 des Wargames docs/wargames/morgen-workflow.md)
 *
 * Getaktet von pg_cron (zwei Zeilen, 5:00 und 6:00 UTC, werktags — Migration
 * 0067). Bewusst NICHT vom Runner: der Mac schläft um sieben, und genau das
 * soll dieser Weg umgehen.
 *
 * Auth: `x-cron-key` === CRON_KEY (Cron) ODER ein gültiges User-JWT zusammen
 * mit `{ "test": true }` im Body (Probe-Push aus dem Cockpit). Alles andere 401.
 *
 * Der Push enthält **Zahlen, keine Namen** (D5). Die exakte, priorisierte Liste
 * baut die App beim Öffnen über `usePosten` — die Rangfolge in Deno noch einmal
 * nachzubauen, hieße sie doppelt zu pflegen, und beide Fassungen würden
 * auseinanderlaufen.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import * as webpush from 'jsr:@negrel/webpush@0.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-key',
}

function json(status: number, b: Record<string, unknown>) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Stunde und Datum in Berlin — ohne Bibliothek, DST inklusive. */
function berlin(jetzt: Date): { stunde: number; datum: string; wochentag: number } {
  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(jetzt)
  const hol = (t: string) => teile.find((p) => p.type === t)?.value ?? ''
  const tage: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    // '24' kommt bei hour12:false für Mitternacht vor — auf 0 normalisieren.
    stunde: Number(hol('hour')) % 24,
    datum: `${hol('year')}-${hol('month')}-${hol('day')}`,
    wochentag: tage[hol('weekday')] ?? 1,
  }
}

const PUSH_STUNDE = Number(Deno.env.get('PUSH_STUNDE') ?? 7)
const FOLLOWUP_SCHWELLE_TAGE = 3

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'nur POST' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronKey = Deno.env.get('CRON_KEY') ?? ''
  const vapidJwk = Deno.env.get('VAPID_JWK') ?? ''
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:kevin.herrmann94@gmail.com'

  let body: { test?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const istTest = body.test === true

  // ---------- Zugang ----------
  const vomCron = cronKey.length > 0 && req.headers.get('x-cron-key') === cronKey
  let vomNutzer = false
  if (!vomCron) {
    const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (bearer && istTest) {
      const alsNutzer = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      })
      const { data } = await alsNutzer.auth.getUser()
      vomNutzer = Boolean(data?.user)
    }
  }
  if (!vomCron && !vomNutzer) return json(401, { error: 'nicht berechtigt' })

  const db = createClient(url, serviceKey)
  const jetzt = new Date()
  const { stunde, datum, wochentag } = berlin(jetzt)

  // ---------- Wächter (beim Probe-Push übersprungen) ----------
  if (!istTest) {
    if (wochentag === 0 || wochentag === 6) return json(200, { skipped: 'wochenende', datum })
    if (stunde !== PUSH_STUNDE) return json(200, { skipped: 'falsche-stunde', stunde, datum })
    const { data: schonRaus } = await db.from('push_log').select('datum').eq('datum', datum).maybeSingle()
    if (schonRaus) return json(200, { skipped: 'already-sent', datum })
  }

  // ---------- Zählen ----------
  const heuteBeginn = `${datum}T00:00:00+00:00`
  const schwelle = new Date(jetzt.getTime() - FOLLOWUP_SCHWELLE_TAGE * 86_400_000).toISOString()

  const zahl = async (
    tabelle: string,
    bauen: (q: ReturnType<typeof db.from>) => unknown,
  ): Promise<number> => {
    // deno-lint-ignore no-explicit-any
    const { count, error } = (await (bauen(db.from(tabelle)) as any)) ?? {}
    if (error) console.warn(`[morgen-push] ${tabelle}:`, error.message)
    return count ?? 0
  }

  const wartendeAntworten = await zahl('linkedin_threads', (q) =>
    // deno-lint-ignore no-explicit-any
    (q as any).select('id', { count: 'exact', head: true }).eq('status', 'active').eq('last_from', 'them'),
  )
  // Näherung statt Nachbau der Rangfolge: von Kevin geschrieben, älter als drei
  // Tage, Leiter noch nicht am Ende. Für eine Zahl im Push genau genug.
  const faelligeFollowups = await zahl('linkedin_threads', (q) =>
    // deno-lint-ignore no-explicit-any
    (q as any)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('last_from', 'me')
      .lte('followup_stage', 2)
      .lt('last_message_at', schwelle),
  )
  const entwuerfeFertig = await zahl('linkedin_threads', (q) =>
    // deno-lint-ignore no-explicit-any
    (q as any).select('id', { count: 'exact', head: true }).not('entwurf', 'is', null),
  )
  const erstnachrichtenOffen = await zahl('linkedin_erstnachrichten', (q) =>
    // deno-lint-ignore no-explicit-any
    (q as any).select('id', { count: 'exact', head: true }).eq('status', 'offen'),
  )

  // Lief die Nacht-Analyse? Kriterium aus D5: der jüngste Entwurf ist von heute.
  const { data: juengster } = await db
    .from('linkedin_threads')
    .select('entwurf_at')
    .not('entwurf_at', 'is', null)
    .order('entwurf_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const analyseFrisch = Boolean(juengster?.entwurf_at && juengster.entwurf_at >= heuteBeginn)

  const { data: metrik } = await db
    .from('daily_metrics')
    .select('li_anfragen')
    .eq('datum', datum)
    .maybeSingle()
  const anfragenHeute = Number(metrik?.li_anfragen ?? 0)

  const posten = wartendeAntworten + faelligeFollowups + erstnachrichtenOffen

  // ---------- Text (D5, zweistufig) ----------
  // Kevins Regel vom 06.08.: „0 Entwürfe fertig" darf NIE im Push stehen — eine
  // Null ist kein Morgen-Erlebnis. Lief die Analyse nicht, sagt der Push
  // stattdessen, was zu tun ist, damit sie läuft.
  const nutzlast = analyseFrisch
    ? {
        title: `Analyse abgeschlossen — ${posten} Posten bereit`,
        body: `${entwuerfeFertig} Entwürfe fertig · Anfragen ${anfragenHeute}/30`,
        url: '/morgen',
      }
    : {
        title: `${posten} Posten warten`,
        body: `MacBook aufklappen — dann bereitet Uriel die Entwürfe vor · Anfragen ${anfragenHeute}/30`,
        url: '/morgen',
      }

  // ---------- Versand ----------
  const { data: abos } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  if (!abos?.length) {
    return json(200, { sent: 0, hinweis: 'keine Abonnements', nutzlast, analyseFrisch })
  }
  if (!vapidJwk) return json(500, { error: 'VAPID_JWK fehlt' })

  const keys = await webpush.importVapidKeys(JSON.parse(vapidJwk), { extractable: false })
  const app = await webpush.ApplicationServer.new({
    contactInformation: vapidSubject,
    vapidKeys: keys,
  })

  let gesendet = 0
  const entfernt: string[] = []
  for (const abo of abos) {
    try {
      const abonnent = app.subscribe({
        endpoint: abo.endpoint,
        keys: { p256dh: abo.p256dh, auth: abo.auth },
        // deno-lint-ignore no-explicit-any
      } as any)
      await abonnent.pushTextMessage(JSON.stringify(nutzlast), {})
      gesendet += 1
    } catch (e) {
      // 404/410 = das Gerät gibt es nicht mehr (PWA gelöscht, neu installiert).
      // Solche Leichen sammeln sich sonst still an und lassen jeden Lauf scheitern.
      const text = String((e as Error)?.message ?? e)
      if (/404|410|gone|not found/i.test(text)) {
        await db.from('push_subscriptions').delete().eq('id', abo.id)
        entfernt.push(abo.id)
      } else {
        console.error('[morgen-push] Versand fehlgeschlagen:', text.slice(0, 300))
      }
    }
  }

  // Beim Probe-Push NICHT protokollieren — sonst bliebe der echte Push am
  // selben Morgen aus, weil der Tag schon als erledigt gilt.
  if (!istTest) {
    await db.from('push_log').upsert(
      { datum, sent_at: new Date().toISOString(), empfaenger: gesendet, payload: nutzlast },
      { onConflict: 'datum' },
    )
  }

  return json(200, {
    sent: gesendet,
    entfernt: entfernt.length,
    datum,
    test: istTest,
    analyseFrisch,
    nutzlast,
    zahlen: { wartendeAntworten, faelligeFollowups, erstnachrichtenOffen, entwuerfeFertig, anfragenHeute },
  })
})
