/**
 * runner/linkedin/sync.mjs — Wargame Zug 3 (docs/wargames/linkedin-followups.md)
 *
 * Liest Kevins LinkedIn-Postfach über die interne Voyager-API aus. Rein lesend:
 * kein Klick, kein Senden, keine Navigation. Zero-dependency (Node >= 22, globales
 * WebSocket), CDP gegen das Sync-Chrome-Profil (~/.uriel-chrome, Alias `chrome-sync`).
 *
 * queryId und mailboxUrn werden bei jedem Lauf frisch aus den Requests der Seite
 * abgeleitet, niemals hartkodiert — beide wechseln mit LinkedIn-Releases.
 *
 * RECON-1 (Pagination über die ersten 20 Konversationen hinaus) ist offen: die
 * zweite bekannte queryId liefert nachweislich dieselben 20 Konversationen (nur
 * andere Reihenfolge), die Mailbox-Counts-Query liefert nur Ungelesen-Zahlen statt
 * Gesamtzahlen, und das Input-Domain von CDP antwortet in diesem Chrome-Profil auf
 * keine dispatchMouseEvent-Aufrufe (vermutlich fehlender --enable-automation-Flag).
 * Deshalb der vereinbarte Sicherheitsnetz: exakt 20 Treffer → `partial: true`,
 * und upsert.mjs archiviert auf dieser Basis nie.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import { VERLAUF_MAX, VERLAUF_TEXT_MAX, verlaufAusMessages } from './verlauf.mjs'

const CDP = 'http://127.0.0.1:9222'
const MESSAGING = 'https://www.linkedin.com/messaging/'
const HARD_TIMEOUT_MS = 90_000

// Wie weit zurück geblättert wird. 30 Tage im Alltag: der einmalige Tiefenscan
// ist gelaufen, ältere Threads liegen bereits in der DB und werden nie gelöscht.
// Weil LinkedIn absteigend nach letzter Aktivität sortiert, rutscht ein alter
// Thread, in dem wieder etwas passiert, automatisch auf Seite 1 — ein kurzes
// Fenster übersieht also keine neue Aktivität, es spart nur Seitenaufrufe.
// Für einen erneuten Tiefenscan: LINKEDIN_SCAN_TAGE=365 node runner/linkedin/sync.mjs --dry-run
const SCAN_TAGE = Number(process.env.LINKEDIN_SCAN_TAGE ?? 30)

async function findOrOpenMessaging() {
  const get = async () => (await fetch(`${CDP}/json`)).json()
  let list
  try {
    list = await get()
  } catch {
    throw new Error(
      'CDP nicht erreichbar auf 9222. Sync-Chrome starten: chrome-sync (siehe ~/.zshrc).',
    )
  }
  const hit = (l) =>
    l.find((t) => t.type === 'page' && String(t.url).includes('linkedin.com/messaging'))

  let page = hit(list)
  // Ohne webSocketDebuggerUrl (z. B. weil ein DevTools-Fenster am Tab hängt) ist
  // das Target unbrauchbar — dann lieber einen frischen Tab öffnen als später
  // an `new WebSocket(undefined)` mit kryptischem Fehler zu scheitern.
  if (page?.webSocketDebuggerUrl) return page

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
      reject(new Error(`CDP-Timeout (${HARD_TIMEOUT_MS / 1000}s)`))
    }, HARD_TIMEOUT_MS)
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

// Läuft im Seitenkontext von linkedin.com/messaging. Extraktion folgt der
// Feldkarte im Wargame-Dokument, verifiziert am 27.07.2026.
//
// `cachedQid` ist die zuletzt erfolgreich benutzte Blätter-Query-ID. Sie wird
// IMMER erst validiert (ein Aufruf, Wurzelname + Cursor prüfen) und nur benutzt,
// wenn sie noch trägt — sonst wird neu entdeckt. Damit steht kein Release-Hash
// im Quelltext und der Sync heilt sich selbst, wenn LinkedIn ihn rotiert.
const buildSyncExpr = (cachedQid, scanTage) => `(async () => {
  const CACHED_QID = ${JSON.stringify(cachedQid || null)};
  const SCAN_TAGE = ${Number(scanTage)};

  // Verlauf-Auswertung aus runner/linkedin/verlauf.mjs — als Quelltext injiziert,
  // damit dieselbe Funktion hier im Seitenkontext läuft, die das verify-Skript
  // gegen Fixtures prüft. Sie ist bewusst geschlossen (keine Closures/Imports).
  ${verlaufAusMessages.toString()}
  if (document.querySelector('input[type=password]') || location.href.includes('/uas/login')) {
    return { loginWall: true };
  }

  const csrf = (document.cookie.match(/JSESSIONID="?([^";]+)"?/) || [])[1] || '';
  if (!csrf) return { err: 'kein JSESSIONID-Cookie' };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const GRAPHQL = '/voyager/api/voyagerMessagingGraphQL/graphql?queryId=';
  const HEADERS = { 'csrf-token': csrf, 'accept': 'application/vnd.linkedin.normalized+json+2.1' };

  // Der Performance-Buffer fasst nur ~250 Einträge und nimmt danach NICHTS mehr
  // auf — auf einer lange offenen Messaging-Seite tauchen neue Requests dort also
  // nie auf. Deshalb zusätzlich einen eigenen Mitschnitt auf fetch legen.
  if (!window.__urielReq) {
    window.__urielReq = [];
    const originalFetch = window.fetch;
    window.fetch = function (...a) {
      try { window.__urielReq.push(String(a[0]?.url || a[0])) } catch (e) {}
      return originalFetch.apply(this, a);
    };
  }

  const gesehenIds = () => [...new Set(
    [...performance.getEntriesByType('resource').map((e) => e.name), ...window.__urielReq]
      .filter((u) => /messengerConversations\\./.test(u))
      .map((u) => (u.match(/queryId=(messengerConversations\\.[a-f0-9]+)/) || [])[1])
      .filter(Boolean),
  )];

  let convUrl = null;
  for (let i = 0; i < 8 && !convUrl; i++) {
    convUrl = performance.getEntriesByType('resource').map((e) => e.name)
      .find((u) => /messengerConversations\\./.test(u));
    if (!convUrl) await sleep(1000);
  }
  if (!convUrl) return { err: 'kein messengerConversations-Request gefunden — Seite noch nicht fertig geladen?' };

  const mailbox = decodeURIComponent((convUrl.match(/mailboxUrn:([^),]+)/) || [])[1] || '');
  if (!mailbox) return { err: 'mailboxUrn nicht aus URL ableitbar' };

  // ---- Blätter-Query finden (RECON-1, gelöst am 28.07.2026) ----
  // Die Seite kennt mehrere messengerConversations-IDs. Nur EINE davon ist die
  // cursor-basierte Katalog-Abfrage (messengerConversationsByCategoryQuery), und
  // die feuert die Seite erst beim Scrollen. Deshalb: Kandidaten durchprobieren,
  // und wenn keiner passt, die Liste einmal anstoßen und erneut schauen.
  // Nichts wird hartkodiert — die ID trägt einen Release-Hash und wechselt.
  const seitenVariablen = (cursor) =>
    '(query:(predicateUnions:List((conversationCategoryPredicate:(category:INBOX)))),count:20,mailboxUrn:' +
    encodeURIComponent(mailbox) + (cursor ? ',nextCursor:' + encodeURIComponent(cursor) : '') + ')';

  async function holeSeite(qid, cursor) {
    const res = await fetch(GRAPHQL + qid + '&variables=' + seitenVariablen(cursor),
      { credentials: 'include', headers: HEADERS });
    if (res.status !== 200) return { fehler: 'HTTP ' + res.status };
    const j = await res.json();
    const wurzel = j.data?.data || {};
    const name = Object.keys(wurzel).find((k) => !k.startsWith('$'));
    const knoten = wurzel[name] || {};
    return { json: j, wurzelName: name, nextCursor: knoten.metadata?.nextCursor || null };
  }

  async function pruefeQid(qid) {
    const p = await holeSeite(qid, null);
    if (!p.fehler && p.wurzelName === 'messengerConversationsByCategoryQuery' && p.nextCursor) {
      return { qid, ersteSeite: p };
    }
    return null;
  }

  async function findeBlaetterQuery() {
    // Erst die zwischengespeicherte ID — spart in der Regel jede Sucherei.
    if (CACHED_QID) {
      const treffer = await pruefeQid(CACHED_QID);
      if (treffer) return treffer;
    }
    for (const qid of gesehenIds()) {
      if (qid === CACHED_QID) continue;
      const treffer = await pruefeQid(qid);
      if (treffer) return treffer;
    }
    return null;
  }

  // Stößt die Liste an, damit die Seite die Blätter-Query selbst abfeuert.
  // Menschliches Tempo, rein lesend, kein Klick.
  async function listeAnstossen() {
    const erstes = document.querySelector('li.msg-conversation-listitem');
    if (!erstes) return false;
    let box = erstes.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 20)) box = box.parentElement;
    if (!box) return false;
    const vorher = gesehenIds().length;
    for (let i = 0; i < 6; i++) {
      box.scrollTop = box.scrollHeight;
      box.dispatchEvent(new Event('scroll', { bubbles: true }));
      box.dispatchEvent(new WheelEvent('wheel', { deltaY: 900, bubbles: true, cancelable: true }));
      await sleep(900);
      if (gesehenIds().length > vorher) break;
    }
    return true;
  }

  let blaetter = await findeBlaetterQuery();
  let angestossen = false;
  if (!blaetter) {
    angestossen = await listeAnstossen();
    blaetter = await findeBlaetterQuery();
  }

  // ---- Seiten einsammeln ----
  const MAX_SEITEN = 25;
  const alterGrenze = Date.now() - SCAN_TAGE * 24 * 60 * 60 * 1000;

  const rohSeiten = [];
  let seitenGeholt = 0;
  let abbruchGrund = 'cursor-erschoepft';

  if (blaetter) {
    let seite = blaetter.ersteSeite;
    let cursor = seite.nextCursor;
    rohSeiten.push(seite.json);
    seitenGeholt = 1;

    while (cursor && seitenGeholt < MAX_SEITEN) {
      await sleep(450);
      const p = await holeSeite(blaetter.qid, cursor);
      if (p.fehler) { abbruchGrund = 'fehler:' + p.fehler; break; }
      const cs = (p.json.included || []).filter((o) => o.$type === 'com.linkedin.messenger.Conversation');
      if (!cs.length) { abbruchGrund = 'leere-seite'; break; }
      rohSeiten.push(p.json);
      seitenGeholt++;
      cursor = p.nextCursor;
      const aeltesteAufSeite = Math.min(...cs.map((c) => c.lastActivityAt || 0));
      if (aeltesteAufSeite && aeltesteAufSeite < alterGrenze) { abbruchGrund = 'alter-grenze'; break; }
      if (!cursor) abbruchGrund = 'cursor-erschoepft';
    }
    if (cursor && seitenGeholt >= MAX_SEITEN) abbruchGrund = 'seiten-limit';
  } else {
    // Rückfallebene: alte Sync-Token-Abfrage, liefert nur die erste Seite.
    const qid = (convUrl.match(/queryId=([^&]+)/) || [])[1];
    const res = await fetch(GRAPHQL + qid + '&variables=(mailboxUrn:' + encodeURIComponent(mailbox) + ')',
      { credentials: 'include', headers: HEADERS });
    if (res.status !== 200) return { err: 'HTTP ' + res.status + ' von Voyager-API' };
    rohSeiten.push(await res.json());
    seitenGeholt = 1;
    abbruchGrund = 'keine-blaetter-query';
  }

  function participantName(p) {
    const m = p?.participantType?.member;
    if (m) return ((m.firstName?.text || '') + ' ' + (m.lastName?.text || '')).trim();
    const org = p?.participantType?.organization;
    if (org) return (org.name?.text || org.name || '');
    const custom = p?.participantType?.custom;
    if (custom) return (custom.name?.text || custom.name || '');
    return '';
  }

  let skippedGroups = 0;
  let skippedNonInbox = 0;
  let skippedAds = 0;
  let rawConversationCount = 0;
  // Diagnose: wie viel Gespräch die Katalog-Abfrage tatsächlich mitliefert.
  // Voyager hat hier bisher meist genau eine Nachricht je Thread geliefert —
  // ob das immer noch so ist, muss der Lauf selbst beantworten, nicht eine
  // Vermutung im Quelltext.
  let verlaufNachrichten = 0;
  let threadsMitMehrAlsEiner = 0;
  const threads = [];
  const gesehen = new Set();

  // Gesponserte Konversationen tragen zwei eindeutige Marker (live verifiziert an
  // der Salesforce-Anzeige, 28.07.2026). Sie stehen sonst als ganz normaler
  // PRIMARY_INBOX-Eintrag in der Liste und würden dauerhaft in "du bist dran"
  // hängen, weil "geantwortet" hat immer die Anzeige.
  const istAnzeige = (c) =>
    c.conversationTypeText?.text === 'Sponsored' ||
    Boolean(c.contentMetadata?.conversationAdContent);

  for (const seiteJson of rohSeiten) {
  const inc = seiteJson.included || [];
  const T = (s) => inc.filter((o) => o.$type === 'com.linkedin.messenger.' + s);
  const convs = T('Conversation');
  const msgs = T('Message');
  const parts = T('MessagingParticipant');
  const byUrn = Object.fromEntries(parts.map((p) => [p.entityUrn, p]));
  rawConversationCount += convs.length;

  // Wer bin ich? Über hostIdentityUrn statt über String-Enthaltensein — der
  // Teilnehmer-URN kann seine Form ändern, hostIdentityUrn ist die dokumentierte
  // stabile Personen-ID (Feldkarte im Wargame).
  const selfUrns = new Set(
    parts.filter((p) => p.hostIdentityUrn === mailbox).map((p) => p.entityUrn),
  );
  const isSelf = (urn) => (selfUrns.size ? selfUrns.has(urn) : String(urn).includes(mailbox));

  for (const c of convs) {
    const key = c.backendUrn || c.entityUrn;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    if (c.groupChat) { skippedGroups++; continue; }
    if (istAnzeige(c)) { skippedAds++; continue; }
    const cats = c.categories || [];
    if (!cats.includes('INBOX') && !cats.includes('PRIMARY_INBOX')) { skippedNonInbox++; continue; }

    const otherUrn = (c['*conversationParticipants'] || []).find((u) => !isSelf(u));
    const other = byUrn[otherUrn];

    // Neueste Nachricht, nicht die erste im Array — die Reihenfolge der
    // included-Liste ist nicht garantiert.
    const m = msgs
      .filter((x) => x['*conversation'] === c.entityUrn)
      .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0))[0];

    // Derselbe Datenbestand, nur nicht mehr weggeworfen: die letzten N
    // Nachrichten als Gesprächsverlauf für den Antwort-Entwürfe-Agenten.
    const verlauf = verlaufAusMessages(msgs, c.entityUrn, isSelf, ${VERLAUF_MAX}, ${VERLAUF_TEXT_MAX});
    verlaufNachrichten += verlauf.length;
    if (verlauf.length > 1) threadsMitMehrAlsEiner++;

    // Ohne Absender wird NICHT geraten: 'unknown' landet im Bucket „prüfen"
    // statt ein Follow-up zur falschen Zeit auszulösen.
    const lastFrom = !m || !m['*sender'] ? 'unknown' : isSelf(m['*sender']) ? 'me' : 'them';
    const lastMessageAt = c.lastActivityAt ?? m?.deliveredAt ?? null;

    threads.push({
      thread_key: key,
      name: other ? participantName(other) : '',
      company: other?.participantType?.member?.headline?.text || '',
      profile_url: other?.participantType?.member?.profileUrl || '',
      preview: m?.body?.text || '',
      verlauf,
      last_message_at: lastMessageAt,
      last_from: lastFrom,
      // c.read kann fehlen — dann NICHT pauschal „ungelesen" annehmen.
      unread: c.read === false || (c.unreadCount || 0) > 0,
      starred: cats.includes('STARRED'),
      thread_url: c.conversationUrl || '',
    });
  }
  }

  return {
    loginWall: false,
    mailboxUrn: mailbox,
    queryId: blaetter ? blaetter.qid : null,
    threads,
    // Unvollständig ist der Lauf nur noch, wenn wir ihn selbst gedeckelt haben
    // oder gar nicht blättern konnten — nicht mehr bei jeder vollen Seite.
    partial: abbruchGrund === 'seiten-limit' || abbruchGrund === 'keine-blaetter-query' ||
             abbruchGrund.startsWith('fehler:'),
    abbruchGrund,
    seitenGeholt,
    listeAngestossen: angestossen,
    skippedGroups,
    skippedNonInbox,
    skippedAds,
    rawConversationCount,
    verlaufNachrichten,
    threadsMitMehrAlsEiner,
  };
})()`

// Abgeleiteter Zustand, kein Konfigurationswert: die zuletzt tragende
// Blätter-Query-ID. Wird vor Gebrauch immer validiert.
const QID_CACHE = new URL('./.paging-queryid.json', import.meta.url)

function leseQidCache() {
  try {
    return JSON.parse(readFileSync(QID_CACHE, 'utf8')).pagingQueryId ?? null
  } catch {
    return null
  }
}

function schreibeQidCache(qid) {
  try {
    writeFileSync(QID_CACHE, JSON.stringify({ pagingQueryId: qid, entdecktAm: new Date().toISOString() }, null, 2))
  } catch {
    /* Cache ist Bequemlichkeit, kein Muss — ohne ihn wird eben neu entdeckt. */
  }
}

