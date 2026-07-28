/**
 * LinkedIn-API-Sonde (Wargame Zug 2, Fassung 27.07.2026)
 *
 * Diagnose-Werkzeug: prüft, ob der Sync-Weg noch funktioniert, und zeigt die
 * aktuelle Feldform. Schreibt NICHTS, sendet NICHTS, klickt NICHTS.
 * Bei jedem Verdacht auf "LinkedIn hat was umgebaut" zuerst das hier laufen lassen.
 *
 * Voraussetzung — Sync-Chrome läuft und ist eingeloggt:
 *   open -na "Google Chrome" --args --user-data-dir="$HOME/.uriel-chrome" \
 *     --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
 *
 * Start: node runner/linkedin/probe.mjs
 * Zero-dependency (Node >= 22, globales WebSocket).
 */
const CDP = 'http://127.0.0.1:9222'
const MESSAGING = 'https://www.linkedin.com/messaging/'

async function findOrOpenMessaging() {
  const get = async () => (await fetch(`${CDP}/json`)).json()
  let list
  try {
    list = await get()
  } catch {
    throw new Error(
      'CDP nicht erreichbar auf 9222. Sync-Chrome starten (siehe Kopf dieser Datei).',
    )
  }
  const hit = (l) =>
    l.find((t) => t.type === 'page' && String(t.url).includes('linkedin.com/messaging'))

  let page = hit(list)
  if (page) return page

  // PUT, nicht GET — neuere Chrome-Versionen antworten auf GET /json/new mit 405.
  await fetch(`${CDP}/json/new?${MESSAGING}`, { method: 'PUT' })
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    page = hit(await get())
    if (page?.webSocketDebuggerUrl) return page
  }
  throw new Error('Messaging-Tab kam nicht hoch')
}

function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => {
      try { ws.close() } catch {}
      reject(new Error('CDP-Timeout (45s)'))
    }, 45000)
    ws.addEventListener('open', () =>
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true },
      })),
    )
    ws.addEventListener('message', (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.id !== 1) return
      clearTimeout(timer)
      try { ws.close() } catch {}
      if (msg.error) return reject(new Error(JSON.stringify(msg.error)))
      if (msg.result?.exceptionDetails) {
        return reject(new Error(msg.result.exceptionDetails.text || 'Page-Exception'))
      }
      resolve(msg.result?.result?.value)
    })
    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('WebSocket-Fehler'))
    })
  })
}

const PROBE = `(async () => {
  // Login-Wand zuerst — alles andere ist dann sinnlos.
  if (document.querySelector('input[type=password]') || location.href.includes('/login')) {
    return { loginWall: true };
  }

  const csrf = (document.cookie.match(/JSESSIONID="?([^";]+)"?/) || [])[1] || '';
  if (!csrf) return { err: 'kein JSESSIONID-Cookie' };

  // queryId + mailboxUrn zur Laufzeit ableiten — beide wechseln, niemals hartkodieren.
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let convUrl = null;
  for (let i = 0; i < 8 && !convUrl; i++) {
    convUrl = performance.getEntriesByType('resource').map(e => e.name)
      .find(u => /messengerConversations\\./.test(u));
    if (!convUrl) await sleep(1000);
  }
  if (!convUrl) return { err: 'kein messengerConversations-Request gefunden' };

  const queryId = (convUrl.match(/queryId=([^&]+)/) || [])[1];
  const mailbox = decodeURIComponent((convUrl.match(/mailboxUrn:([^),]+)/) || [])[1] || '');
  const alleQueryIds = [...new Set(performance.getEntriesByType('resource').map(e => e.name)
    .filter(u => /messengerConversations\\./.test(u))
    .map(u => (u.match(/queryId=([^&]+)/) || [])[1]))];

  const url = '/voyager/api/voyagerMessagingGraphQL/graphql?queryId=' + queryId +
              '&variables=(mailboxUrn:' + encodeURIComponent(mailbox) + ')';
  const res = await fetch(url, { credentials: 'include', headers: {
    'csrf-token': csrf, 'accept': 'application/vnd.linkedin.normalized+json+2.1' } });
  if (res.status !== 200) return { err: 'HTTP ' + res.status, queryId, mailbox };

  const j = await res.json();
  const inc = j.included || [];
  const T = (s) => inc.filter(o => o.$type === 'com.linkedin.messenger.' + s);
  const convs = T('Conversation'), msgs = T('Message'), parts = T('MessagingParticipant');
  const byUrn = Object.fromEntries(parts.map(p => [p.entityUrn, p]));

  const kat = {};
  for (const c of convs) for (const k of (c.categories || [])) kat[k] = (kat[k] || 0) + 1;

  const zeilen = convs.slice(0, 6).map(c => {
    const m = msgs.find(x => x['*conversation'] === c.entityUrn);
    const other = (c['*conversationParticipants'] || []).find(u => !String(u).includes(mailbox));
    const p = byUrn[other];
    const mem = p?.participantType?.member;
    return {
      name: mem ? ((mem.firstName?.text || mem.firstName || '') + ' ' + (mem.lastName?.text || mem.lastName || '')).trim() : '?',
      von: m ? (String(m['*sender']).includes(mailbox) ? 'ICH' : 'GEGENUEBER') : '?',
      zuletzt: new Date(c.lastActivityAt).toISOString().slice(0, 16).replace('T', ' '),
      key: (c.backendUrn || '').slice(-16),
      stern: (c.categories || []).includes('STARRED'),
      gruppe: !!c.groupChat,
    };
  });

  return {
    loginWall: false, queryId, alleQueryIds, mailbox,
    anzahl: { konversationen: convs.length, nachrichten: msgs.length,
              teilnehmer: parts.length, gesponsert: T('SponsoredMessageOption').length },
    kategorien: kat,
    moeglicherweiseUnvollstaendig: convs.length === 20,
    zeilen,
  };
})()`

const page = await findOrOpenMessaging()
const r = await evaluate(page.webSocketDebuggerUrl, PROBE)

if (r.loginWall) {
  console.error('ABBRUCH: LinkedIn ist in diesem Profil ausgeloggt. Einmal anmelden.')
  process.exit(2)
}
if (r.err) {
  console.error('ABBRUCH:', r.err)
  process.exit(3)
}

console.log('queryId        :', r.queryId)
console.log('alle queryIds  :', r.alleQueryIds.join(', '))
console.log('mailboxUrn     :', r.mailbox)
console.log('Anzahl         :', JSON.stringify(r.anzahl))
console.log('Kategorien     :', JSON.stringify(r.kategorien))
if (r.moeglicherweiseUnvollstaendig) {
  console.log('HINWEIS        : exakt 20 Treffer = Standard-Seitengröße → evtl. unvollständig (RECON-1)')
}
console.log('\nErste Threads:')
for (const z of r.zeilen) {
  console.log(`  ${z.zuletzt}  ${z.von.padEnd(10)}  ${z.stern ? '*' : ' '}${z.gruppe ? 'G' : ' '}  ${z.name}  [${z.key}]`)
}
