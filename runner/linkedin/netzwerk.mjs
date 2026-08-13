/**
 * runner/linkedin/netzwerk.mjs — Kevins Netzwerk lesen (Wargame `funnel-stufen.md`, Zug F3).
 *
 * Zwei Listen, dieselbe Mechanik wie der Postfach-Sync: CDP gegen das
 * Sync-Chrome (`~/.uriel-chrome`, Port 9222), rein lesend — kein Klick, kein
 * Senden, kein Zurückziehen einer Einladung.
 *
 *   - **Gesendete Einladungen** (`/mynetwork/invitation-manager/sent/`)
 *     → wer hat noch NICHT angenommen (die InMail-Kandidaten)
 *   - **Kontakte** (`/mynetwork/invite-connect/connections/`)
 *     → wer HAT angenommen (Basis für „angenommen, nie angeschrieben")
 *
 * **Warum DOM statt GraphQL.** Am 12.08. gemessen: beim Nachladen dieser beiden
 * Listen feuert die Seite **keinen einzigen** Netzwerk-Request — sie rendert aus
 * einem Store, den sie schon hält. Es gibt also keine Query zum Replayen, wie
 * sie `sync.mjs` für das Postfach nutzt. Geerntet wird deshalb der gerenderte
 * DOM; das Blättern ist ein Scroll im `main`-Container, der zuverlässig zehn
 * Einträge je Runde nachlegt.
 *
 * Die Auswertung selbst steht in `netzwerkParse.mjs` und ist ohne Browser
 * prüfbar (`npx tsx scripts/verify-netzwerk-parse.ts`).
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gesamtzahlAus, istVollstaendig, karteZuEintrag } from './netzwerkParse.mjs'

const CDP = 'http://127.0.0.1:9222'
const HARD_TIMEOUT_MS = 120_000

/**
 * Ein Lauf zur Zeit — über Prozessgrenzen hinweg.
 *
 * **Warum eine Datei und nicht ein Flag.** Der Runner hält seinen Guard im
 * Speicher; ein Handlauf im Terminal ist ein anderer Prozess und weiss davon
 * nichts. Am 12.08. liefen genau so zwei Läufe gleichzeitig über dieselben
 * Chrome-Tabs: beide navigierten, beide scrollten, beide ernteten Bruchstücke
 * — 220 von 882 und 70 von 642, beide als unvollständig markiert. Nichts ging
 * kaputt (dafür sorgt die Vollständigkeits-Regel), aber die Zeit war weg.
 *
 * Der Lock verfällt nach 20 Minuten: ein abgestürzter Lauf soll den nächsten
 * nicht bis zum Neustart blockieren. Ein regulärer Lauf braucht fünf.
 */
const LOCK_PFAD = join(tmpdir(), 'uriel-netzwerk-sync.lock')
const LOCK_MAX_MS = 20 * 60 * 1000

function lockNehmen() {
  try {
    const roh = JSON.parse(readFileSync(LOCK_PFAD, 'utf8'))
    const alter = Date.now() - Number(roh.seit ?? 0)
    if (alter < LOCK_MAX_MS) {
      return { ok: false, seit: roh.seit, pid: roh.pid }
    }
  } catch {
    /* kein Lock da — gut */
  }
  writeFileSync(LOCK_PFAD, JSON.stringify({ pid: process.pid, seit: Date.now() }), 'utf8')
  return { ok: true }
}

function lockFreigeben() {
  try {
    rmSync(LOCK_PFAD, { force: true })
  } catch {
    /* egal — er verfällt ohnehin */
  }
}

export const SEITEN = {
  einladungen: {
    url: 'https://www.linkedin.com/mynetwork/invitation-manager/sent/',
    muster: 'invitation-manager/sent',
    status: 'offen',
  },
  kontakte: {
    url: 'https://www.linkedin.com/mynetwork/invite-connect/connections/',
    muster: 'invite-connect/connections',
    status: 'angenommen',
  },
}

