#!/usr/bin/env node
/**
 * Den Gespraechsverlauf fuer alle Threads nachziehen, denen er fehlt.
 *
 * Hintergrund und Fundstellen: runner/linkedin/verlaufTiefe.mjs.
 * Kurz: Die Postfach-Liste liefert je Thread nur die letzte Nachricht, deshalb
 * stand bei 261 Threads ueberall ein Verlauf der Laenge 1 - und deshalb konnte
 * leads-sync nie "Erstnachricht" UND "Antwort erhalten" fuer denselben Lead
 * ableiten.
 *
 *   node scripts/verlauf-nachziehen.mjs [--limit=50] [--trocken]
 *
 * Braucht das Sync-Chrome (Alias `chrome-sync`) mit angemeldetem LinkedIn.
 */
import { MESSAGES_QID_FALLBACK, brauchtTiefe, conversationUrn, strengKodiert } from '../runner/linkedin/verlaufTiefe.mjs'
import { VERLAUF_MAX, VERLAUF_TEXT_MAX, verlaufAusMessages } from '../runner/linkedin/verlauf.mjs'

const CDP = 'http://127.0.0.1:9222'
const SUPA = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPA || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (runner/.env)'); process.exit(1) }

const arg = (n, s) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? s
const LIMIT = Number(arg('limit', '400'))
const TROCKEN = process.argv.includes('--trocken')
const kopf = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const sag = (t) => console.log(`[${new Date().toLocaleTimeString('de-DE')}] ${t}`)

// --- Threads holen -------------------------------------------------------
const alle = await (await fetch(
  `${SUPA}/rest/v1/linkedin_threads?select=id,thread_key,name,verlauf&limit=1000`, { headers: kopf })).json()
const offen = alle.filter(brauchtTiefe).slice(0, LIMIT)
sag(`${alle.length} Threads, ${alle.filter(brauchtTiefe).length} ohne echten Verlauf, dieser Lauf: ${offen.length}`)
if (!offen.length) process.exit(0)

