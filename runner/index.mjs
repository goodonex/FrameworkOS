/**
 * Cockpit-Runner (REBUILD-PLAN §6)
 * Lokaler Agenten-Runner: nimmt Button-Intents aus der Webapp entgegen,
 * spawnt `claude -p` headless mit cwd = Vault und schreibt das Ergebnis
 * als Markdown nach <Vault>/System/Runs/ — sichtbar in Obsidian + Cockpit.
 *
 * Bewusst zero-dependency (node:http). Bindet NUR an 127.0.0.1.
 * Start: node runner/index.mjs   (oder: npm run cockpit im Repo-Root)
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { syncThreads } from './linkedin/sync.mjs'
import { upsertThreads } from './linkedin/upsert.mjs'
import { ladeErstnachrichten } from './linkedin/erstnachrichten.mjs'
import { baueAntwortInput, holeAntwortThreads } from './linkedin/antwortThreads.mjs'
import { parseDraftsRoh, schreibeEntwuerfe } from './linkedin/entwuerfe.mjs'

// ---------- Lokale .env (nur für Secrets wie den Supabase-Key; gitignored) ----------
// Minimaler Parser (zero-dependency). Prozess-Env hat Vorrang vor der Datei.
function loadLocalEnv() {
  try {
    const raw = readFileSync(new URL('.env', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const key = m[1]
      if (process.env[key] != null) continue // Prozess-Env gewinnt
      let val = m[2].trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1)
      process.env[key] = val
    }
  } catch {
    /* keine .env → Snapshot-Push bleibt einfach aus */
  }
}
loadLocalEnv()

// ---------- Konfiguration ----------
const PORT = Number(process.env.RUNNER_PORT ?? 4711)
const VAULT = resolve(process.env.VAULT_PATH ?? join(homedir(), 'Second Brain'))
const RUNS_DIR = join(VAULT, 'System', 'Runs')
const QUEUE_DIR = join(VAULT, 'System', 'Queue')
const TIMEOUT_MS = 10 * 60 * 1000 // 10 Minuten (Plan §6)

// OS-Map-Snapshot → Supabase, damit die HTTPS-Live-Domain (frameworkos.de) den
// Graphen zeigt, ohne dass der lokale Runner erreichbar ist. Der Runner spiegelt
// die Map periodisch selbst; kein localhost-Cockpit-Tab mehr nötig. Service-Role-Key
// bleibt lokal in runner/.env. Fehlt er, läuft der Runner normal weiter (Push aus).
const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SNAPSHOT_PUSH_MS = Number(process.env.SNAPSHOT_PUSH_MS ?? 60_000)
const HEARTBEAT_PUSH_MS = Number(process.env.HEARTBEAT_PUSH_MS ?? 15_000)
const SNAPSHOT_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)

// Kunden-Ads (Cockpit /ads): Ad-Creatives + Manifeste liegen in den Kundenordnern.
const KUNDEN_ROOT = resolve(process.env.KUNDEN_ROOT ?? join(homedir(), 'Kevin OS', '02 Projekte', 'Kunden'))
const KUNDEN_CONFIG = join(KUNDEN_ROOT, 'cockpit-kunden.json')
const MANIFEST_MAX_BYTES = 2_000_000

// Social-Content (Cockpit /content): Wochen-Batches der Content-Engine (Montags-Lauf).
// Die woche-<KW>.html ist self-contained (CSS inline, Bilder als Data-URI) → 1 Datei genügt.
const SOCIAL_ROOT = resolve(
  process.env.SOCIAL_ROOT ??
    join(homedir(), 'Kevin OS', '02 Projekte', 'Herrmann & Co', 'Intern', '04_social'),
)
const SOCIAL_WEEKLY = join(SOCIAL_ROOT, 'content-engine', 'weekly')

// Sales-Bibliothek (Cockpit /sales): Skripte-Ordner der Akquise. Env-überschreibbar.
const SALES_ROOT = resolve(
  process.env.SALES_ROOT ??
    join(homedir(), 'Kevin OS', '02 Projekte', 'Herrmann & Co', "2. SOP's & Skripte", 'Sales Skripte'),
)
const SALES_VAULT_DIR = join(VAULT, '03 Bereiche', 'Vertrieb & Outreach')

// Kalender (Cockpit /termine): der `/calendar`-Proxy bekommt die iCal-URL sonst
// vom Cockpit mitgeschickt — die liegt aber im localStorage des Macs, also hat
// das Handy sie nie. Für den Spiegel braucht der Runner deshalb eine eigene
// Adresse. Der private iCal-Link ist ein Geheimnis wie der Service-Role-Key und
// bleibt aus demselben Grund in runner/.env, statt in die Datenbank zu wandern.
// Mehrere Kalender sind der Normalfall (Arbeit, Gesundheit, Planung, Tracking):
// kommagetrennte Liste, die Reihenfolge ist egal. Der Parser (icalParse.ts) ist
// zeilenbasiert und verträgt aneinandergehängte VCALENDAR-Blöcke.
const CALENDAR_ICAL_URLS = (process.env.CALENDAR_ICAL_URL ?? '')
  .split(',')
  .map((u) => u.trim())
  .filter((u) => /^https:\/\//i.test(u))

// Content-Manifest pro Brand (Cockpit /content, Post-Ebene). Feste Allowlist —
// der Brand-Slug wird NIE in einen Pfad interpoliert (kein Traversal). MVP: nur
// HERRMANN; weitere Brands (CoLective …) bekommen in Phase 3 einen eigenen Ordner.
const CONTENT_MANIFESTS = {
  herrmann: join(SOCIAL_ROOT, 'content-engine', 'content.json'),
}
function contentManifestPath(brand) {
  return CONTENT_MANIFESTS[brand] ?? null
}
function emptyContentManifest(brand) {
  return { schemaVersion: 1, brand, updatedAt: null, posts: [] }
}

/**
 * Agenten-Katalog fürs Cockpit (/agenten). Zwei Sorten:
 *  - kind:'readonly' → Vault-Skills (`/slug`), cwd=VAULT, kein Schreibrecht;
 *    der Agent liefert Markdown auf stdout, der Runner schreibt die Datei.
 *  - kind:'write'    → autonome Agenten mit eigenem cwd + Schreib-/Bash-Recht
 *    (z.B. Content-Batch: baut selbst Post-HTMLs + Galerie via build-gallery.mjs).
 * `prompt` bei write-Agenten ist ein direkter Auftrag (kein Slash-Command nötig).
 */
const AGENT_CATALOG = [
  {
    id: 'weekly-content',
    label: 'Content-Batch (Woche)',
    description:
      'Baut den wöchentlichen Instagram-Content-Batch (Content-Engine) und legt die klickbare Galerie-HTML ab.',
    kind: 'write',
    cwd: SOCIAL_ROOT,
    prompt:
      'Führe den wöchentlichen Content-Batch aus. Befolge exakt die Anleitung in ' +
      'content-engine/WEEKLY.md in DIESEM Ordner: bestimme die ISO-Woche, ziehe 3 frische ' +
      'Angles aus content-engine/backlog.md (Abgleich mit content-engine/log.md), baue je Angle ' +
      'ein Post-HTML + Captions, erzeuge die Galerie mit build-gallery.mjs und trage die Woche in ' +
      'content-engine/log.md ein. Kein Auto-Posting — nur das Review-Paket bauen.',
  },
  {
    id: 'wochenrecap',
    label: 'Wochenrecap',
    description: 'Fasst die Woche aus Vault + CRM zusammen (Fortschritt, Zahlen, offene Punkte).',
    kind: 'readonly',
  },
  {
    id: 'morgenbrief',
    label: 'Morgen-Brief',
    description: 'Knapper Tagesstart: fällige Follow-ups, Akquise-Stand, ein Fokus-Satz.',
    kind: 'readonly',
  },
  {
    id: 'followup-entwuerfe',
    label: 'Follow-up-Entwürfe',
    description: 'Entwirft fällige Follow-up-Nachrichten für offene Leads.',
    kind: 'readonly',
  },
  {
    id: 'linkedin-followup-entwuerfe',
    label: 'LinkedIn-Follow-up-Entwürfe',
    description: 'Entwirft Follow-up-DMs für fällige LinkedIn-Threads (Wargame linkedin-followups).',
    kind: 'readonly',
  },
  {
    id: 'linkedin-antwort-entwuerfe',
    label: 'Antwort-Entwürfe (LinkedIn)',
    description:
      'Entwirft Antworten auf Leads, die geschrieben haben und auf Kevin warten. Läuft nachts von selbst.',
    kind: 'readonly',
  },
  {
    id: 'lead-research',
    label: 'Lead-Research',
    description: 'Recherchiert einen Lead/Kandidaten und fasst Kernpunkte zusammen.',
    kind: 'readonly',
  },
  {
    id: 'dream-check',
    label: 'Dream-Check',
    description: 'Tägliche Kurzanalyse der eigenen Skill-Nutzung + 1–2 Verbesserungsideen.',
    kind: 'readonly',
  },
  {
    id: 'loom-skript',
    label: 'Loom-Skript (Lead)',
    description: 'Individualisiertes Loom-Skript für einen Lead (Akt 2 + Spickzettel + Begleit-DM).',
    kind: 'write',
    cwd: SALES_ROOT,
    prompt:
      'Baue für den Lead aus den Eingabedaten (name, website) ein individualisiertes Loom-Skript. ' +
      'Standard-Akte 1/3/4/5 aus der Sprechfassung im Vault ' +
      '(lies per Read: ' + JSON.stringify(join(SALES_VAULT_DIR, 'Loom-Skript (vollständige Sprechfassung).md')) + ') ' +
      'übernehmen — NUR Akt 2 (IST-Analyse: erst Positiv, dann 3 Optimierungspunkte), Spickzettel und ' +
      'Begleit-DM individualisieren. Website per WebFetch analysieren (Eigentümer-Seite? Bewertungstool? ' +
      'käufer- vs. eigentümerlastig? modern/veraltet?). Ausgabe: EINE selbst-enthaltene HTML-Datei ' +
      '"Loom-Skript <YYYY-MM-DD> (<Name>).html" im Stil von "Loom-Batch 2026-07-23 (6 Leads).html" ' +
      '(liegt in DIESEM Ordner, als Vorbild lesen) in DIESEM Ordner. Regeln: Fehler zeigen = Mehrwert, ' +
      'WAS+WARUM nie WIE, kein Sales-Angebot im CTA, keine Emojis. JS-Strings: deutsche Anführungszeichen ' +
      'NIE als „…" mit ASCII-Schließquote (bricht den JS-String) — nutze einen Helper wie ' +
      "const G=s=>'„'+s+'“' oder durchgängig curly-Anführungszeichen. Vor Abschluss den <script>-Teil " +
      'mit `node --check` validieren.',
  },
  {
    id: 'followup-pdf',
    label: 'Follow-up-PDF (Lead)',
    description: 'Individuelle Follow-up-Analyse (V2-Template + Screenshots + Score) für einen Lead.',
    kind: 'write',
    cwd: SALES_ROOT,
    prompt:
      'Baue für den Lead aus den Eingabedaten (name, website) die individuelle Follow-up-Analyse: ' +
      '"follow-up-analyse-template-v2.html" (liegt in DIESEM Ordner) kopieren nach ' +
      '"Follow-up-Analyse <Name>.html", anhand "follow-up-analyse-rubrik.md" (liegt in DIESEM Ordner) ' +
      'und einer WebFetch-Analyse der Website befüllen (Eigentümer-Score /100, 6 Kriterien je /10, ' +
      'Mini-Technik-Check SEO/Ladezeit/DSGVO). Screenshots: 3 Aufnahmen (Startseite, Bewertungs-/' +
      'Formularseite, Kontakt) via ' +
      '`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu ' +
      '--screenshot=<datei>.png --window-size=1280,800 <url>`; schlägt ein Screenshot fehl → graues ' +
      'Platzhalter-Panel mit Seitentitel einsetzen und im Abschlussbericht WARN melden, NICHT abbrechen. ' +
      'Danach PDF erzeugen: ' +
      '`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu ' +
      '--print-to-pdf="Follow-up-Analyse <Name>.pdf" "Follow-up-Analyse <Name>.html"`; 3 Seiten via ' +
      '.page.mt-Umbrüche. Keine Preise nennen, CTA nur Quali-Call.',
  },
]

const AGENT_BY_ID = new Map(AGENT_CATALOG.map((a) => [a.id, a]))

/** Ausführungs-Konfig je Agent: cwd, Prompt-Builder, zusätzliche CLI-Flags. */
function agentConfig(agent) {
  const a = AGENT_BY_ID.get(agent)
  if (!a) return null
  if (a.kind === 'write') {
    return {
      cwd: a.cwd,
      buildPrompt: (inputBlock) => `${a.prompt}${inputBlock}`,
      // Scoped, KEIN Blanket-Bypass: acceptEdits erlaubt nur Datei-Writes im
      // cwd; die konkreten Build-Befehle (node/mkdir/…) sind in a.cwd/.claude/
      // settings.json allow-gelistet. Alles andere wird headless verweigert.
      extraArgs: ['--permission-mode', 'acceptEdits'],
    }
  }
  return { cwd: VAULT, buildPrompt: (inputBlock) => `/${agent}${inputBlock}`, extraArgs: [] }
}

// ---------- Zustand ----------
/** @type {Map<string, {id:string, agent:string, startedAt:string, proc:import('node:child_process').ChildProcess}>} */
const running = new Map()
let linkedinSyncRunning = false

// ---------- Helpers ----------
function nowStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  let data = ''
  for await (const chunk of req) data += chunk
  return data ? JSON.parse(data) : {}
}