/**
 * Wie viele Scroll-Runden höchstens. Bei zehn Einträgen je Runde deckt das
 * ~1.500 Personen ab — reichlich über Kevins 882 Einladungen und 642 Kontakten.
 * Der Deckel ist eine Reissleine gegen eine Endlosschleife, keine Erwartung.
 */
const MAX_RUNDEN = 160
/**
 * Nach so vielen Runden ohne einen einzigen neuen Eintrag ist Schluss.
 * Fünf statt einer: das Nachladen setzt gelegentlich einen Takt aus, und ein
 * zu früher Abbruch kostet den ganzen Lauf seine Vollständigkeit.
 */
const RUNDEN_OHNE_ZUWACHS = 5

/**
 * Pause zwischen zwei Scroll-Runden. 1,1 s war messbar zu kurz — die Seite
 * legte dann nichts nach und der Lauf endete bei 130 von 882 (12.08.).
 * Mit 2,2 s kommen zuverlässig zehn Einträge je Runde.
 */
const RUNDEN_PAUSE_MS = 2200

async function tabFinden(muster) {
  const list = await (await fetch(`${CDP}/json`)).json()
  return list.find((t) => t.type === 'page' && String(t.url).includes(muster) && t.webSocketDebuggerUrl)
}

async function tabBesorgen(seite) {
  let tab = await tabFinden(seite.muster)
  if (tab) return tab
  // PUT, nicht GET — neuere Chrome-Versionen antworten auf GET /json/new mit 405.
  await fetch(`${CDP}/json/new?${seite.url}`, { method: 'PUT' })
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    tab = await tabFinden(seite.muster)
    if (tab) return tab
  }
  throw new Error(`Tab für ${seite.muster} kam nicht hoch`)
}

/**
 * Ein beliebiger CDP-Befehl. Gebraucht wird genau einer: `Page.bringToFront`.
 *
 * **Der Grund ist der teuerste Befund dieser Runde.** Chrome drosselt
 * Hintergrund-Tabs: `IntersectionObserver` und `requestAnimationFrame` stehen
 * dort still. Die Einladungsliste hängt genau daran — sie lädt beim Scrollen
 * nach, wenn der Beobachter am Listenende feuert. Im Hintergrund passiert das
 * nie: am 12.08. gemessen, zwanzig Runden lang scrollte der Tab brav auf
 * Position 476 von 1163 und blieb bei zehn Einträgen stehen. Nach vorn geholt
 * lädt dieselbe Seite zuverlässig nach.
 */
function cdpBefehl(wsUrl, method, params = {}, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => { try { ws.close() } catch {} ; reject(new Error('CDP-Timeout')) }, timeoutMs)
    ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method, params })))
    ws.addEventListener('message', (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.id !== 1) return
      clearTimeout(timer)
      try { ws.close() } catch {}
      if (msg.error) return reject(new Error(msg.error.message || 'CDP-Fehler'))
      resolve(msg.result)
    })
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket-Fehler')) })
  })
}

/**
 * Eine CDP-Sitzung, die über den ganzen Lauf offen bleibt.
 *
 * **Nicht nur Sparsamkeit — Voraussetzung.** Mit einer Verbindung je Aufruf
 * (auf und wieder zu) drosselt Chrome den Tab zwischen den Runden, und die
 * Liste legt nichts nach: am 12.08. blieb der Lauf so bei 20 von 882 stehen,
 * obwohl der Tab vorne lag. Eine durchgehend offene Sitzung hält ihn wach —
 * damit läuft dieselbe Seite sauber durch.
 */