export async function syncThreads({ dryRun = false } = {}) {
  const startedAt = Date.now()
  const page = await findOrOpenMessaging()
  const cachedQid = leseQidCache()
  const result = await evaluate(page.webSocketDebuggerUrl, buildSyncExpr(cachedQid, SCAN_TAGE))

  if (result.queryId && result.queryId !== cachedQid) schreibeQidCache(result.queryId)

  if (result.loginWall) {
    throw new Error('ABBRUCH: LinkedIn ist im Sync-Profil ~/.uriel-chrome ausgeloggt. Einmal anmelden.')
  }
  if (result.err) {
    throw new Error(`ABBRUCH: ${result.err}`)
  }

  // Zwei getrennte Wachen, beide bei 10 %: ein leerer thread_key macht die Zeile
  // unbrauchbar, ein leerer name bedeutet, dass das Gegenüber nicht mehr auflösbar
  // ist — beides heißt, die Feldkarte stimmt nicht mehr. Lieber laut abbrechen als
  // 20 anonyme Zeilen schreiben.
  const total = result.threads.length
  const withoutKey = result.threads.filter((t) => !t.thread_key).length
  const withoutName = result.threads.filter((t) => !t.name.trim()).length
  if (total > 0 && withoutKey / total > 0.1) {
    throw new Error(
      `ABBRUCH: ${withoutKey}/${total} Threads ohne verwertbaren thread_key (> 10 %). Voyager-Feldkarte hat sich vermutlich geändert.`,
    )
  }
  if (total > 0 && withoutName / total > 0.1) {
    throw new Error(
      `ABBRUCH: ${withoutName}/${total} Threads ohne Namen (> 10 %) — Gegenüber nicht auflösbar. Voyager-Teilnehmerform hat sich vermutlich geändert.`,
    )
  }

  return {
    threads: result.threads,
    partial: result.partial,
    abbruchGrund: result.abbruchGrund,
    seitenGeholt: result.seitenGeholt,
    skippedGroups: result.skippedGroups,
    skippedNonInbox: result.skippedNonInbox,
    skippedAds: result.skippedAds,
    // Wie viel Gespräch je Thread aus der Katalog-Abfrage fällt. Fällt das auf
    // ~1 Nachricht je Thread zurück, arbeitet der Entwürfe-Agent wieder blind —
    // dann steht die Zahl wenigstens im Auftrags-Ergebnis statt im Nebel.
    verlaufNachrichten: result.verlaufNachrichten,
    threadsMitMehrAlsEiner: result.threadsMitMehrAlsEiner,
    mailboxUrn: result.mailboxUrn,
    dryRun,
    elapsedMs: Date.now() - startedAt,
  }
}

// CLI: `node runner/linkedin/sync.mjs --dry-run` — gibt JSON auf stdout aus, schreibt nichts.
if (process.argv[1] && import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href) {
  const dryRun = process.argv.includes('--dry-run')
  syncThreads({ dryRun })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2))
      if (r.partial) {
        console.error(`HINWEIS: partial=true — ${r.threads.length} Threads sind evtl. nicht die Gesamtmenge (RECON-1 offen).`)
      }
    })
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}