async function writeRunFile(id, agent, status, startedAt, content) {
  const file = join(RUNS_DIR, `${id}.md`)
  const frontmatter = [
    '---',
    `agent: ${agent}`,
    `status: ${status}`,
    `started: ${startedAt}`,
    `finished: ${new Date().toISOString()}`,
    '---',
    '',
  ].join('\n')
  await writeFile(file, frontmatter + content, 'utf8')
  return file
}

/** Wie viele Runs der Spiegel mitnimmt (Liste + Inhalt). */
const RUNS_SPIEGEL_LIMIT = 20
/** Deckel je Run-Inhalt im Spiegel — ein Ausreißer soll die Zeile nicht sprengen. */
const RUN_CONTENT_MAX = 40_000

/** Frontmatter-light-Parser für die Runs-Liste. */
function parseRun(name, raw) {
  const meta = { agent: 'unbekannt', status: 'done', started: '', finished: '' }
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (m) {
    for (const line of m[1].split('\n')) {
      const [k, ...rest] = line.split(':')
      if (k && rest.length) meta[k.trim()] = rest.join(':').trim()
    }
  }
  const body = m ? raw.slice(m[0].length) : raw
  const preview = body.trim().split('\n').slice(0, 3).join(' ').slice(0, 160)
  return { id: name.replace(/\.md$/, ''), ...meta, preview }
}

/**
 * Runs-Liste, laufende voran — Quelle für `/runs` UND für den Spiegel.
 * `mitInhalt` hängt den Run-Text an: der Spiegel braucht ihn, damit die
 * Freigaben-Queue und der Run-Drawer auch ohne Runner-Port lesen können.
 */
async function runsListe(limit, mitInhalt = false) {
  const names = (await readdir(RUNS_DIR))
    .filter((n) => n.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, limit)
  const runs = []
  for (const name of names) {
    const raw = await readFile(join(RUNS_DIR, name), 'utf8')
    const eintrag = parseRun(name, raw)
    if (mitInhalt) {
      eintrag.content = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').slice(0, RUN_CONTENT_MAX)
    }
    runs.push(eintrag)
  }
  const aktiv = [...running.values()].map(({ id, agent, startedAt }) => ({
    id,
    agent,
    status: 'running',
    started: startedAt,
    finished: '',
    preview: 'läuft…',
    ...(mitInhalt ? { content: '' } : {}),
  }))
  return [...aktiv, ...runs]
}

/**
 * Eingabe für `linkedin-antwort-entwuerfe`: die Threads, in denen der Lead
 * geschrieben hat und auf Kevin wartet. Wird hier im Runner gebaut, nicht im
 * Cockpit — so gibt es genau eine Fassung der Auswahlregel, und der Knopf am
 * Handy schickt keine Thread-Daten über die Brücke.
 */
async function antwortEntwuerfeInput(now = new Date()) {
  if (!SNAPSHOT_ENABLED) return null
  const { threads } = await holeAntwortThreads({
    supabaseUrl: SUPABASE_URL,
    headers: supabaseHeaders(),
    brandSlug: process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann',
    now,
  })
  if (!threads.length) return null
  return baueAntwortInput(threads, now)
}

/**
 * Nach einem fertigen `linkedin-antwort-entwuerfe`-Lauf: Entwürfe aus dem
 * Markdown lösen und an die Threads schreiben. Erst damit klebt der Entwurf am
 * Posten statt im Run — der Unterschied zwischen „ist irgendwo" und „ist da".
 *
 * Fehler hier dürfen den Lauf nicht nachträglich zum Fehlschlag machen: das
 * Markdown steht bereits in der Run-Datei und in der Freigaben-Queue.
 */
async function entwuerfeAnThreads(runId, markdown) {
  if (!SNAPSHOT_ENABLED) return
  try {
    const drafts = parseDraftsRoh(markdown)
    if (!drafts.length) {
      console.warn(`[runner] ${runId}: kein verwertbarer json-Block — keine Entwürfe am Posten`)
      return
    }
    const brandSlug = process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann'
    const br = await fetch(
      `${SUPABASE_URL}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&select=id&limit=1`,
      { headers: supabaseHeaders() },
    )
    const [brand] = br.ok ? await br.json() : []
    if (!brand?.id) return

    const r = await schreibeEntwuerfe({
      supabaseUrl: SUPABASE_URL,
      headers: supabaseHeaders(),
      brandId: brand.id,
      runId,
      drafts,
    })
    console.log(
      `[runner] Entwürfe am Posten: ${r.geschrieben} geschrieben` +
        (r.ohneThread ? ` · ${r.ohneThread} ohne thread_key` : '') +
        (r.nichtGefunden ? ` · ${r.nichtGefunden} ohne passenden Thread` : ''),
    )
  } catch (e) {
    console.error('[runner] Entwürfe konnten nicht an die Threads geschrieben werden:', e?.message ?? e)
  }
}