// --- Chrome-Verbindung ---------------------------------------------------
const tabs = await (await fetch(`${CDP}/json/list`)).json().catch(() => null) ?? []
const seite = tabs.find((t) => t.type === 'page' && t.url.includes('linkedin'))
if (!seite) { console.error('Keine LinkedIn-Seite im Sync-Chrome offen. `chrome-sync` starten und linkedin.com/messaging aufrufen.'); process.exit(1) }
const ws = new WebSocket(seite.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const cmd = (method, params = {}) => new Promise((res) => {
  const k = ++id
  const h = (e) => { const d = JSON.parse(e.data); if (d.id === k) { ws.removeEventListener('message', h); res(d.result) } }
  ws.addEventListener('message', h); ws.send(JSON.stringify({ id: k, method, params }))
})

// --- Im Seitenkontext: Verlaeufe holen -----------------------------------
// verlaufAusMessages wandert als Quelltext mit, wie in sync.mjs: im Browser
// gibt es keine Module.
const auftrag = offen.map((t) => ({ id: t.id, urn: t.thread_key }))
const ausdruck = `(async () => {
  const csrf = (document.cookie.match(/JSESSIONID="?([^";]+)"?/) || [])[1] || ''
  if (!csrf) return JSON.stringify({ fehler: 'kein JSESSIONID-Cookie' })
  const convUrl = performance.getEntriesByType('resource').map(e => e.name)
    .find(u => /messengerConversations\\./.test(u))
  const mailbox = decodeURIComponent((convUrl?.match(/mailboxUrn:([^),&]+)/) || [])[1] || '')
  if (!mailbox) return JSON.stringify({ fehler: 'mailboxUrn nicht ableitbar - Messaging-Seite offen?' })

  const gefunden = performance.getEntriesByType('resource').map(e => e.name)
    .map(u => (u.match(/queryId=(messengerMessages\\.[a-f0-9]+)/) || [])[1])
    .filter(Boolean)
  const qid = gefunden[0] || ${JSON.stringify(MESSAGES_QID_FALLBACK)}

  const streng = ${strengKodiert.toString()}
  const threadIdAus = ${(function threadIdAus (k) { return String(k ?? '').split('messagingThread:').pop() }).toString()}
  ${verlaufAusMessages.toString()}
  const isSelfFactory = (selbst) => (urn) => selbst.has(urn)

  const raus = []
  for (const job of ${JSON.stringify(auftrag)}) {
    try {
      const urn = 'urn:li:msg_conversation:(' + mailbox + ',' + threadIdAus(job.urn) + ')'
      const url = '/voyager/api/voyagerMessagingGraphQL/graphql?queryId=' + qid +
        '&variables=(conversationUrn:' + streng(urn) + ')'
      const res = await fetch(url, { credentials: 'include',
        headers: { 'csrf-token': csrf, accept: 'application/vnd.linkedin.normalized+json+2.1' } })
      if (res.status !== 200) { raus.push({ id: job.id, fehler: 'HTTP ' + res.status }); continue }
      const j = await res.json()
      const inc = j.included || []
      const msgs = inc.filter(o => o['$type'] === 'com.linkedin.messenger.Message')
      const parts = inc.filter(o => o['$type'] === 'com.linkedin.messenger.MessagingParticipant')
      const selbst = new Set(parts.filter(p => p.hostIdentityUrn === mailbox).map(p => p.entityUrn))
      const convUrnEcht = msgs[0] ? msgs[0]['*conversation'] : null
      const verlauf = verlaufAusMessages(msgs, convUrnEcht, isSelfFactory(selbst), ${VERLAUF_MAX}, ${VERLAUF_TEXT_MAX})
      raus.push({ id: job.id, verlauf })
    } catch (e) {
      raus.push({ id: job.id, fehler: String(e && e.message || e) })
    }
    // LinkedIn nicht hetzen: rund zweieinhalb Anfragen je Sekunde.
    await new Promise(r => setTimeout(r, 400))
  }
  return JSON.stringify({ ergebnisse: raus })
})()`

sag('Hole Verlaeufe aus LinkedIn ...')
const antwort = await cmd('Runtime.evaluate', { expression: ausdruck, awaitPromise: true, returnByValue: true })
ws.close()
const roh = antwort?.result?.value
if (!roh) { console.error('Keine Antwort aus der Seite:', JSON.stringify(antwort).slice(0, 300)); process.exit(1) }
const daten = JSON.parse(roh)
if (daten.fehler) { console.error('Abbruch:', daten.fehler); process.exit(1) }

const nachName = Object.fromEntries(offen.map((t) => [t.id, t.name]))
const gut = daten.ergebnisse.filter((e) => Array.isArray(e.verlauf))
const mehr = gut.filter((e) => e.verlauf.length > 1)
const schlecht = daten.ergebnisse.filter((e) => e.fehler)
sag(`${gut.length} geholt, davon ${mehr.length} mit echtem Verlauf (>1) · ${schlecht.length} Fehler`)
if (schlecht.length) sag('  erste Fehler: ' + schlecht.slice(0, 3).map((e) => `${nachName[e.id]}: ${e.fehler}`).join(' · '))

if (TROCKEN) { sag('Trockenlauf - nichts geschrieben.'); process.exit(0) }

// --- Zurueckschreiben ----------------------------------------------------
let geschrieben = 0
for (const e of gut) {
  const res = await fetch(`${SUPA}/rest/v1/linkedin_threads?id=eq.${e.id}`, {
    method: 'PATCH', headers: kopf, body: JSON.stringify({ verlauf: e.verlauf }),
  })
  if (res.ok) geschrieben++
  else sag(`  Schreibfehler bei ${nachName[e.id]}: HTTP ${res.status}`)
}
sag(`${geschrieben} Threads aktualisiert.`)