function sitzung(wsUrl) {
  const ws = new WebSocket(wsUrl)
  const offen = new Map()
  let naechsteId = 1
  let bereit = new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', () => rej(new Error('WebSocket-Fehler')))
  })

  ws.addEventListener('message', (ev) => {
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    const eintrag = offen.get(msg.id)
    if (!eintrag) return
    offen.delete(msg.id)
    clearTimeout(eintrag.timer)
    if (msg.error) return eintrag.reject(new Error(msg.error.message || 'CDP-Fehler'))
    if (msg.result?.exceptionDetails) {
      return eintrag.reject(new Error(msg.result.exceptionDetails.text || 'Page-Exception'))
    }
    eintrag.resolve(msg.result)
  })

  const senden = (method, params, timeoutMs) =>
    bereit.then(
      () =>
        new Promise((resolve, reject) => {
          const id = naechsteId++
          const timer = setTimeout(() => {
            offen.delete(id)
            reject(new Error(`CDP-Timeout (${timeoutMs / 1000}s)`))
          }, timeoutMs)
          offen.set(id, { resolve, reject, timer })
          ws.send(JSON.stringify({ id, method, params }))
        }),
    )

  return {
    befehl: (method, params = {}, timeoutMs = 15_000) => senden(method, params, timeoutMs),
    auswerten: (expression, timeoutMs = 30_000) =>
      senden('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs).then(
        (r) => r?.result?.value,
      ),
    schliessen: () => { try { ws.close() } catch {} },
    /** Nach einer Navigation ist die Sitzung tot — dann eine neue holen. */
    neu: () => sitzung(wsUrl),
  }
}

function evaluate(wsUrl, expression, timeoutMs = HARD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => {
      try { ws.close() } catch {}
      reject(new Error(`CDP-Timeout (${timeoutMs / 1000}s)`))
    }, timeoutMs)
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
      if (msg.error) return reject(new Error(msg.error.message || JSON.stringify(msg.error)))
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

/**
 * Der Ausdruck läuft im Seitenkontext. Er scrollt einmal und erntet ALLES, was
 * gerade im DOM steht — nicht nur das Neue. Das ist billiger, als Zustand über
 * mehrere Aufrufe zu halten, und es überlebt eine SPA, die zwischendurch
 * neu rendert.
 *
 * Die Karte einer Person ist der kleinste Vorfahre des Profil-Links, der genau
 * EINEN solchen Link enthält. Über feste CSS-Klassen zu gehen wäre chancenlos:
 * LinkedIns Klassennamen sind Build-Hashes (`_48a6224d`) und wechseln je Release.
 */
/**
 * Scrollen und Ernten sind ZWEI Aufrufe, nicht einer.
 *
 * Beides zusammen im selben Ausdruck erntet den Stand VOR dem Nachladen und
 * die Seite legt dann nichts mehr nach — am 12.08. blieb der Lauf so bei 10
 * von 882 stehen. Getrennt, mit einer Pause dazwischen, kommen zuverlässig
 * zehn Einträge je Runde. Gescrollt wird in beiden Containern: `main` trägt
 * die Liste, das Dokument den Rest der Seite.
 */
const SCROLL_EXPR = `(() => {
  const m = document.querySelector('main');
  if (m) m.scrollTop = m.scrollHeight;
  const d = document.scrollingElement || document.documentElement;
  if (d) d.scrollTop = d.scrollHeight;
  return document.querySelectorAll('a[href*="/in/"]').length;
})()`