// ---------- Agent starten ----------
async function startRun(agent, input) {
  const id = `${nowStamp()}-${agent}`
  const startedAt = new Date().toISOString()

  // Der Antwort-Entwürfe-Agent holt seine Threads immer hier — egal ob der
  // Start vom Cockpit, von der Brücke oder aus der Nacht-Routine kommt.
  if (agent === 'linkedin-antwort-entwuerfe' && !Array.isArray(input?.threads)) {
    const gebaut = await antwortEntwuerfeInput()
    if (!gebaut) {
      throw Object.assign(new Error('Keine wartenden Antworten — nichts zu entwerfen.'), { code: 'ELEER' })
    }
    input = gebaut.input
  }

  // Intent in die Queue (Nachvollziehbarkeit + Debugging)
  await writeFile(
    join(QUEUE_DIR, `${id}.json`),
    JSON.stringify({ id, agent, input, startedAt }, null, 2),
    'utf8',
  )

  const cfg = agentConfig(agent)
  if (!cfg) throw Object.assign(new Error(`Unbekannter Agent: ${agent}`), { code: 'EAGENT' })

  const inputBlock = input && Object.keys(input).length
    ? `\n\nEingabedaten (JSON):\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\``
    : ''
  const prompt = cfg.buildPrompt(inputBlock)

  // Unter launchd fehlt claude oft im PATH → gängige Bin-Verzeichnisse anhängen.
  const extraBins = [
    join(homedir(), '.nvm', 'versions', 'node', `v${process.versions.node}`, 'bin'),
    join(homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ]
  const PATH = [process.env.PATH ?? '', ...extraBins].filter(Boolean).join(':')

  const proc = spawn(
    process.env.CLAUDE_BIN ?? 'claude',
    ['-p', prompt, '--output-format', 'text', ...cfg.extraArgs],
    {
      cwd: cfg.cwd,
      env: { ...process.env, PATH },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let stdout = ''
  let stderr = ''
  proc.stdout.on('data', (c) => (stdout += c))
  proc.stderr.on('data', (c) => (stderr += c))

  const timeout = setTimeout(() => {
    proc.kill('SIGTERM')
  }, TIMEOUT_MS)

  running.set(id, { id, agent, startedAt, proc })

  // spawn-Fehler (z.B. claude nicht im PATH) dürfen den Runner NICHT crashen —
  // ohne diesen Handler wirft der ChildProcess ein unhandled 'error' Event
  // (beobachtet: ENOENT-Crash-Loop unter launchd am 08.07.).
  proc.on('error', async (e) => {
    clearTimeout(timeout)
    running.delete(id)
    try {
      await writeRunFile(
        id,
        agent,
        'error',
        startedAt,
        `# Run konnte nicht starten\n\n\`\`\`\n${String(e?.message ?? e)}\n\`\`\`\n`,
      )
    } catch {
      /* Log reicht */
    }
    console.error(`[runner] spawn-Fehler für ${id}:`, e?.message ?? e)
    await pushRunsSnapshot()
  })

  proc.on('close', async (code) => {
    clearTimeout(timeout)
    running.delete(id)
    try {
      if (code === 0 && stdout.trim()) {
        await writeRunFile(id, agent, 'done', startedAt, stdout.trim() + '\n')
        if (agent === 'linkedin-antwort-entwuerfe') await entwuerfeAnThreads(id, stdout)
      } else {
        const err = [
          `# Run fehlgeschlagen (Exit ${code})`,
          '',
          '```',
          (stderr || stdout || 'kein Output').slice(-3000),
          '```',
        ].join('\n')
        await writeRunFile(id, agent, 'error', startedAt, err + '\n')
      }
    } catch (e) {
      console.error(`[runner] Run-Datei für ${id} konnte nicht geschrieben werden:`, e)
    }
    // Ergebnis direkt spiegeln statt auf den 60s-Tick zu warten — daran hängen
    // Freigaben-Queue, Run-Toasts und der „Skript fertig"-Zustand am Handy.
    await pushRunsSnapshot()
  })

  // Erst hier spiegeln — und bewusst abwarten: über die Brücke gilt der Auftrag
  // als erledigt, sobald startRun zurückkommt; ohne das Warten könnte das
  // Cockpit direkt danach noch den alten Spiegel lesen und den Start für
  // verpufft halten. NACH den Handlern, sonst verpasst das await ein 'close'
  // oder 'error', das während des Netzwerk-Aufrufs feuert.
  await pushRunsSnapshot()

  return { id, agent, startedAt }
}

// ---------- Vault: Wikilink-Graph (Obsidian-Gefühl) ----------
/** @type {{at:number, data:{nodes:Array<{path:string,name:string,links:number}>, edges:Array<{source:string,target:string}>}}|null} */
let graphCache = null
const GRAPH_CACHE_MS = 60_000
const GRAPH_MAX_NOTES = 100

async function vaultGraph() {
  if (graphCache && Date.now() - graphCache.at < GRAPH_CACHE_MS) return graphCache.data

  const notes = await recentNotes(GRAPH_MAX_NOTES)
  const byName = new Map() // basename (lowercase) → path
  for (const n of notes) byName.set(n.name.toLowerCase(), n.path)

  const edges = []
  const linkCount = new Map()
  for (const n of notes) {
    let raw
    try {
      raw = await readFile(join(VAULT, n.path), 'utf8')
    } catch {
      continue
    }
    // [[Ziel]] / [[Ziel|Alias]] / [[Ziel#Abschnitt]]
    for (const m of raw.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
      const target = byName.get(m[1].trim().toLowerCase())
      if (!target || target === n.path) continue
      edges.push({ source: n.path, target })
      linkCount.set(n.path, (linkCount.get(n.path) ?? 0) + 1)
      linkCount.set(target, (linkCount.get(target) ?? 0) + 1)
    }
  }

  const data = {
    nodes: notes.map((n) => ({ path: n.path, name: n.name, links: linkCount.get(n.path) ?? 0 })),
    edges,
  }
  graphCache = { at: Date.now(), data }
  return data
}

// ---------- Agentic-OS-Map (AGENTIC-OS-PLAN.md) ----------
const GLOBAL_SKILLS_DIR = join(homedir(), '.claude', 'skills')
const VAULT_SKILLS_DIR = join(VAULT, '.claude', 'skills')
const OS_APPS_FILE = join(VAULT, 'System', 'os-apps.json')

/** SKILL.md-Frontmatter-light: name + description (erste ~4KB reichen). */
function parseSkillMeta(raw) {
  const meta = {}
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  return meta
}

async function collectSkills(dir, source) {
  const skills = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return skills
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    const skillFile = join(dir, e.name, 'SKILL.md')
    let description = ''
    try {
      const raw = (await readFile(skillFile, 'utf8')).slice(0, 4096)
      description = parseSkillMeta(raw).description ?? ''
    } catch {
      continue // kein SKILL.md → kein Skill
    }
    skills.push({
      id: `${source}:${e.name}`,
      name: e.name,
      description: description.slice(0, 240),
      source,
      path: skillFile,
    })
  }
  return skills
}

let osMapCache = null
const OS_MAP_CACHE_MS = 60_000

async function osMap({ fresh = false } = {}) {
  // In-flight-Promise teilen: parallele Aufrufe bauen die Map nicht doppelt,
  // und ein Fehler invalidiert den Cache statt ihn zu vergiften.
  if (fresh) osMapCache = null
  if (osMapCache && Date.now() - osMapCache.at < OS_MAP_CACHE_MS) return osMapCache.promise
  const entry = { at: Date.now(), promise: null }
  entry.promise = buildOsMap().catch((e) => {
    if (osMapCache === entry) osMapCache = null
    throw e
  })
  osMapCache = entry
  return entry.promise
}

async function buildOsMap() {
  const [vaultSkills, globalSkills, graph] = await Promise.all([
    collectSkills(VAULT_SKILLS_DIR, 'vault'),
    collectSkills(GLOBAL_SKILLS_DIR, 'global'),
    vaultGraph(),
  ])

  // Apps + zusätzliche Routinen: Quelle der Wahrheit ist System/os-apps.json im Vault.
  let appsConfig = { apps: [], routines: [] }
  try {
    appsConfig = JSON.parse(await readFile(OS_APPS_FILE, 'utf8'))
  } catch {
    /* Datei fehlt → nur eingebaute Routinen */
  }

  const routines = [
    {
      id: 'routine:cockpit-runner',
      name: 'Cockpit-Runner',
      description: 'launchd de.uriel.runner · KeepAlive · Port 4711',
      schedule: 'immer an',
    },
    {
      id: 'routine:dream-check',
      name: 'Dream-Check',
      description: 'Analysiert Skill-/Run-Nutzung, 1-2 Verbesserungsvorschläge',
      schedule: 'täglich (erster Runner-Start)',
    },
    {
      id: 'routine:morgenbrief',
      name: 'Morgen-Brief',
      description: 'Fällige Follow-ups, Akquise-Stand, ein Fokus-Satz — liegt fertig da',
      schedule: `werktags ab ${String(MORGENBRIEF_AB_STUNDE).padStart(2, '0')}:00`,
    },
    ...(Array.isArray(appsConfig.routines) ? appsConfig.routines : []).map((r, i) => ({
      id: `routine:${r.id ?? i}`,
      name: r.name ?? String(r.id ?? i),
      description: r.description ?? '',
      schedule: r.schedule ?? '',
    })),
  ]

  const apps = (Array.isArray(appsConfig.apps) ? appsConfig.apps : []).map((a, i) => ({
    id: `app:${a.id ?? i}`,
    name: a.name ?? String(a.id ?? i),
    description: a.description ?? '',
    kind: a.kind ?? 'tool', // mcp | api | cli | tool
    status: a.status ?? 'connected', // connected | manual | geplant
  }))

  // Memory: Notizen mit PARA-Bereich (erstes Pfadsegment) für Cluster-Zuordnung.
  const memory = graph.nodes.map((n) => ({
    ...n,
    area: n.path.includes('/') ? n.path.slice(0, n.path.indexOf('/')) : 'Vault',
  }))

  return {
    skills: [...vaultSkills, ...globalSkills],
    routines,
    apps,
    memory,
    memoryEdges: graph.edges,
    generatedAt: new Date().toISOString(),
  }
}

// ---------- OS-Map-Snapshot → Supabase ----------
let lastSnapshotSig = ''

/**
 * Spiegelt die aktuelle Map nach Supabase (Upsert der Singleton-Zeile 'global').
 * Nur bei echter Änderung → keine unnötigen Writes. Service-Role-Key umgeht RLS,
 * bleibt aber lokal. Fehler werden geloggt, nicht geworfen (Runner läuft weiter).
 */
async function pushSnapshot() {
  if (!SNAPSHOT_ENABLED) return
  let map
  try {
    map = await osMap()
  } catch (e) {
    console.error('[runner] Snapshot: Map bauen fehlgeschlagen:', e?.message ?? e)
    return
  }
  const sig = JSON.stringify({
    s: map.skills?.length,
    r: map.routines?.length,
    a: map.apps?.length,
    m: map.memory?.length,
    e: map.memoryEdges?.length,
    // Inhalt, nicht nur Zähler: erkennt Umbenennungen/Umzüge.
    h: [...(map.skills ?? []), ...(map.memory ?? [])].map((n) => n.id ?? n.path).join('|'),
  })
  if (sig === lastSnapshotSig) return

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/os_map_snapshot`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: 'global',
        data: map,
        generated_at: map.generatedAt ?? null,
        updated_at: new Date().toISOString(),
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`[runner] Snapshot-Push HTTP ${res.status}: ${txt.slice(0, 200)}`)
      return
    }
    lastSnapshotSig = sig
    console.log(
      `[runner] Snapshot gepusht (${map.skills?.length ?? 0} Skills · ${map.memory?.length ?? 0} Memory · ${map.apps?.length ?? 0} Apps)`,
    )
  } catch (e) {
    console.error('[runner] Snapshot-Push fehlgeschlagen:', e?.message ?? e)
  }
}

/**
 * Heartbeat: schreibt alle paar Sekunden last_seen + laufende/wartende Jobs in
 * `runner_heartbeat`. Damit sieht die HTTPS-Live-Domain (die den lokalen Port
 * 4711 nicht erreichen darf, Mixed Content) den Runner als online. Läuft
 * UNBEDINGT bei jedem Tick (kein Signatur-Vergleich wie beim Snapshot), sonst
 * altert last_seen. Siehe Migration 0057.
 */
// ---------- Runner-Brücke (Migration 0059) ----------
// Der Browser darf von der HTTPS-Domain aus nicht auf 127.0.0.1 zugreifen. Statt
// den Runner von außen erreichbar zu machen (Tunnel, offener Port), dreht die
// Brücke die Richtung um: das Cockpit legt einen Auftrag in Supabase ab, der
// Runner holt ihn sich hier ab. Nach außen offen ist damit weiterhin nichts.

const JOB_POLL_MS = Number(process.env.JOB_POLL_MS ?? 4_000)
const SNAPSHOT_MIRROR_MS = Number(process.env.SNAPSHOT_MIRROR_MS ?? 60_000)
let jobLaeuft = false

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

/** Zuletzt erfolgreich gespiegelter Inhalt je Schlüssel (Signatur-Vergleich). */
const letzteSpiegelSig = new Map()

/** Spiegelt Daten, die sonst nur über den lokalen Port lesbar wären. */
async function pushSnapshotKey(key, ladeDaten) {
  try {
    const data = await ladeDaten()
    // Unverändert → nicht erneut schreiben. Der Runs-Spiegel läuft jetzt auch bei
    // jedem Start/Ende eines Runs, nicht nur im Tick (Muster von pushSnapshot).
    const sig = JSON.stringify(data)
    if (letzteSpiegelSig.get(key) === sig) return
    const res = await fetch(`${SUPABASE_URL}/rest/v1/runner_snapshots`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ key, data, updated_at: new Date().toISOString() }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`[runner] Spiegel "${key}" HTTP ${res.status}: ${txt.slice(0, 160)}`)
      return
    }
    letzteSpiegelSig.set(key, sig)
  } catch (e) {
    console.error(`[runner] Spiegel "${key}" fehlgeschlagen:`, e?.message ?? e)
  }
}

/**
 * Runs-Spiegel (Liste + Inhalt). Ohne ihn sind auf der HTTPS-Domain „Letzte
 * Runs", die Freigaben-Queue, die Run-Toasts und der Loom-Fertig-Zustand tot —
 * `/runs` hängt sonst an 127.0.0.1.
 */
async function pushRunsSnapshot() {
  if (!SNAPSHOT_ENABLED) return
  await pushSnapshotKey('runs', async () => ({ runs: await runsListe(RUNS_SPIEGEL_LIMIT, true) }))
}

/**
 * Holt eine iCal-Quelle server-seitig (der Browser blockt das als
 * Mixed-Content/CORS). Nur https, 10s-Timeout, ~4MB-Cap. Das Parsen macht die
 * App — gleiche Quelle für den `/calendar`-Proxy und den Spiegel.
 */
async function holeIcal(icalUrl) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const r = await fetch(icalUrl, { signal: ctrl.signal, redirect: 'follow' })
    if (!r.ok) throw new Error(`Kalender-Quelle antwortete ${r.status}`)
    return (await r.text()).slice(0, 4_000_000)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Holt mehrere Kalender und hängt sie aneinander (der Parser liest VEVENTs,
 * egal wie viele VCALENDAR-Blöcke im Text stehen).
 *
 * Ein kaputter Kalender darf die anderen nicht mitreißen: er wird geloggt und
 * übersprungen. Nur wenn ALLE scheitern, wirft die Funktion — dann bleibt der
 * alte Spiegel-Stand stehen, statt durch einen leeren ersetzt zu werden.
 */
async function holeIcals(urls) {
  const texte = []
  const fehler = []
  for (const url of urls) {
    try {
      texte.push(await holeIcal(url))
    } catch (e) {
      fehler.push(e?.message ?? String(e))
      console.error('[runner] Kalender übersprungen:', e?.message ?? e)
    }
  }
  if (!texte.length) throw new Error(`kein Kalender erreichbar: ${fehler.join(' · ')}`)
  return texte.join('\n')
}

// ---------- Datei-Spiegel (Supabase Storage) ----------
// Loom-Skripte, Follow-up-PDFs, Wochen-Galerien und Ad-Creatives liegen auf der
// Platte und hingen bisher an `/files/...` auf 127.0.0.1 — am Handy tote Links.
// Der Runner lädt genau die Dateien, die die Oberfläche verlinkt, in den privaten
// Bucket `runner-files` und veröffentlicht ein Verzeichnis als Snapshot; das
// Cockpit macht daraus signierte URLs (Muster: project-files, Migration 0051).
const FILES_BUCKET = 'runner-files'
/** Ausreißer (Video-Exporte o.ä.) nicht spiegeln — sie gehören nicht aufs Handy. */
const FILE_MAX_BYTES = 25_000_000

/** Wurzelverzeichnis je Sorte. Die rel-Pfade sind dieselben wie in `/files/<sorte>/`. */
const DATEI_WURZEL = {
  sales: () => SALES_ROOT,
  social: () => SOCIAL_ROOT,
  kunden: () => KUNDEN_ROOT,
}

/**
 * Storage-Key aus einem Pfad. Umlaute/Leerzeichen/Klammern raus — Loom-Skripte
 * heißen „Loom-Skript 2026-07-30 (Müller Immobilien).html". Welcher Key zu
 * welchem rel-Pfad gehört, steht im Verzeichnis-Snapshot; die App rät nie.
 */
function storageKey(kind, rel) {
  const safe = rel
    .split('/')
    .map((seg) =>
      seg
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
    .join('/')
  return `${kind}/${safe}`
}

/** Was die Oberfläche verlinkt: Sales-Bibliothek, Wochen-HTMLs, Ad-Dateien. */
async function zuSpiegelndeDateien() {
  const liste = []
  try {
    const lib = await salesLibrary()
    for (const f of lib.skripte) liste.push({ kind: 'sales', rel: f.rel })
  } catch (e) {
    console.error('[runner] Datei-Spiegel: Sales-Liste fehlgeschlagen:', e?.message ?? e)
  }
  try {
    for (const w of await socialWeeks()) liste.push({ kind: 'social', rel: w.htmlPath })
  } catch (e) {
    console.error('[runner] Datei-Spiegel: Wochen-Liste fehlgeschlagen:', e?.message ?? e)
  }
  for (const k of await kundenRegistry()) {
    if (typeof k.folder !== 'string') continue
    const basis = `${k.folder}/${k.adsDir ?? '05_leadgen'}`
    let manifest
    try {
      manifest = JSON.parse(await readFile(join(KUNDEN_ROOT, basis, 'ads.json'), 'utf8'))
    } catch {
      continue // kein Manifest → nichts zu spiegeln
    }
    const refs = new Set()
    for (const o of manifest.overviewFiles ?? []) if (o?.path) refs.add(o.path)
    for (const a of manifest.ads ?? []) {
      for (const v of a.versions ?? []) {
        for (const f of v.files ?? []) if (f?.path) refs.add(f.path)
        if (v.preview) refs.add(v.preview)
      }
    }
    for (const r of refs) liste.push({ kind: 'kunden', rel: `${basis}/${r}` })
  }
  return liste
}

/** rel-Pfad → absoluter Pfad, aber nur innerhalb der erlaubten Wurzel (wie `/files/…`). */
async function dateiPfad(kind, rel) {
  const wurzel = DATEI_WURZEL[kind]?.()
  if (!wurzel) return null
  const real = await realpath(resolve(join(wurzel, rel))).catch(() => null)
  if (!real) return null
  const wurzelReal = await realpath(wurzel).catch(() => null)
  if (!wurzelReal) return null
  if (real !== wurzelReal && !real.startsWith(wurzelReal + sep)) return null
  return real
}

/** Was schon oben liegt: `<kind>:<rel>` → mtimeMs. Beim Start aus dem Verzeichnis geladen. */
const gespiegelteDateien = new Map()
let dateiIndexGeladen = false

async function ladeDateiIndex() {
  if (dateiIndexGeladen) return
  dateiIndexGeladen = true
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/runner_snapshots?key=eq.files_index&select=data`,
      { headers: supabaseHeaders() },
    )
    if (!res.ok) return
    const [row] = await res.json()
    for (const [id, eintrag] of Object.entries(row?.data?.files ?? {})) {
      if (eintrag?.mtime) gespiegelteDateien.set(id, eintrag.mtime)
    }
  } catch {
    /* kein Verzeichnis lesbar → einmal alles neu hochladen, kein Drama */
  }
}

async function ladeDateiHoch(key, buf, mime) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${FILES_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'true',
      },
      body: buf,
    },
  )
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 160)}`)
  }
}

/**
 * Lädt geänderte Dateien hoch (mtime-Vergleich) und veröffentlicht das
 * Verzeichnis als Snapshot `files_index`: `<kind>:<rel>` → { key, mtime, size }.
 */
async function spiegleDateien() {
  await ladeDateiIndex()
  const index = {}
  let neu = 0
  for (const { kind, rel } of await zuSpiegelndeDateien()) {
    const id = `${kind}:${rel}`
    const mime = KUNDEN_MIME[rel.slice(rel.lastIndexOf('.')).toLowerCase()]
    if (!mime) continue // Dateityp, den auch `/files/…` nicht ausliefert
    const pfad = await dateiPfad(kind, rel)
    if (!pfad) continue
    let st
    try {
      st = await stat(pfad)
    } catch {
      continue // im Manifest verlinkt, aber nicht (mehr) da
    }
    if (st.size > FILE_MAX_BYTES) {
      console.warn(`[runner] Datei-Spiegel: ${rel} übersprungen (${Math.round(st.size / 1e6)} MB)`)
      continue
    }
    const key = storageKey(kind, rel)
    if (gespiegelteDateien.get(id) !== st.mtimeMs) {
      try {
        await ladeDateiHoch(key, await readFile(pfad), mime)
        gespiegelteDateien.set(id, st.mtimeMs)
        neu++
      } catch (e) {
        console.error(`[runner] Datei-Spiegel "${rel}" fehlgeschlagen:`, e?.message ?? e)
        continue // ohne Upload nicht ins Verzeichnis — sonst zeigt die App ins Leere
      }
    }
    index[id] = { key, mtime: st.mtimeMs, size: st.size }
  }
  if (neu) console.log(`[runner] Datei-Spiegel: ${neu} Datei(en) hochgeladen`)
  await pushSnapshotKey('files_index', async () => ({ files: index }))
}

async function mirrorAll() {
  if (!SNAPSHOT_ENABLED) return
  await pushSnapshotKey('ads_overview', async () => {
    const kunden = await kundenRegistry()
    const entries = []
    for (const k of kunden) {
      const file = join(KUNDEN_ROOT, k.folder, k.adsDir ?? '05_leadgen', 'ads.json')
      let manifest = emptyManifest(k.slug)
      try {
        manifest = JSON.parse(await readFile(file, 'utf8'))
      } catch (e) {
        if (e?.code !== 'ENOENT') throw e
      }
      entries.push({ kunde: k, manifest })
    }
    return { entries }
  })
  await pushSnapshotKey('social_weeks', async () => ({ weeks: await socialWeeks() }))
  await pushSnapshotKey('sales_library', async () => await salesLibrary())
  await spiegleErstnachrichten()
  await pushSnapshotKey('agents', async () => {
    const runningIds = new Set([...running.values()].map((r) => r.agent))
    return {
      agents: AGENT_CATALOG.map((a) => ({
        id: a.id,
        label: a.label,
        description: a.description,
        kind: a.kind,
        running: runningIds.has(a.id),
      })),
    }
  })
  await pushRunsSnapshot()
  await spiegleDateien()
  // Kalender: ohne Adresse in runner/.env bleibt der Spiegel bewusst leer —
  // das Cockpit sagt das dann auch so, statt einen leeren Monat zu zeigen.
  if (CALENDAR_ICAL_URLS.length) {
    // Kein Zeitstempel im Datensatz: der Signatur-Schutz soll greifen, solange
    // sich am Kalender nichts ändert. Wie frisch er ist, steht in updated_at.
    await pushSnapshotKey('calendar', async () => ({ ical: await holeIcals(CALENDAR_ICAL_URLS) }))
  }
}

/**
 * Spiegelt die versandfertigen Erstnachrichten aus dem Vault in die Tabelle.
 * Schreibt bewusst NUR Inhaltsspalten — `status` und `sent_at` gehören Kevin
 * und dürfen von einem Spiegel-Lauf nie zurückgesetzt werden.
 */
async function spiegleErstnachrichten() {
  const brandSlug = process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann'
  try {
    const { datei, leads, ohneText } = await ladeErstnachrichten(VAULT)
    if (!datei || !leads.length) return

    const br = await fetch(
      `${SUPABASE_URL}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&select=id&limit=1`,
      { headers: supabaseHeaders() },
    )
    const [brand] = br.ok ? await br.json() : []
    if (!brand?.id) return

    const now = new Date().toISOString()
    const rows = leads.map((l) => ({
      brand_id: brand.id,
      gruppe: l.gruppe,
      name: l.name,
      firma: l.firma,
      website: l.website,
      nachricht: l.nachricht,
      sort_index: l.sortIndex,
      quelle_datei: datei,
      last_synced_at: now,
    }))

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/linkedin_erstnachrichten?on_conflict=brand_id,gruppe,name`,
      {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(rows),
      },
    )
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`[runner] Erstnachrichten-Spiegel HTTP ${res.status}: ${txt.slice(0, 200)}`)
      return
    }
    await pushSnapshotKey('erstnachrichten_meta', async () => ({
      datei,
      versandfertig: leads.length,
      ohneText: ohneText.anzahl,
      ohneTextGruppe: ohneText.gruppe,
    }))
  } catch (e) {
    console.error('[runner] Erstnachrichten-Spiegel fehlgeschlagen:', e?.message ?? e)
  }
}