const ERNTE_EXPR = `(() => {
  if (document.querySelector('input[type=password]') || location.href.includes('/uas/login')) {
    return { loginWall: true };
  }
  const links = [...document.querySelectorAll('a[href*="/in/"]')];
  const gesehen = new Set();
  const karten = [];
  for (const a of links) {
    const href = (a.getAttribute('href') || '').split('?')[0];
    if (!href || gesehen.has(href)) continue;
    gesehen.add(href);
    // Nach oben, solange der Vorfahre nur auf DIESE eine Person zeigt.
    // Gezählt werden eindeutige Profil-Ziele, nicht Link-Elemente: eine Karte
    // verlinkt dieselbe Person zweimal (Bild und Name). Wer Elemente zählt,
    // bleibt eine Ebene zu tief stehen — dann steht der Name da, aber Headline
    // und Datum fehlen (am 12.08. genau so gemessen: 622 Namen, 0 Headlines).
    const zieleIn = (el) =>
      new Set([...el.querySelectorAll('a[href*="/in/"]')].map((x) => (x.getAttribute('href') || '').split('?')[0])).size;
    let k = a, best = a;
    for (let i = 0; i < 9 && k; i++) {
      k = k.parentElement;
      if (!k) break;
      if (zieleIn(k) !== 1) break;
      best = k;
    }
    karten.push({
      href,
      nameAusBild: best.querySelector('img')?.getAttribute('alt') || a.querySelector('img')?.getAttribute('alt') || '',
      zeilen: (best.innerText || '').split('\\n').map((s) => s.trim()).filter(Boolean).slice(0, 10),
    });
  }
  return {
    karten,
    kopfText: (document.body.innerText || '').slice(0, 300),
    href: location.href,
  };
})()`

/**
 * Eine Liste vollständig einsammeln.
 *
 * Rückgabe trägt IMMER `vollstaendig` — daran hängt, ob der Aufrufer
 * Abwesenheits-Schlüsse ziehen darf (wer nicht mehr in der Einladungsliste
 * steht, hat angenommen oder wurde zurückgezogen). Ein abgebrochener Lauf darf
 * das nie entscheiden.
 */
export async function leseListe(seitenName, { maxRunden = MAX_RUNDEN, jetzt = new Date(), log = () => {} } = {}) {
  const seite = SEITEN[seitenName]
  if (!seite) throw new Error(`unbekannte Liste: ${seitenName}`)

  const tab = await tabBesorgen(seite)
  // EINE Sitzung für den ganzen Lauf (siehe `sitzung`): sie hält den Tab wach.
  let s = sitzung(tab.webSocketDebuggerUrl)

  // Ohne das lädt die Liste nicht nach (siehe `cdpBefehl`). Der Tab liegt im
  // Sync-Chrome, einem eigenen Fenster — er drängt sich nirgends dazwischen.
  try {
    await s.befehl('Page.bringToFront')
  } catch (e) {
    log(`[netzwerk] Tab nicht nach vorn zu holen (${e.message}) — Nachladen könnte ausbleiben`)
  }

  // Frisch laden. Eine Seite, die schon durchgescrollt wurde, legt nichts mehr
  // nach — sie blieb am 12.08. reproduzierbar stehen, egal wie lange man
  // weiterscrollte. Nach dem Neuladen läuft das Nachladen wieder sauber.
  try {
    await s.befehl('Page.navigate', { url: seite.url })
  } catch {
    /* Navigation reisst die Antwort ab — kein Fehler. */
  }

  // Warten, bis die Liste steht. Direkt nach der Navigation antwortet CDP mit
  // „Cannot find default execution context".
  let bereit = false
  for (let i = 0; i < 30 && !bereit; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const n = await s.auswerten(`(() => document.querySelectorAll('a[href*="/in/"]').length)()`, 8000)
      bereit = typeof n === 'number' && n > 0
    } catch {
      /* noch nicht so weit */
    }
  }
  if (!bereit) throw new Error(`Liste ${seitenName} kam nach dem Laden nicht hoch`)
  await s.befehl('Page.bringToFront').catch(() => {})

  const nachKey = new Map()
  let gesamt = null
  let ohneZuwachs = 0
  let runden = 0

  for (; runden < maxRunden; runden++) {
    let roh
    try {
      // Erst scrollen, dann warten, dann ernten — siehe SCROLL_EXPR.
      await s.auswerten(SCROLL_EXPR, 15_000)
      await new Promise((r) => setTimeout(r, RUNDEN_PAUSE_MS))
      roh = await s.auswerten(ERNTE_EXPR, 30_000)
    } catch (e) {
      // Kontext weg (SPA-Rerender) — Sitzung erneuern und weitermachen.
      log(`[netzwerk] Runde ${runden}: ${e.message} — Sitzung erneuern`)
      try { s.schliessen() } catch {}
      s = sitzung(tab.webSocketDebuggerUrl)
      await new Promise((r) => setTimeout(r, 1500))
      continue
    }
    if (roh?.loginWall) return { loginWall: true, seite: seitenName }

    if (gesamt === null) gesamt = gesamtzahlAus(roh?.kopfText ?? '')

    const vorher = nachKey.size
    for (const karte of roh?.karten ?? []) {
      const eintrag = karteZuEintrag(karte, jetzt)
      if (eintrag) nachKey.set(eintrag.profilKey, eintrag)
    }

    if (nachKey.size === vorher) ohneZuwachs++
    else ohneZuwachs = 0

    if (gesamt && nachKey.size >= gesamt) break
    if (ohneZuwachs >= RUNDEN_OHNE_ZUWACHS) break
  }

  s.schliessen()

  const eintraege = [...nachKey.values()]
  return {
    seite: seitenName,
    status: seite.status,
    eintraege,
    gesamt,
    runden,
    vollstaendig: istVollstaendig(eintraege.length, gesamt),
  }
}

/** Beide Listen nacheinander — Einladungen zuerst, weil sie länger ist. */
export async function leseNetzwerk(optionen = {}) {
  const start = Date.now()
  const einladungen = await leseListe('einladungen', optionen)
  if (einladungen.loginWall) return einladungen
  const kontakte = await leseListe('kontakte', optionen)
  if (kontakte.loginWall) return kontakte
  return { einladungen, kontakte, elapsedMs: Date.now() - start }
}

/**
 * Einen Lauf unter dem prozessübergreifenden Lock ausführen.
 *
 * Der Aufrufer bekommt `{ blockiert: true }` zurück, wenn schon einer läuft —
 * das ist kein Fehler, sondern die richtige Antwort.
 */
export async function mitNetzwerkLock(fn) {
  const lock = lockNehmen()
  if (!lock.ok) {
    return { blockiert: true, seit: lock.seit ? new Date(lock.seit).toISOString() : null, pid: lock.pid }
  }
  try {
    return await fn()
  } finally {
    lockFreigeben()
  }
}

// --- Direktaufruf: node runner/linkedin/netzwerk.mjs [--dry-run] [liste] ----
// `pathToFileURL`, nicht `file://${argv[1]}` — der Repo-Pfad enthält ein
// Leerzeichen („Kevin OS"), und nur die URL-Form kodiert es gleich.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const nurListe = process.argv.find((a) => a === 'einladungen' || a === 'kontakte')
  const log = (...a) => console.log(...a)
  const zeigen = (r) => {
    console.log(
      `\n${r.seite}: ${r.eintraege.length} geerntet` +
        (r.gesamt ? ` von ${r.gesamt} laut Seite` : ' (Gesamtzahl unbekannt)') +
        ` · ${r.runden} Runden · vollständig: ${r.vollstaendig ? 'JA' : 'NEIN'}`,
    )
    for (const e of r.eintraege.slice(0, 5)) {
      console.log(`  ${e.name.padEnd(28)} ${(e.headline || '—').slice(0, 44).padEnd(46)} ${e.eingeladenAt ?? e.angenommenAt ?? ''}`)
    }
  }
  if (nurListe) {
    zeigen(await leseListe(nurListe, { log }))
  } else {
    const r = await leseNetzwerk({ log })
    if (r.loginWall) console.log('LOGIN-WALL — im Sync-Chrome bei LinkedIn anmelden')
    else {
      zeigen(r.einladungen)
      zeigen(r.kontakte)
      console.log(`\nDauer: ${Math.round(r.elapsedMs / 1000)}s`)
    }
  }
  process.exit(0)
}