/** Führt genau einen Auftrag aus. Rückgabe landet als `result` am Auftrag. */
async function fuehreJobAus(job) {
  if (job.kind === 'linkedin_sync') {
    // O6 (06.08.2026): derselbe Guard wie am HTTP-Pfad (POST /linkedin/sync,
    // `:1531`). Ohne ihn konnten ein Auftrag aus `runner_jobs` und ein Klick im
    // Cockpit gleichzeitig durch die Voyager-API laufen — zwei parallele Läufe
    // auf Kevins LinkedIn-Konto sind der teuerste denkbare Fehler dieses
    // Systems. `finally` ist Pflicht: bliebe das Flag nach einem Abbruch stehen,
    // wäre der Sync bis zum Neustart des Runners tot.
    if (linkedinSyncRunning) throw new Error('LinkedIn-Sync läuft bereits')
    linkedinSyncRunning = true
    try {
      const synced = await syncThreads({})
      const result = await upsertThreads(synced.threads, {})
      return {
        ...result,
        partial: synced.partial,
        skippedAds: synced.skippedAds,
        skippedGroups: synced.skippedGroups,
        skippedNonInbox: synced.skippedNonInbox,
        elapsedMs: synced.elapsedMs,
      }
    } finally {
      linkedinSyncRunning = false
    }
  }
  if (job.kind === 'agent_run') {
    const agent = String(job.payload?.agent ?? '')
    if (!AGENT_BY_ID.has(agent)) throw new Error(`Unbekannter Agent: ${agent}`)
    if ([...running.values()].some((r) => r.agent === agent)) throw new Error(`${agent} läuft bereits`)
    return await startRun(agent, job.payload?.input ?? {})
  }
  throw new Error(`Unbekannte Auftragsart: ${job.kind}`)
}

async function pollJobs() {
  if (!SNAPSHOT_ENABLED || jobLaeuft) return
  jobLaeuft = true
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/runner_jobs?status=eq.pending&order=created_at.asc&limit=1`,
      { headers: supabaseHeaders() },
    )
    if (!res.ok) return
    const [job] = await res.json()
    if (!job) return

    // Beanspruchen: der Filter status=eq.pending sorgt dafür, dass ein zweiter
    // Runner denselben Auftrag nicht ein zweites Mal greift.
    const claim = await fetch(
      `${SUPABASE_URL}/rest/v1/runner_jobs?id=eq.${job.id}&status=eq.pending`,
      {
        method: 'PATCH',
        headers: supabaseHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ status: 'running', started_at: new Date().toISOString() }),
      },
    )
    const beansprucht = claim.ok ? await claim.json() : []
    if (!beansprucht.length) return

    console.log(`[runner] Auftrag ${job.kind} (${job.id.slice(0, 8)}) gestartet`)
    let patch
    try {
      patch = { status: 'done', result: await fuehreJobAus(job), error: null }
      console.log(`[runner] Auftrag ${job.kind} fertig`)
    } catch (e) {
      patch = { status: 'error', error: String(e?.message ?? e).slice(0, 800) }
      console.error(`[runner] Auftrag ${job.kind} fehlgeschlagen:`, e?.message ?? e)
    }
    await fetch(`${SUPABASE_URL}/rest/v1/runner_jobs?id=eq.${job.id}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ ...patch, finished_at: new Date().toISOString() }),
    })
  } catch (e) {
    console.error('[runner] Auftrags-Abfrage fehlgeschlagen:', e?.message ?? e)
  } finally {
    jobLaeuft = false
  }
}

async function pushHeartbeat() {
  if (!SNAPSHOT_ENABLED) return
  const now = new Date().toISOString()
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/runner_heartbeat`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: 'global',
        last_seen: now,
        running: [...running.values()].map(({ id, agent, startedAt }) => ({ id, agent, startedAt })),
        queued: [],
        updated_at: now,
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`[runner] Heartbeat HTTP ${res.status}: ${txt.slice(0, 160)}`)
    }
  } catch (e) {
    console.error('[runner] Heartbeat fehlgeschlagen:', e?.message ?? e)
  }
}

/** Erlaubte Roots einmalig realpath-auflösen (Symlink-sicher). */
let osFileRootsPromise = null
function osFileRoots() {
  osFileRootsPromise ??= Promise.all(
    [VAULT, GLOBAL_SKILLS_DIR].map(async (root) => {
      try {
        return await realpath(root)
      } catch {
        return null // Root existiert nicht → fällt aus der Allowlist
      }
    }),
  ).then((roots) => roots.filter(Boolean))
  return osFileRootsPromise
}

/** Read-only Dateizugriff fürs Detail-Panel. Nur Vault + globale Skills (realpath-geprüft). */
async function osFile(relOrAbs) {
  const candidate = resolve(relOrAbs.startsWith('/') ? relOrAbs : join(VAULT, relOrAbs))
  if (!/\.(md|json|mjs|txt|canvas|base)$/.test(candidate)) {
    throw Object.assign(new Error('nur Textdateien'), { code: 'EDENIED' })
  }
  // realpath schlägt Symlink-Escapes und ../-Tricks tot; ENOENT → 404 upstream.
  const real = await realpath(candidate)
  const roots = await osFileRoots()
  const allowed = roots.some((root) => real === root || real.startsWith(root + sep))
  if (!allowed) throw Object.assign(new Error('Pfad außerhalb des erlaubten Bereichs'), { code: 'EDENIED' })
  const raw = await readFile(real, 'utf8')
  return { path: real, content: raw.slice(0, 40_000), truncated: raw.length > 40_000 }
}

// ---------- Kunden-Ads (Cockpit /ads) ----------
/** MIME-Allowlist für die statische Auslieferung aus dem Kunden-Root. */
const KUNDEN_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
}

/** Kunden-Root einmalig realpath-auflösen (Symlink-sicher, analog osFileRoots). */
let kundenRootRealPromise = null
function kundenRootReal() {
  kundenRootRealPromise ??= realpath(KUNDEN_ROOT).catch(() => null)
  return kundenRootRealPromise
}

/** Social-Root einmalig realpath-auflösen (Symlink-sicher, analog kundenRootReal). */
let socialRootRealPromise = null
function socialRootReal() {
  socialRootRealPromise ??= realpath(SOCIAL_ROOT).catch(() => null)
  return socialRootRealPromise
}

/** Sales-Root einmalig realpath-auflösen (Symlink-sicher, analog socialRootReal). */
let salesRootRealPromise = null
function salesRootReal() {
  salesRootRealPromise ??= realpath(SALES_ROOT).catch(() => null)
  return salesRootRealPromise
}

/**
 * Sales-Bibliothek (Cockpit /sales/bibliothek): zwei Gruppen — Vault-Markdown
 * (Erstnachrichten/Loom-Sprechfassung/Outbound-Skripte) + Vorlagen/PDFs/HTML
 * im Sales-Skripte-Ordner. Nur Top-Level-Dateien, mtime absteigend sortiert.
 */
async function salesLibrary() {
  async function listDir(dir, exts) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const out = []
    for (const e of entries) {
      if (!e.isFile()) continue
      const dot = e.name.lastIndexOf('.')
      const ext = dot >= 0 ? e.name.slice(dot).toLowerCase() : ''
      if (!exts.has(ext)) continue
      const full = join(dir, e.name)
      const st = await stat(full)
      out.push({ name: e.name, ext, mtime: st.mtime.toISOString() })
    }
    out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1))
    return out
  }

  const vaultFiles = await listDir(SALES_VAULT_DIR, new Set(['.md']))
  const skripteFiles = await listDir(SALES_ROOT, new Set(['.md', '.html', '.pdf']))

  return {
    vault: vaultFiles.map((f) => ({
      name: f.name.replace(/\.md$/, ''),
      path: join('03 Bereiche', 'Vertrieb & Outreach', f.name),
      kind: 'md',
      mtime: f.mtime,
    })),
    skripte: skripteFiles.map((f) => ({
      name: f.name.replace(/\.(html|pdf|md)$/, ''),
      rel: f.name,
      kind: f.ext.slice(1),
      mtime: f.mtime,
    })),
  }
}

/**
 * Wochen-Batches: content-engine/weekly/<YYYY-Www>/woche-*.html — neueste zuerst.
 * Titel aus dem <title> der HTML (nur Kopf lesen), Post-Anzahl aus posts/.
 */
async function socialWeeks() {
  let dirs
  try {
    dirs = await readdir(SOCIAL_WEEKLY, { withFileTypes: true })
  } catch {
    return [] // Ordner (noch) nicht da → leer, kein Fehler
  }
  const weeks = []
  for (const d of dirs) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue
    const dir = join(SOCIAL_WEEKLY, d.name)
    let files
    try {
      files = await readdir(dir)
    } catch {
      continue
    }
    const html =
      files.find((f) => /^woche-.*\.html$/i.test(f)) ?? files.find((f) => f.endsWith('.html'))
    if (!html) continue

    let mtime = 0
    let title = `Woche ${d.name}`
    try {
      mtime = (await stat(join(dir, html))).mtimeMs
    } catch {
      /* egal */
    }
    try {
      const head = (await readFile(join(dir, html), 'utf8')).slice(0, 2000)
      const m = head.match(/<title>([^<]+)<\/title>/i)
      if (m) {
        title = m[1]
          .trim()
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#0?39;/g, "'")
          .replace(/&quot;/g, '"')
      }
    } catch {
      /* egal */
    }
    let postsCount = 0
    try {
      postsCount = (await readdir(join(dir, 'posts'))).filter((f) => f.endsWith('.html')).length
    } catch {
      /* keine posts/ */
    }
    weeks.push({
      week: d.name,
      title,
      htmlPath: `content-engine/weekly/${d.name}/${html}`, // rel zu SOCIAL_ROOT
      mtime,
      postsCount,
    })
  }
  weeks.sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0))
  return weeks
}

async function kundenRegistry() {
  try {
    const parsed = JSON.parse(await readFile(KUNDEN_CONFIG, 'utf8'))
    return Array.isArray(parsed.kunden) ? parsed.kunden : []
  } catch {
    return []
  }
}

function emptyManifest(slug) {
  return { schemaVersion: 1, customer: slug, updatedAt: null, overviewFiles: [], ads: [] }
}

/** Manifest-Pfad NUR über das Register (= Schreib-Allowlist). Unbekannter Slug → null. */
async function manifestPath(slug) {
  if (!slug) return null
  const k = (await kundenRegistry()).find((x) => x.slug === slug)
  if (!k || typeof k.folder !== 'string') return null
  return join(KUNDEN_ROOT, k.folder, k.adsDir ?? '05_leadgen', 'ads.json')
}

async function readBodyCapped(req, maxBytes) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
    if (data.length > maxBytes) {
      throw Object.assign(new Error('Body zu groß'), { code: 'ETOOBIG' })
    }
  }
  return data
}

// ---------- Vault: zuletzt geänderte Notizen ----------
const EXCLUDE = new Set(['System', '.obsidian', '.claude', '.trash', '.git', '08 Anhänge', '10 Excalidraw'])

async function recentNotes(limit) {
  /** @type {Array<{path:string, name:string, mtime:number}>} */
  const found = []
  async function walk(dir, depth) {
    if (depth > 3) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || EXCLUDE.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full, depth + 1)
      } else if (e.name.endsWith('.md')) {
        const s = await stat(full)
        found.push({ path: full.slice(VAULT.length + 1), name: e.name.replace(/\.md$/, ''), mtime: s.mtimeMs })
      }
    }
  }
  await walk(VAULT, 0)
  found.sort((a, b) => b.mtime - a.mtime)
  return found.slice(0, limit)
}

// ---------- HTTP ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'OPTIONS') return json(res, 204, {})

  try {
    if (req.method === 'GET' && url.pathname === '/status') {
      return json(res, 200, {
        alive: true,
        vault: VAULT,
        running: [...running.values()].map(({ id, agent, startedAt }) => ({ id, agent, startedAt })),
        queued: [],
      })
    }

    // Agenten-Katalog fürs Cockpit (/agenten): Liste + Run-Buttons.
    if (req.method === 'GET' && url.pathname === '/agents') {
      const runningIds = new Set([...running.values()].map((r) => r.agent))
      return json(res, 200, {
        agents: AGENT_CATALOG.map((a) => ({
          id: a.id,
          label: a.label,
          description: a.description,
          kind: a.kind,
          running: runningIds.has(a.id),
        })),
      })
    }

    if (req.method === 'POST' && url.pathname === '/run') {
      const body = await readBody(req)
      const agent = String(body.agent ?? '')
      if (!AGENT_BY_ID.has(agent)) return json(res, 400, { error: `Unbekannter Agent: ${agent}` })
      if ([...running.values()].some((r) => r.agent === agent)) {
        return json(res, 409, { error: `${agent} läuft bereits` })
      }
      const run = await startRun(agent, body.input ?? {})
      return json(res, 202, run)
    }

    if (req.method === 'GET' && url.pathname === '/runs') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
      return json(res, 200, { runs: await runsListe(limit) })
    }

    if (req.method === 'GET' && url.pathname.startsWith('/runs/')) {
      const id = decodeURIComponent(url.pathname.slice('/runs/'.length))
      if (!/^[\w.\-]+$/.test(id)) return json(res, 400, { error: 'ungültige id' })
      const raw = await readFile(join(RUNS_DIR, `${id}.md`), 'utf8')
      return json(res, 200, { id, ...parseRun(`${id}.md`, raw), content: raw.replace(/^---\n[\s\S]*?\n---\n?/, '') })
    }

    if (req.method === 'GET' && url.pathname === '/vault/recent') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 15), 50)
      return json(res, 200, { notes: await recentNotes(limit) })
    }

    if (req.method === 'GET' && url.pathname === '/vault/graph') {
      return json(res, 200, await vaultGraph())
    }

    if (req.method === 'GET' && url.pathname === '/os/map') {
      return json(res, 200, await osMap({ fresh: url.searchParams.get('fresh') === '1' }))
    }

    // Kalender-Proxy: holt eine private iCal-URL (z. B. Google Calendar) server-
    // seitig (Browser blockt das als Mixed-Content/CORS) und gibt den Rohtext
    // zurück. Das Parsen macht die App (testbar). Nur https, 10s-Timeout, ~4MB-Cap.
    if (req.method === 'GET' && url.pathname === '/calendar') {
      const ical = url.searchParams.get('url') ?? ''
      if (!/^https:\/\//i.test(ical)) return json(res, 400, { error: 'nur https iCal-URL erlaubt' })
      try {
        return json(res, 200, { ical: await holeIcal(ical) })
      } catch (e) {
        return json(res, 502, { error: `Kalender nicht erreichbar: ${e instanceof Error ? e.message : e}` })
      }
    }

    // ---------- LinkedIn-Follow-ups (Wargame Zug 9, docs/wargames/linkedin-followups.md) ----------
    // Rein lesend gegen die Voyager-API des Sync-Chrome-Profils (~/.uriel-chrome).
    // Kein Klick, kein Senden. Ein Lauf zur Zeit.
    if (req.method === 'POST' && url.pathname === '/linkedin/sync') {
      if (linkedinSyncRunning) return json(res, 409, { error: 'LinkedIn-Sync läuft bereits' })
      linkedinSyncRunning = true
      try {
        const synced = await syncThreads({})
        const result = await upsertThreads(synced.threads, {})
        return json(res, 200, {
          ...result,
          partial: synced.partial,
          skippedGroups: synced.skippedGroups,
          skippedNonInbox: synced.skippedNonInbox,
          skippedAds: synced.skippedAds,
          elapsedMs: synced.elapsedMs,
        })
      } catch (e) {
        console.error('[runner] LinkedIn-Sync fehlgeschlagen:', e?.message ?? e)
        return json(res, 502, { error: e?.message ?? 'LinkedIn-Sync fehlgeschlagen' })
      } finally {
        linkedinSyncRunning = false
      }
    }

    if (req.method === 'GET' && url.pathname === '/os/file') {
      const p = url.searchParams.get('path')
      if (!p) return json(res, 400, { error: 'path fehlt' })
      try {
        return json(res, 200, await osFile(p))
      } catch (e) {
        if (e?.code === 'EDENIED') return json(res, 403, { error: e.message })
        throw e
      }
    }

    // ---------- Kunden-Ads: statische Dateien (HTML/PNG-Previews für /ads) ----------
    if (req.method === 'GET' && url.pathname.startsWith('/files/kunden/')) {
      const rel = decodeURIComponent(url.pathname.slice('/files/kunden/'.length))
      const dot = rel.lastIndexOf('.')
      const mime = dot >= 0 ? KUNDEN_MIME[rel.slice(dot).toLowerCase()] : undefined
      if (!mime) return json(res, 403, { error: 'Dateityp nicht erlaubt' })
      const root = await kundenRootReal()
      if (!root) return json(res, 404, { error: 'Kunden-Root existiert nicht' })
      // realpath schlägt ../-Tricks und Symlink-Escapes tot; ENOENT → 404 unten.
      const real = await realpath(resolve(join(KUNDEN_ROOT, rel)))
      if (real !== root && !real.startsWith(root + sep)) {
        return json(res, 403, { error: 'Pfad außerhalb Kunden-Root' })
      }
      const buf = await readFile(real)
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      return res.end(buf)
    }

    // ---------- Social-Content: statische Wochen-HTML (self-contained) ----------
    if (req.method === 'GET' && url.pathname.startsWith('/files/social/')) {
      const rel = decodeURIComponent(url.pathname.slice('/files/social/'.length))
      const dot = rel.lastIndexOf('.')
      const mime = dot >= 0 ? KUNDEN_MIME[rel.slice(dot).toLowerCase()] : undefined
      if (!mime) return json(res, 403, { error: 'Dateityp nicht erlaubt' })
      const root = await socialRootReal()
      if (!root) return json(res, 404, { error: 'Social-Root existiert nicht' })
      const real = await realpath(resolve(join(SOCIAL_ROOT, rel)))
      if (real !== root && !real.startsWith(root + sep)) {
        return json(res, 403, { error: 'Pfad außerhalb Social-Root' })
      }
      const buf = await readFile(real)
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      return res.end(buf)
    }

    if (req.method === 'GET' && url.pathname === '/social/weeks') {
      return json(res, 200, { weeks: await socialWeeks() })
    }

    // ---------- Sales-Bibliothek: statische Dateien (Vorlagen/PDFs/HTML für /sales) ----------
    if (req.method === 'GET' && url.pathname.startsWith('/files/sales/')) {
      const rel = decodeURIComponent(url.pathname.slice('/files/sales/'.length))
      const dot = rel.lastIndexOf('.')
      const mime = dot >= 0 ? KUNDEN_MIME[rel.slice(dot).toLowerCase()] : undefined
      if (!mime) return json(res, 403, { error: 'Dateityp nicht erlaubt' })
      const root = await salesRootReal()
      if (!root) return json(res, 404, { error: 'Sales-Root existiert nicht' })
      const real = await realpath(resolve(join(SALES_ROOT, rel)))
      if (real !== root && !real.startsWith(root + sep)) {
        return json(res, 403, { error: 'Pfad außerhalb Sales-Root' })
      }
      const buf = await readFile(real)
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      return res.end(buf)
    }

    // ---------- Sales-Bibliothek: Liste (Vault-Erstnachrichten + Vorlagen/PDFs) ----------
    if (req.method === 'GET' && url.pathname === '/sales/library') {
      return json(res, 200, await salesLibrary())
    }

    // ---------- Kunden-Ads: Register + Manifest ----------
    if (req.method === 'GET' && url.pathname === '/ads/customers') {
      return json(res, 200, { kunden: await kundenRegistry() })
    }

    // Alle Kunden + Manifeste in einem Rutsch (fürs Dashboard).
    if (req.method === 'GET' && url.pathname === '/ads/overview') {
      const kunden = await kundenRegistry()
      const entries = []
      for (const k of kunden) {
        const file = join(KUNDEN_ROOT, k.folder, k.adsDir ?? '05_leadgen', 'ads.json')
        let manifest = emptyManifest(k.slug)
        try {
          manifest = JSON.parse(await readFile(file, 'utf8'))
        } catch (e) {
          if (e?.code !== 'ENOENT') throw e
        }
        entries.push({ kunde: k, manifest })
      }
      return json(res, 200, { entries })
    }

    if (url.pathname === '/ads/manifest') {
      const slug = url.searchParams.get('kunde') ?? ''
      const file = await manifestPath(slug)
      if (!file) return json(res, 400, { error: `Unbekannter Kunde: ${slug}` })

      let onDisk = null
      try {
        onDisk = JSON.parse(await readFile(file, 'utf8'))
      } catch (e) {
        if (e?.code !== 'ENOENT') throw e // kaputtes JSON soll auffallen, nicht leer wirken
      }

      if (req.method === 'GET') {
        return json(res, 200, onDisk ?? emptyManifest(slug))
      }

      if (req.method === 'PUT') {
        let body
        try {
          body = JSON.parse(await readBodyCapped(req, MANIFEST_MAX_BYTES))
        } catch (e) {
          if (e?.code === 'ETOOBIG') return json(res, 413, { error: 'Manifest zu groß (max 2 MB)' })
          return json(res, 400, { error: 'ungültiges JSON' })
        }
        const manifest = body?.manifest
        if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.ads)) {
          return json(res, 400, { error: 'Manifest mit schemaVersion 1 und ads[] erwartet' })
        }
        // Konflikt-Guard: App-Stand muss auf dem Disk-Stand basieren, sonst hat
        // z.B. eine Claude-Session parallel geschrieben → App lädt `current` neu.
        const diskUpdatedAt = onDisk?.updatedAt ?? null
        if ((body.baseUpdatedAt ?? null) !== diskUpdatedAt) {
          return json(res, 409, {
            error: 'Konflikt: Manifest wurde extern geändert',
            current: onDisk ?? emptyManifest(slug),
          })
        }
        manifest.updatedAt = new Date().toISOString()
        await writeFile(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
        return json(res, 200, { ok: true, updatedAt: manifest.updatedAt })
      }
    }

    // ---------- Content-Posts (Cockpit /content, Post-Ebene) ----------
    // Spiegelt /ads/manifest 1:1: GET liefert das Manifest (leer, wenn die Datei
    // noch nicht existiert), PUT schreibt mit Optimistic-Concurrency (409-Guard),
    // sodass Kevin im UI + eine Claude-Session konfliktfrei dieselbe Datei pflegen.
    if (url.pathname === '/content/manifest') {
      const brand = url.searchParams.get('brand') ?? ''
      const file = contentManifestPath(brand)
      if (!file) return json(res, 400, { error: `Unbekannter Brand: ${brand}` })

      let onDisk = null
      try {
        onDisk = JSON.parse(await readFile(file, 'utf8'))
      } catch (e) {
        if (e?.code !== 'ENOENT') throw e // kaputtes JSON soll auffallen, nicht leer wirken
      }

      if (req.method === 'GET') {
        return json(res, 200, onDisk ?? emptyContentManifest(brand))
      }

      if (req.method === 'PUT') {
        let body
        try {
          body = JSON.parse(await readBodyCapped(req, MANIFEST_MAX_BYTES))
        } catch (e) {
          if (e?.code === 'ETOOBIG') return json(res, 413, { error: 'Manifest zu groß (max 2 MB)' })
          return json(res, 400, { error: 'ungültiges JSON' })
        }
        const manifest = body?.manifest
        if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.posts)) {
          return json(res, 400, { error: 'Manifest mit schemaVersion 1 und posts[] erwartet' })
        }
        const diskUpdatedAt = onDisk?.updatedAt ?? null
        if ((body.baseUpdatedAt ?? null) !== diskUpdatedAt) {
          return json(res, 409, {
            error: 'Konflikt: Manifest wurde extern geändert',
            current: onDisk ?? emptyContentManifest(brand),
          })
        }
        manifest.updatedAt = new Date().toISOString()
        await writeFile(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
        return json(res, 200, { ok: true, updatedAt: manifest.updatedAt })
      }
    }

    return json(res, 404, { error: 'not found' })
  } catch (e) {
    if (e && e.code === 'ENOENT') return json(res, 404, { error: 'nicht gefunden' })
    console.error('[runner]', e)
    return json(res, 500, { error: String(e?.message ?? e) })
  }
})

await mkdir(RUNS_DIR, { recursive: true })
await mkdir(QUEUE_DIR, { recursive: true })

/**
 * Morgenbrief als Routine statt Knopf (Ideen-Sammlung, Etappe 2): werktags ab
 * ~7:00 einmal pro Kalendertag von selbst. Muster von maybeDream — die Runs
 * im Vault sind das Gedächtnis, es braucht keinen eigenen Zustand. Läuft der
 * Mac erst um 9 an, kommt der Brief eben um 9; Kevin findet ihn fertig vor.
 */
const MORGENBRIEF_AB_STUNDE = Number(process.env.MORGENBRIEF_STUNDE ?? 7)
const MORGENBRIEF_CHECK_MS = 5 * 60 * 1000

async function maybeMorgenbrief() {
  try {
    const jetzt = new Date()
    const wochentag = jetzt.getDay() // 0 = Sonntag, 6 = Samstag
    if (wochentag === 0 || wochentag === 6) return
    if (jetzt.getHours() < MORGENBRIEF_AB_STUNDE) return
    // Läuft er gerade noch, darf der nächste Tick keinen zweiten starten —
    // die Run-Datei entsteht ja erst am Ende.
    if ([...running.values()].some((r) => r.agent === 'morgenbrief')) return
    const heute = nowStamp().slice(0, 10)
    const names = await readdir(RUNS_DIR)
    if (names.some((n) => n.startsWith(heute) && n.includes('morgenbrief'))) return
    console.log('[runner] morgenbrief startet (erster Werktags-Lauf heute)…')
    await startRun('morgenbrief', {})
  } catch (e) {
    console.error('[runner] morgenbrief übersprungen:', e?.message ?? e)
  }
}

/**
 * Antwort-Entwürfe als Nacht-Routine (Etappe 3, Schritt 2 — Leitprinzip
 * Klick-Ökonomie, Punkt 3: „Was ein Agent vorwegnehmen kann, ist kein Klick
 * mehr"). Werktags ab ~6:00 einmal pro Kalendertag, also vor dem Morgenbrief:
 * Kevin setzt sich hin, und an jedem wartenden Lead klebt schon ein Entwurf.
 *
 * Gleiches Muster wie maybeDream/maybeMorgenbrief — die Run-Dateien im Vault
 * sind das Gedächtnis, es braucht keinen eigenen Zustand.
 */
const ENTWUERFE_AB_STUNDE = Number(process.env.ANTWORT_ENTWUERFE_STUNDE ?? 6)

async function maybeAntwortEntwuerfe() {
  try {
    if (!SNAPSHOT_ENABLED) return // ohne service_role kein Zugriff auf linkedin_threads
    const jetzt = new Date()
    const wochentag = jetzt.getDay()
    if (wochentag === 0 || wochentag === 6) return
    if (jetzt.getHours() < ENTWUERFE_AB_STUNDE) return
    if ([...running.values()].some((r) => r.agent === 'linkedin-antwort-entwuerfe')) return
    const heute = nowStamp().slice(0, 10)
    const names = await readdir(RUNS_DIR)
    if (names.some((n) => n.startsWith(heute) && n.includes('linkedin-antwort-entwuerfe'))) return

    // Keine wartenden Leads → kein Lauf. Ein leerer Entwurfs-Run wäre nur eine
    // Zeile Rauschen in der Freigaben-Queue.
    const gebaut = await antwortEntwuerfeInput(jetzt)
    if (!gebaut) return

    console.log(
      `[runner] antwort-entwuerfe startet — ${gebaut.input.threads.length} wartende Leads` +
        (gebaut.weitereWarten ? ` (+${gebaut.weitereWarten} über dem Limit)` : ''),
    )
    await startRun('linkedin-antwort-entwuerfe', gebaut.input)
  } catch (e) {
    console.error('[runner] antwort-entwuerfe übersprungen:', e?.message ?? e)
  }
}

/** Dream-Check (REBUILD-PLAN §8): beim Start, max. 1x pro Kalendertag. */
async function maybeDream() {
  try {
    const today = nowStamp().slice(0, 10)
    const names = await readdir(RUNS_DIR)
    if (names.some((n) => n.startsWith(today) && n.includes('dream-check'))) return

    const recentRuns = names
      .filter((n) => n.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 15)
      .map((n) => n.replace(/\.md$/, ''))
    console.log('[runner] dream-check startet (erster Lauf heute)…')
    await startRun('dream-check', { recentRuns })
  } catch (e) {
    console.error('[runner] dream-check übersprungen:', e?.message ?? e)
  }
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[runner] alive auf http://127.0.0.1:${PORT} · Vault: ${VAULT}`)
  // leicht verzögert, damit der Start nicht blockiert
  setTimeout(() => void maybeDream(), 5000)

  // Morgenbrief: kurz nach dem Start prüfen (Mac gerade aufgeklappt) und dann
  // alle 5 Minuten — so kommt er auch, wenn der Rechner erst um 9 angeht.
  setTimeout(() => void maybeMorgenbrief(), 10_000)
  const mb = setInterval(() => void maybeMorgenbrief(), MORGENBRIEF_CHECK_MS)
  mb.unref?.()

  // Antwort-Entwürfe im selben Takt, aber eine Stunde früher als der Morgenbrief:
  // beim Aufklappen des Macs prüfen und dann alle 5 Minuten.
  setTimeout(() => void maybeAntwortEntwuerfe(), 20_000)
  const ae = setInterval(() => void maybeAntwortEntwuerfe(), MORGENBRIEF_CHECK_MS)
  ae.unref?.()

  // OS-Map-Snapshot für die Live-Domain: einmal beim Start + periodisch spiegeln.
  if (SNAPSHOT_ENABLED) {
    console.log(`[runner] Snapshot-Push aktiv → Supabase alle ${Math.round(SNAPSHOT_PUSH_MS / 1000)}s`)
    setTimeout(() => void pushSnapshot(), 3000)
    const t = setInterval(() => void pushSnapshot(), SNAPSHOT_PUSH_MS)
    t.unref?.()

    // Heartbeat für den Runner-Status-Punkt auf der Live-Domain (alle 15s).
    console.log(`[runner] Heartbeat aktiv → Supabase alle ${Math.round(HEARTBEAT_PUSH_MS / 1000)}s`)
    setTimeout(() => void pushHeartbeat(), 1500)
    const hb = setInterval(() => void pushHeartbeat(), HEARTBEAT_PUSH_MS)
    hb.unref?.()

    // Brücke (0059): Aufträge abholen + Ansichten spiegeln, damit das Cockpit
    // auch auf der HTTPS-Domain vollständig bedienbar ist.
    console.log(`[runner] Auftrags-Abfrage aktiv → alle ${Math.round(JOB_POLL_MS / 1000)}s`)
    const jp = setInterval(() => void pollJobs(), JOB_POLL_MS)
    jp.unref?.()
    setTimeout(() => void mirrorAll(), 4000)
    const mi = setInterval(() => void mirrorAll(), SNAPSHOT_MIRROR_MS)
    mi.unref?.()
  } else {
    console.log('[runner] Snapshot-Push + Heartbeat AUS (kein SUPABASE_SERVICE_ROLE_KEY in runner/.env) — Live-Graph bleibt leer, Runner erscheint auf der Live-Domain offline')
  }
})
