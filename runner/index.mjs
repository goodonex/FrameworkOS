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
import { mkdir, readdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncThreads, TIEFENSCAN_TAGE } from './linkedin/sync.mjs'
import { upsertThreads } from './linkedin/upsert.mjs'
import { ladeErstnachrichten } from './linkedin/erstnachrichten.mjs'
import { baueAntwortInput, holeAntwortThreads } from './linkedin/antwortThreads.mjs'
import { baueSortierInput, holeSortierThreads } from './linkedin/sortierThreads.mjs'
import { parseDraftsRoh, parseUrteileRoh, schreibeEntwuerfe, schreibeUrteile } from './linkedin/entwuerfe.mjs'
import { neuerLauf, nimmBrocken, protokollText } from './agentStream.mjs'
import { bewerteTagesLaeufe, darfRoutineStarten } from './routineGuard.mjs'
import { laufGrund } from './laufGrund.mjs'
import { leseListe, mitNetzwerkLock } from './linkedin/netzwerk.mjs'
import { baueMorgenbriefInput } from './morgenbriefInput.mjs'
import { upsertNetzwerk } from './linkedin/netzwerkUpsert.mjs'
import { installiereLogHygiene, kuerzeLogDatei } from './logHygiene.mjs'
import { WACH_KARENZ_MS, bewerteWachheit, chromeErreichbar, netzErreichbar, startBereitAus } from './startBereit.mjs'
import { bewerteSchleuse, pruefeAnmeldung, pruefeDurchgang, pruefeSupabase, pruefeVault } from './schleuse.mjs'

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

// ---------- Log-Hygiene (13.08.2026) ----------
// Muss vor der ersten Ausgabe stehen, sonst rutschen die Startzeilen ohne
// Zeitstempel durch. Warum es das braucht: siehe Kopf von logHygiene.mjs.
installiereLogHygiene({ fensterMs: Number(process.env.LOG_DAEMPFER_MS ?? 60_000) })

const LOG_DIR = process.env.RUNNER_LOG_DIR ?? join(homedir(), 'Library', 'Logs', 'kevin-os')
for (const name of ['cockpit-runner.log', 'cockpit-runner.err.log']) {
  try {
    const r = await kuerzeLogDatei(join(LOG_DIR, name), {
      maxBytes: Number(process.env.LOG_MAX_BYTES ?? 5_000_000),
    })
    if (r.gekuerzt) {
      console.log(
        `[runner] ${name} gekürzt: ${(r.vorher / 1_000_000).toFixed(1)} MB → Rest in ${name}.1`,
      )
    }
  } catch (e) {
    console.error(`[runner] ${name} konnte nicht gekürzt werden:`, e?.message ?? e)
  }
}

// ---------- Konfiguration ----------
const PORT = Number(process.env.RUNNER_PORT ?? 4711)
const VAULT = resolve(process.env.VAULT_PATH ?? join(homedir(), 'Second Brain'))
const RUNS_DIR = join(VAULT, 'System', 'Runs')
const QUEUE_DIR = join(VAULT, 'System', 'Queue')
/**
 * Zehn Minuten — bewusst unveraendert (O17, Entscheidung Kevin 07.08.2026).
 * Der Timeout war nie die Ursache der abgebrochenen Morgen-Laeufe: wach
 * braucht ein Morgenbrief 23 bis 33 Sekunden. Ursache war der schlafende Mac,
 * dagegen hilft `caffeinate` (siehe CAFFEINATE_BIN), nicht eine groessere Zahl.
 * Ueberschreibbar nur fuer Tests.
 */
const TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS ?? 10 * 60 * 1000)
/**
 * O17: Wie oft die Mitschrift eines laufenden Agenten auf Platte geht.
 * Gedrosselt, weil ein Lauf hunderte Ereignisse erzeugt und die Run-Dateien im
 * iCloud-synchronisierten Vault liegen — jede Zeile einzeln zu schreiben wäre
 * ein Sync-Sturm für nichts.
 */
const LIVE_SCHREIB_MS = Number(process.env.LIVE_SCHREIB_MS ?? 5_000)
/**
 * O17 Schritt 3: Zeit zwischen SIGTERM an die Prozessgruppe und SIGKILL.
 * `claude` raeumt beim Beenden auf (Sitzung schreiben, Kindprozesse einsammeln)
 * — wer sofort mit SIGKILL kommt, hinterlaesst Leichen. Wer nie nachlegt,
 * wartet ewig: genau das war der Zustand bis zum 07.08.
 */
const KILL_KARENZ_MS = Number(process.env.KILL_KARENZ_MS ?? 15_000)
/**
 * O17 Schritt 2, am `pmset -g log` belegt: Der Mac schlief **zwei Sekunden**
 * nach dem Start eines Morgen-Agenten wieder ein (DarkWake aus Deep Idle, dann
 * sofort `Entering Sleep`). Der Agent bekam so rund zwei Sekunden Rechenzeit je
 * Weck-Zyklus; die Timeout-Wanduhr lief im Schlaf weiter, SIGTERM und `close`
 * wurden erst beim naechsten DarkWake abgearbeitet — daher „Laufzeiten" von
 * 10,9 bis 17,8 Minuten, die in Wahrheit Abstaende zwischen zwei Aufwachern
 * waren. Wach braucht derselbe Lauf 23 bis 33 Sekunden.
 *
 * `-i` verhindert Idle-Schlaf, `-s` den System-Schlaf (greift am Netzteil).
 * Die Zusicherung endet automatisch mit dem Prozess — kein Aufraeumen noetig,
 * und ein abgestuerzter Runner haelt den Mac nicht ewig wach.
 */
const CAFFEINATE_BIN = '/usr/bin/caffeinate'

/**
 * Beendet den ganzen Prozessbaum eines Laufs (O17 Schritt 3).
 *
 * `proc.kill()` trifft nur das direkte Kind. `claude` startet aber Enkel, und
 * die halten die stdout-Pipe offen — node feuert `close` erst, wenn der letzte
 * Halter geht. Im Test am 07.08. kamen so 75 Sekunden zwischen Kill und
 * Abschluss zusammen; in Kevins Nacht-Laeufen Minuten. Das negative PID
 * adressiert die Prozessgruppe (moeglich durch `detached: true` beim Spawn).
 */
function beendeBaum(proc, id, karenzMs = KILL_KARENZ_MS) {
  const pid = proc?.pid
  if (!pid) return
  const sende = (sig) => {
    try {
      process.kill(-pid, sig) // ganze Gruppe
    } catch {
      try {
        proc.kill(sig) // Gruppe schon weg → wenigstens das direkte Kind
      } catch {
        /* bereits tot */
      }
    }
  }
  sende('SIGTERM')
  const nachlegen = setTimeout(() => {
    if (proc.exitCode === null && proc.signalCode === null) {
      console.warn(`[runner] ${id}: reagiert nicht auf SIGTERM — SIGKILL an die Prozessgruppe`)
      sende('SIGKILL')
    }
  }, karenzMs)
  nachlegen.unref?.()
}

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
      'content-engine/log.md ein. Kein Auto-Posting — nur das Review-Paket bauen.\n\n' +
      'ZULETZT, nicht vergessen: trage die gebauten Posts in content-engine/content.json ein — ' +
      'das ist die Quelle, aus der das Cockpit die Post-Ebene zeigt. Die Datei hat die Form ' +
      '{"schemaVersion":1,"brand":"herrmann","updatedAt":null,"posts":[]}; fehlt sie, lege sie so an. ' +
      'Hänge je gebautem Post ein Objekt an posts an: {"id":"<kw>-<kurz-slug>","title":"<Titel>",' +
      '"status":"scheduled","channel":"instagram","format":"carousel","week":"<ISO-Woche, z.B. 2026-W33>",' +
      '"slides":[{"path":"<Pfad der Slide-HTML relativ zum Social-Ordner>"}],"caption":"<Caption>","done":false}. ' +
      'BESTEHENDE Einträge bleiben unangetastet — weder Status noch Reihenfolge ändern, nichts löschen, ' +
      'keine id doppelt vergeben. Schreibe die Datei als gültiges JSON zurück.',
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
    // 24.08.2026: Der teuerste Agent im Funnel — eine Antwort an einen Lead, der
    // schon geschrieben hat. Der Lauf betrifft eine Handvoll Threads pro Nacht,
    // deshalb ist die teure Einstellung hier billig. `tools` ausdrücklich am
    // Aufruf: die Vault-settings.json allein griff headless nicht (siehe die
    // gleiche Lehre bei den write-Agenten), und ohne WebFetch/WebSearch kann der
    // Agent die Website des Leads nicht ansehen — genau das fehlte den Entwürfen.
    modell: 'claude-opus-5',
    effort: 'high',
    tools: 'Read,Glob,Grep,WebFetch,WebSearch',
  },
  {
    id: 'linkedin-sortierer',
    label: 'Lead-Sortierer (LinkedIn)',
    description:
      'Urteilt, wer in die Akquise-Liste gehört (lead/kontakt/akquise). Schreibt keine Nachrichten.',
    kind: 'readonly',
    // Kevins Vorgabe: „Da darf keiner wegfallen. Lieber einer zu viel als einer
    // zu wenig, aber auch nicht zu lasch." Ein aussortierter Lead wird Kevin nie
    // wieder vorgelegt — die Entscheidung ist dauerhaft und damit teuer. Deshalb
    // dieselbe Einstellung wie beim Antwort-Agenten. Ohne WebFetch/WebSearch,
    // mit Absicht: Geurteilt wird über Headline und Verlauf, nicht über eine
    // Website-Recherche je Person. Sechzig Threads mal Websuche wären ein
    // garantiertes Zeitlimit.
    modell: 'claude-opus-5',
    effort: 'high',
    tools: 'Read,Glob,Grep',
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
    // Der Agent läuft sandboxed im Sales-Ordner und kommt NICHT an den Vault
    // (19.08.2026 am ersten Lauf belegt: Read wird abgelehnt). Statt den Vault
    // per --add-dir zu öffnen — was dem Agenten dort auch Schreibrechte gäbe —
    // liest der Runner die Sprechfassung selbst und hängt sie an den Prompt.
    kontextDatei: join(SALES_VAULT_DIR, 'Loom-Skript (vollständige Sprechfassung).md'),
    kontextLabel: 'SPRECHFASSUNG',
    prompt:
      'Baue für den Lead aus den Eingabedaten (name, firma, website, letzteNachricht, kevinNotizen) ' +
      'ein individualisiertes Loom-Skript nach der SPRECHFASSUNG 3 (Stand 20.08.2026). Die ' +
      'vollständige Fassung steht unten im Block SPRECHFASSUNG — sie ist die Wahrheit, nicht dein ' +
      'Gedächtnis. Sie hat VIER Akte (der frühere Feindbild-Akt ist entfallen) und einen Schritt 0. ' +
      'HARTE LÄNGENGRENZE: der gesprochene Text aller vier Akte zusammen darf 520 WÖRTER NICHT ' +
      'überschreiten (Kevin spricht ruhig, das sind rund 4:20 Min). Zähle sie vor dem Abschluss ' +
      'wirklich nach und nenne die Zahl im Skript-Kopf. Richtwerte: Akt 1 ~200, Akt 2 ~170, ' +
      'Akt 3 ~120, Akt 4 ~50. Ist es zu lang, kürze in Akt 2. ' +
      'ABLAUF: ' +
      '(1) Website per WebFetch analysieren — auch zwei, drei Unterseiten, nicht nur die Startseite: ' +
      'Was kann ein Eigentümer tun, ohne zu sprechen? Gibt es eine Sofort-Zahl oder nur ein ' +
      'Formular? Führt die Navigation dahin, wo sie hinführen soll? Trennt die Seite Eigentümer, ' +
      'Käufer und Kapitalanleger? Wirkt sie eigen oder generisch? Sagen Google-Bewertungen etwas ' +
      'über ihn, das auf der Seite selbst NICHT vorkommt? ' +
      '(2) SCHRITT 0 oben ins Skript: Die KERN-IDEE ist bei jedem Lead DIESELBE und wird wörtlich ' +
      'übernommen — "Auf meiner Website entscheidet sich, ob ein Eigentümer bei mir anfragt, und da ' +
      'liegt gerade mehr drin, als rausgeholt wird." Individuell sind NUR: das Segment, der ' +
      'Glaubenssatz und die zwei Stationen, die die Idee belegen. ' +
      '(3) Akt 2 hat ZWEI Stationen (nicht drei), je als Frage, die er sich selbst beantwortet, ' +
      'danach [STILL]. Dieselbe Person über beide Stationen (halb elf abends, Sofa, hat es noch ' +
      'keinem erzählt). Das Positive davor: EIN bis ZWEI Sätze, locker — keine Kennzahlen-Aufzählung ' +
      'und kein Satz, der das Lob streckt. Danach der Vergleich mit der Demo-Seite: nur das ' +
      'Ergebnis, nie der Bauplan. ' +
      '(4) KEVINS NOTIZEN (Feld kevinNotizen) sind seine eigenen Beobachtungen von der Seite, roh ' +
      'diktiert. Sie sind oft schärfer als deine Analyse und haben VORRANG bei der Auswahl der ' +
      'Stationen. Aber: NICHT wörtlich übernehmen und NICHT alle. Nimm die zwei bis drei stärksten, ' +
      'die auf die Kern-Idee einzahlen, übersetze sie in ruhige, verkaufsfähige Sprache (aus "die ' +
      'Seite ist kalt und seelenlos" wird eine Beobachtung, keine Beschimpfung), und lass den Rest ' +
      'als Halbsatz mitlaufen oder weg. Was nicht ins Skript passt, listest du am Ende unter ' +
      '"Nicht verwendet — bewusst" mit einem Satz Begründung. ' +
      '(5) Akte 1, 3 und 4 aus der Sprechfassung übernehmen, nur Vorname/Firma/Domain einsetzen. ' +
      'In Akt 3 den Regie-Hinweis mitführen: geblurrtes Slide, Inhalt NICHT erklären. Das Slide ' +
      'EXISTIERT NICHT — schreibe "Slide existiert noch nicht; bis dahin Akt 3 ohne Einblendung" ' +
      'und erfinde weder Dateinamen noch Ordner dafür. Nenne NIE einen Pfad, den du nicht per ls ' +
      'geprüft hast. ' +
      '(6) Spickzettel und Begleit-DM individualisieren. Nutzt der Lead in letzteNachricht eine ' +
      'eigene Formulierung, im ersten Satz der DM daran anknüpfen. ' +
      'TONALITÄT (hart): additiv, nie defizitär — "so gewinnst du NOCH MEHR Mandate", niemals ' +
      '"endlich" oder "bisher gar nicht". Nie "so würde ich das machen". Kein Kleinmachen ' +
      '("ganz kurz", Rechtfertigungen). KEIN FÜLLSATZ: jeder Satz braucht Zweck — Vertrauen, Beleg, ' +
      'Frage oder Übergang; Sätze, die Selbstverständliches behaupten, streichen. Kein Kanal-Rundgang ' +
      '(Google-Profil, Bewertungen, Instagram, Ads werden nicht einzeln durchgegangen). Keine Emojis. ' +
      'AUSGABE: EINE selbst-enthaltene HTML-Datei "Loom-Skript <YYYY-MM-DD> (<Name>).html" im ' +
      'UNTERORDNER "Loom-Skripte/" dieses Ordners (anlegen, falls er fehlt). ' +
      'HARTE REGEL — KEIN JAVASCRIPT: kein <script>-Tag, keine Tabs, keine Klick-Interaktion. Jeder ' +
      'Text steht direkt als HTML im Dokument, alle Akte untereinander, von oben nach unten lesbar ' +
      'und druckbar (Kevin öffnet die Datei in einem Viewer, der Inline-Skripte blockiert). Styling ' +
      'nur über einen <style>-Block. Deutsche Anführungszeichen direkt als „…“ setzen. ' +
      'SELBSTPRÜFUNG vor Abschluss (Pflicht): `grep -c "<script" <datei>` muss 0 ergeben; der ' +
      'sichtbare Text enthält Schritt 0, Akt 1 bis 4, Spickzettel und Begleit-DM; die Wortzahl des ' +
      'Sprechtexts liegt unter 520 und steht im Kopf.',
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
    // Kontext-Datei (z. B. die Sprechfassung im Vault) direkt in den Prompt
    // legen. Fehlt sie, läuft der Agent trotzdem — mit ehrlichem Hinweis, statt
    // sich still etwas auszudenken.
    const kontext = () => {
      if (!a.kontextDatei) return ''
      try {
        const txt = readFileSync(a.kontextDatei, 'utf8')
        return `\n\n===== ${a.kontextLabel ?? 'KONTEXT'} (Quelle: ${a.kontextDatei}) =====\n${txt}\n===== ENDE ${a.kontextLabel ?? 'KONTEXT'} =====\n`
      } catch (e) {
        console.error('[runner] Kontext-Datei nicht lesbar:', a.kontextDatei, e?.message ?? e)
        return `\n\n[WARNUNG: ${a.kontextLabel ?? 'KONTEXT'} konnte nicht geladen werden. Brich ab und melde das, statt den Inhalt zu erfinden.]\n`
      }
    }
    return {
      cwd: a.cwd,
      buildPrompt: (inputBlock) => `${a.prompt}${inputBlock}${kontext()}`,
      // Scoped, KEIN Blanket-Bypass: acceptEdits erlaubt nur Datei-Writes im
      // cwd; die konkreten Build-Befehle (node/mkdir/…) sind in a.cwd/.claude/
      // settings.json allow-gelistet. Alles andere wird headless verweigert.
      //
      // 19.08.2026: `WebFetch` aus der Projekt-settings.json griff headless
      // nicht — der erste Loom-Lauf brach ab, weil er die Website des Leads
      // nicht laden durfte. Die Werkzeugliste steht deshalb explizit am Aufruf.
      // Bewusst ohne Bash-Wildcard: die Build-Befehle bleiben in settings.json.
      extraArgs: [
        '--permission-mode',
        'acceptEdits',
        '--allowedTools',
        'Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Bash(node:*),Bash(mkdir:*),Bash(ls:*),Bash(cat:*),Bash(date:*)',
      ],
    }
  }
  // readonly: Vault-Skill als Slash-Command. Modell, Denktiefe und Werkzeuge
  // sind je Agent optional — ohne Angabe bleibt es beim CLI-Standard.
  return {
    cwd: VAULT,
    buildPrompt: (inputBlock) => `/${agent}${inputBlock}`,
    extraArgs: [
      ...(a.modell ? ['--model', a.modell] : []),
      ...(a.effort ? ['--effort', a.effort] : []),
      ...(a.tools ? ['--allowedTools', a.tools] : []),
    ],
  }
}

// ---------- Zustand ----------
/**
 * O17: Der Eintrag traegt jetzt die **Mitschrift** des Laufs (`lauf`). Daran
 * haengt zweierlei — die Run-Liste zeigt einem laufenden Agenten beim Arbeiten
 * zu, und ein Abbruch hinterlaesst ein Protokoll statt „kein Output".
 * @type {Map<string, {id:string, agent:string, startedAt:string, proc:import('node:child_process').ChildProcess, lauf:ReturnType<typeof neuerLauf>}>}
 */
const running = new Map()
let linkedinSyncRunning = false

/**
 * Der Netzwerk-Sync (Einladungen + Kontakte) hat einen EIGENEN Guard.
 *
 * Er teilt sich das Sync-Chrome mit dem Postfach-Sync, aber nicht dessen Tab —
 * und er dauert rund fünf Minuten statt einer. Mit demselben Flag hätte ein
 * laufender Netzwerk-Sync jeden Postfach-Sync blockiert; das ist zu teuer für
 * die Zahl, die Kevin morgens wirklich braucht.
 *
 * `stand` ist das, was die Oberfläche abfragt: ein langer Lauf antwortet nicht
 * im Request, sondern hinterlässt hier sein Ergebnis.
 */
let netzwerkSync = { laeuft: false, seit: null, letztes: null }

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
    // O17: Zwischenstände eines laufenden Agenten haben kein Ende — ein
    // Zeitstempel dort läse sich wie ein fertiger Lauf.
    `finished: ${status === 'running' ? '' : new Date().toISOString()}`,
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
  const eintrag = { id: name.replace(/\.md$/, ''), ...meta, preview }
  // Warum es schiefging, steht in der Mitschrift, nicht in der Frontmatter.
  // Hier beim Ausliefern gelesen statt beim Schreiben — so sprechen auch die
  // Läufe, die längst im Vault liegen (12.08.).
  if (eintrag.status === 'error') {
    const grund = laufGrund(body)
    if (grund) eintrag.grund = grund
  }
  return eintrag
}

/**
 * Wie oft eine Routine an einem Tag hoechstens versucht wird (O17 Schritt 4).
 * Zwei: einmal regulaer, einmal Nachschlag. Ohne Deckel wuerde der 5-Minuten-Tick
 * einen dauerhaft scheiternden Agenten den ganzen Tag alle fuenf Minuten neu
 * starten — Tokens verbrannt, Run-Ordner zugemuellt.
 */
const MAX_VERSUCHE_PRO_TAG = Number(process.env.MAX_VERSUCHE_PRO_TAG ?? 2)

/**
 * Eigener, höherer Deckel für Läufe, die nur an der Anmeldung scheiterten
 * (13.08.). Vier statt zwei: so ein Lauf kostet nichts und ist nach einem
 * Neu-Login sofort wieder gut — er darf das echte Kontingent nicht
 * aufbrauchen, aber auch nicht endlos nachschlagen.
 */
const MAX_ANMELDUNG_PRO_TAG = Number(process.env.MAX_ANMELDUNG_PRO_TAG ?? 4)

/**
 * Eigener Deckel für Fehlstarts (18.08.): Läufe, die der schlafende Mac
 * verschluckt hat, bevor die CLI einen einzigen Zug tun konnte. Sechs statt
 * zwei — so ein Lauf kostet keinen Token und sagt nichts über den Agenten.
 * Seit `warteAufRechner` sollten sie gar nicht mehr entstehen; der Deckel ist
 * der Gurt für den Fall, dass der Mac MITTEN im Lauf einschläft.
 */
const MAX_FEHLSTART_PRO_TAG = Number(process.env.MAX_FEHLSTART_PRO_TAG ?? 6)

/**
 * Was ein Agent heute schon getan hat — nach **Status**, nicht nach Dateiname.
 *
 * O17 Schritt 4: Der alte Guard prüfte nur, ob eine Datei mit heutigem Datum und
 * dem Agentennamen existiert. Ein Fehlschlag um 6:00 zählte damit als „heute
 * schon gelaufen" — der Fehler deckte sich selbst zu, und der Morgenbrief blieb
 * bis zum nächsten Tag aus. Jetzt entscheidet der Status in der Frontmatter.
 */
async function tagesLaufStand(agent, heute) {
  const namen = (await readdir(RUNS_DIR)).filter(
    (n) => n.endsWith('.md') && n.startsWith(heute) && n.includes(agent),
  )
  const metas = []
  for (const name of namen) {
    const raw = await readFile(join(RUNS_DIR, name), 'utf8')
    metas.push(parseRun(name, raw))
  }
  return bewerteTagesLaeufe(metas, agent)
}

/**
 * Darf die Routine jetzt starten? Fasst die drei Bedingungen zusammen, die
 * vorher in jeder `maybe*`-Funktion einzeln (und ungleich) standen.
 */
async function routineFaellig(agent, heute) {
  const { erfolg, fehlschlaege, anmeldungFehler, fehlstarts } = await tagesLaufStand(agent, heute)
  return darfRoutineStarten({
    erfolg,
    fehlschlaege,
    anmeldungFehler,
    fehlstarts,
    laeuft: [...running.values()].some((r) => r.agent === agent),
    maxVersuche: MAX_VERSUCHE_PRO_TAG,
    maxAnmeldung: MAX_ANMELDUNG_PRO_TAG,
    maxFehlstart: MAX_FEHLSTART_PRO_TAG,
  })
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
    const eintragId = name.replace(/\.md$/, '')
    // O17: Ein laufender Agent hat jetzt AUCH eine Datei (die Mitschrift). Ohne
    // diese Zeile stünde er zweimal in der Liste — einmal aus `running`, einmal
    // aus der Datei, mit identischer id. Die Speicher-Fassung gewinnt, sie ist
    // aktueller als der letzte Schreib-Tick.
    if (running.has(eintragId)) continue
    const raw = await readFile(join(RUNS_DIR, name), 'utf8')
    const eintrag = parseRun(name, raw)
    if (mitInhalt) {
      eintrag.content = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').slice(0, RUN_CONTENT_MAX)
    }
    runs.push(eintrag)
  }
  const aktiv = [...running.values()].map(({ id, agent, startedAt, lauf }) => ({
    id,
    agent,
    status: 'running',
    started: startedAt,
    finished: '',
    // O17: Die Vorschau zeigt den letzten Schritt statt eines ewigen „läuft…".
    preview: lauf?.zeilen?.length ? lauf.zeilen[lauf.zeilen.length - 1].slice(0, 160) : 'läuft…',
    ...(mitInhalt
      ? { content: lauf ? protokollText(lauf, { titel: 'Läuft' }).slice(0, RUN_CONTENT_MAX) : '' }
      : {}),
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
  const { threads, uebersprungenOffIcp } = await holeAntwortThreads({
    supabaseUrl: SUPABASE_URL,
    headers: supabaseHeaders(),
    brandSlug: process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann',
    now,
  })
  // Sichtbar machen, was der ICP-Filter (18.08.) zurückhält. Schweigt er, sieht
  // niemand, ob er sinnvoll arbeitet oder gerade Kunden aussortiert.
  if (uebersprungenOffIcp > 0) {
    console.log(`[runner] antwort-entwuerfe: ${uebersprungenOffIcp} Off-ICP übersprungen (kein Entwurf)`)
  }
  if (!threads.length) return null
  const gebaut = baueAntwortInput(threads, now)
  // Alle wartenden Threads haben bereits einen frischen Entwurf → nichts zu tun.
  // Ein Lauf mit leerer Liste wäre nur eine Zeile Rauschen in der Freigaben-Queue.
  if (!gebaut.input.threads.length) return null
  return gebaut
}

/**
 * Nach einem fertigen `linkedin-sortierer`-Lauf: nur die Urteile wegschreiben.
 *
 * Bewusst nicht über `entwuerfeAnThreads`: Der Sortierer liefert keine Entwürfe,
 * und ein gemeinsamer Pfad würde bei ihm jedes Mal „kein verwertbarer json-Block"
 * loggen, sobald sich am Entwurfs-Format etwas ändert. Zwei Agenten, zwei
 * Ergebnisse, zwei Schreiber — dieselbe Tabelle.
 */
async function urteileAnThreads(runId, markdown) {
  if (!SNAPSHOT_ENABLED) return
  try {
    const urteile = parseUrteileRoh(markdown)
    if (!urteile.length) {
      console.warn(`[runner] ${runId}: Sortierer ohne verwertbare Urteile`)
      return
    }
    const brandSlug = process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann'
    const br = await fetch(
      `${SUPABASE_URL}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&select=id&limit=1`,
      { headers: supabaseHeaders() },
    )
    const [brand] = br.ok ? await br.json() : []
    if (!brand?.id) return

    const r = await schreibeUrteile({
      supabaseUrl: SUPABASE_URL,
      headers: supabaseHeaders(),
      brandId: brand.id,
      urteile,
    })
    const je = urteile.reduce((k, u) => ({ ...k, [u.urteil]: (k[u.urteil] ?? 0) + 1 }), {})
    console.log(
      `[runner] Sortierer: ${r.geschrieben} Urteile geschrieben · ` +
        `${je.lead ?? 0} bleiben, ${je.kontakt ?? 0} Kontakt, ${je.akquise ?? 0} aussortiert`,
    )
  } catch (e) {
    // Ein Urteil ist Zusatznutzen. Der Bericht steht bereits in der Run-Datei.
    console.error(`[runner] ${runId}: Urteile nicht geschrieben:`, e?.message ?? e)
  }
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
    const urteile = parseUrteileRoh(markdown)
    // Ein Lauf ohne Entwürfe kann trotzdem etwas wert sein: Sind alle
    // vorgelegten Threads Akquise-Versuche, ist die Urteilsliste das ganze
    // Ergebnis — und genau die hält sie morgen aus Kevins Spur.
    if (!drafts.length && !urteile.length) {
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

    if (urteile.length) {
      const u = await schreibeUrteile({
        supabaseUrl: SUPABASE_URL,
        headers: supabaseHeaders(),
        brandId: brand.id,
        urteile,
      })
      const akquise = urteile.filter((x) => x.urteil === 'akquise').length
      console.log(
        `[runner] Urteile am Thread: ${u.geschrieben} geschrieben` +
          (akquise ? ` · ${akquise} als Akquise-Versuch aussortiert` : ''),
      )
    }

    if (!drafts.length) return

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

/**
 * Wo `claude` liegt — einmal berechnet, von Agentenstart UND Schleuse benutzt
 * (18.08.). Unter launchd fehlt die CLI oft im PATH; prüfte die Schleuse mit
 * einem anderen PATH als der Lauf, bestätigte sie eine Anmeldung, an die der
 * Agent nie herankommt.
 */
const CLI_PATH = [
  process.env.PATH ?? '',
  join(homedir(), '.nvm', 'versions', 'node', `v${process.versions.node}`, 'bin'),
  join(homedir(), '.local', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
]
  .filter(Boolean)
  .join(':')

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

  const PATH = CLI_PATH

  // O17 (07.08.2026): `--output-format text` schweigt bis zum Schluss und gibt
  // dann alles auf einmal aus. Ein abgebrochener Lauf hinterlässt damit exakt
  // nichts — neun Run-Dateien seit dem 03.08. sagen „kein Output". Mit
  // `stream-json --verbose` kommt eine Zeile JSON je Ereignis, die wir laufend
  // mitschreiben. Der Endtext steht im `result`-Ereignis; die Run-Datei sieht
  // bei Erfolg unverändert aus (die Freigaben-Queue liest den ```json-Block).
  const claudeBin = process.env.CLAUDE_BIN ?? 'claude'
  const claudeArgs = ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...cfg.extraArgs]
  // O17 Schritt 2: unter `caffeinate` starten, damit der Mac den Lauf nicht
  // verschlaeft. Kein macOS (oder Binary fehlt) → unveraendert direkt starten.
  const mitCaffeinate = existsSync(CAFFEINATE_BIN)
  const [befehl, argumente] = mitCaffeinate
    ? [CAFFEINATE_BIN, ['-i', '-s', claudeBin, ...claudeArgs]]
    : [claudeBin, claudeArgs]

  const proc = spawn(befehl, argumente, {
    cwd: cfg.cwd,
    env: { ...process.env, PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
    // O17 Schritt 3: eigene Prozessgruppe, damit `beendeBaum` den ganzen Baum
    // treffen kann statt nur caffeinate bzw. claude selbst.
    detached: true,
  })

  const lauf = neuerLauf(Date.now())
  let puffer = ''
  let stderr = ''
  proc.stdout.on('data', (c) => {
    puffer = nimmBrocken(lauf, puffer, c, Date.now())
    planeLiveSchreiben()
  })
  proc.stderr.on('data', (c) => (stderr += c))

  /**
   * Mitschrift regelmäßig auf Platte, damit auch ein harter Abbruch des
   * Runners (Neustart, Absturz, `kill -9`) Spuren hinterlässt. Gedrosselt:
   * ein Agenten-Lauf erzeugt hunderte Ereignisse, und die Datei liegt im
   * iCloud-synchronisierten Vault.
   */
  let liveTimer = null
  let liveLaeuft = false
  const schreibeLive = async () => {
    if (liveLaeuft) return
    liveLaeuft = true
    try {
      await writeRunFile(id, agent, 'running', startedAt, protokollText(lauf, { titel: 'Läuft' }) + '\n')
    } catch {
      /* Mitschrift ist Diagnose, kein Selbstzweck — ein Schreibfehler darf den Lauf nicht kippen */
    } finally {
      liveLaeuft = false
    }
  }
  function planeLiveSchreiben() {
    if (liveTimer) return
    liveTimer = setTimeout(() => {
      liveTimer = null
      void schreibeLive()
    }, LIVE_SCHREIB_MS)
  }

  const timeout = setTimeout(() => {
    console.warn(`[runner] ${id}: ${Math.round(TIMEOUT_MS / 60000)} Minuten ueberschritten — beende den Prozessbaum`)
    beendeBaum(proc, id)
  }, TIMEOUT_MS)

  running.set(id, { id, agent, startedAt, proc, lauf })

  // spawn-Fehler (z.B. claude nicht im PATH) dürfen den Runner NICHT crashen —
  // ohne diesen Handler wirft der ChildProcess ein unhandled 'error' Event
  // (beobachtet: ENOENT-Crash-Loop unter launchd am 08.07.).
  proc.on('error', async (e) => {
    clearTimeout(timeout)
    if (liveTimer) clearTimeout(liveTimer)
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
    if (liveTimer) clearTimeout(liveTimer)
    if (puffer.trim()) nimmBrocken(lauf, puffer, '\n', Date.now())
    running.delete(id)
    const ergebnis = (lauf.ergebnis ?? '').trim()
    try {
      if (code === 0 && ergebnis) {
        // 18.08.: Ein gelungener Lauf ist der beste Beweis, dass die CLI
        // durchkommt — die Schleuse spart sich daraufhin ihren eigenen Ping.
        letzterErfolgAt = Date.now()
        // Unverändertes Format: der Endtext, sonst nichts. Die Mitschrift ist
        // Diagnose für den Fehlerfall und hat im gelungenen Lauf nichts verloren.
        await writeRunFile(id, agent, 'done', startedAt, ergebnis + '\n')
        // Beide Entwurfs-Agenten liefern denselben json-Block am Ende und werden
        // deshalb gleich behandelt. Ohne diese Zeile landet ein Follow-up-Entwurf
        // nur in der Run-Datei — also genau dort, wo Kevin ihn nicht kopiert.
        // Der Follow-up-Agent läuft seit dem 25.08. nur noch auf Knopfdruck
        // (`/linkedin`); den Regelfall bedienen die festen Vorlagen in
        // app/src/cockpit/lib/followupVorlagen.ts. Für den Ausnahmefall, in dem
        // Kevin doch einen individuellen Text will, muss der Entwurf trotzdem
        // am Posten landen und nicht im Protokoll.
        if (agent === 'linkedin-antwort-entwuerfe' || agent === 'linkedin-followup-entwuerfe') {
          await entwuerfeAnThreads(id, ergebnis)
        }
        if (agent === 'linkedin-sortierer') await urteileAnThreads(id, ergebnis)
      } else {
        // O17: Statt „kein Output" steht hier jetzt, wie weit der Lauf kam.
        // 143 = 128+SIGTERM, 137 = 128+SIGKILL, null = per Signal beendet.
        const abgebrochen = code === 143 || code === 137 || code === null
        const limit =
          TIMEOUT_MS >= 60_000
            ? `${Math.round(TIMEOUT_MS / 60_000)} Minuten`
            : `${Math.round(TIMEOUT_MS / 1000)} Sekunden`
        const grund = abgebrochen
          ? `# Run abgebrochen (Exit ${code} — Zeitlimit ${limit})`
          : `# Run fehlgeschlagen (Exit ${code})`
        const err = [
          grund,
          '',
          protokollText(lauf, { titel: 'Mitschrift bis zum Abbruch' }),
          ...(stderr.trim() ? ['', '**stderr**', '', '```', stderr.trim().slice(-2000), '```'] : []),
        ].join('\n')
        await writeRunFile(id, agent, 'error', startedAt, err + '\n')
        // 13.08.: Die Anmelde-Meldung der CLI kommt über stdout, nicht über
        // stderr — deshalb blieb das Runner-Log während der fünf stillen Tage ab
        // dem 11.08. leer, und der Ausfall stand nur in der Run-Datei. Was Kevin
        // von Hand beheben muss (`handeln`), gehört ins Log.
        const warum = laufGrund(err)
        if (warum?.handeln) console.error(`[runner] ${id}: ${warum.kurz} — ${warum.hinweis}`)
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

    /**
     * Konflikt-Ziel OHNE `gruppe` (0071). Die Gruppen-Überschrift ist eine
     * Beschriftung aus dem Vault, kein Schlüssel: Formuliert Kevin sie um
     * ("Gruppe 1 — … (raus am 13.07., nur Sabine Keulertz noch offen)" →
     * "… (raus 13./14.07.)"), passte mit dem alten Ziel kein Datensatz mehr auf
     * den Konflikt und der Spiegel legte die ganze Gruppe erneut an — 145
     * Zeilen für 118 Leads, "144 offen". Jetzt wandert die neue Beschriftung
     * als Update auf den bestehenden Datensatz.
     */
    const spiegle = (konflikt) =>
      fetch(`${SUPABASE_URL}/rest/v1/linkedin_erstnachrichten?on_conflict=${konflikt}`, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(rows),
      })

    let res = await spiegle('brand_id,name')
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      // 42P10 = kein passender Unique-Index. Dann ist 0071 noch nicht gepusht;
      // der Spiegel läuft solange auf dem alten Ziel weiter, statt still
      // auszufallen. Die Entdopplung in der Oberfläche fängt das ab.
      if (txt.includes('42P10')) {
        console.warn('[runner] Erstnachrichten-Spiegel: Migration 0071 fehlt, weiche auf altes Konflikt-Ziel aus')
        res = await spiegle('brand_id,gruppe,name')
      }
      if (!res.ok) {
        const txt2 = await res.text().catch(() => '')
        console.error(`[runner] Erstnachrichten-Spiegel HTTP ${res.status}: ${(txt2 || txt).slice(0, 200)}`)
        return
      }
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
  // Der Weg vom Handy: dort gibt es keinen Draht auf 127.0.0.1, der Auftrag
  // kommt über `runner_jobs`. Hier darf gewartet werden — anders als am
  // HTTP-Pfad hängt niemand an der Antwort.
  if (job.kind === 'linkedin_netzwerk_sync') {
    if (netzwerkSync.laeuft) throw new Error('Netzwerk-Sync läuft bereits')
    await starteNetzwerkSync()
    return netzwerkSync.letztes ?? netzwerkStand()
  }

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

/** Wie viele Fehlschläge in Folge, bevor der Runner Alarm gibt (18.08.). */
const POLL_FEHLER_SCHWELLE = 3
let pollFehlerSerie = 0

async function pollJobs() {
  if (!SNAPSHOT_ENABLED || jobLaeuft) return
  jobLaeuft = true
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/runner_jobs?status=eq.pending&order=created_at.asc&limit=1`,
      { headers: supabaseHeaders() },
    )
    if (!res.ok) return
    // Die Leitung steht wieder — die Serie beginnt von vorn.
    pollFehlerSerie = 0
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
    /**
     * Erst bei einer Serie melden (18.08.).
     *
     * Die Abfrage läuft alle vier Sekunden. Ein einzelner Aussetzer — WLAN
     * wechselt, Supabase hustet — heilt sich mit dem nächsten Durchlauf von
     * selbst und sagt niemandem etwas. Im Log standen dadurch tagelang
     * „Auftrags-Abfrage fehlgeschlagen"-Zeilen, an die man sich gewöhnt; genau
     * dann übersieht man die Serie, die wirklich bedeutet, dass Kevins Knöpfe
     * vom Handy ins Leere gehen. Drei hintereinander sind rund zwölf Sekunden
     * ohne Draht — das ist eine Meldung wert, ein einzelner nicht.
     */
    pollFehlerSerie += 1
    if (pollFehlerSerie === POLL_FEHLER_SCHWELLE) {
      console.error(
        `[runner] Auftrags-Abfrage fehlgeschlagen (${pollFehlerSerie}× in Folge — Cockpit-Knöpfe vom Handy kommen gerade nicht an): ${e?.message ?? e}`,
      )
    }
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
        // Hart leer, und das ist ehrlich: eine Warteschlange gibt es hier nicht.
        // Auftraege vom Handy laufen ueber `runner_jobs` (0059); `System/Queue`
        // ist seit dem nur noch Debug-Protokoll (siehe raeumeQueue).
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
  // Seit 19.08.2026 liegen die generierten Loom-Skripte im Unterordner
  // `Loom-Skripte/` (Kevins Wunsch: ein Ordner zum Abarbeiten). Die Bibliothek
  // liest beide Ebenen, damit „Skript öffnen" im Cockpit weiter funktioniert;
  // `rel` trägt den Unterordner mit — der Datei-Spiegel joint ihn auf SALES_ROOT.
  const skripteFiles = [
    ...(await listDir(SALES_ROOT, new Set(['.md', '.html', '.pdf']))),
    ...(await listDir(join(SALES_ROOT, 'Loom-Skripte'), new Set(['.md', '.html', '.pdf']))).map((f) => ({
      ...f,
      rel: `Loom-Skripte/${f.name}`,
    })),
  ].sort((a, b) => (a.mtime < b.mtime ? 1 : -1))

  return {
    vault: vaultFiles.map((f) => ({
      name: f.name.replace(/\.md$/, ''),
      path: join('03 Bereiche', 'Vertrieb & Outreach', f.name),
      kind: 'md',
      mtime: f.mtime,
    })),
    skripte: skripteFiles.map((f) => ({
      name: f.name.replace(/\.(html|pdf|md)$/, ''),
      rel: f.rel ?? f.name,
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
        // Siehe Heartbeat: keine echte Warteschlange, `System/Queue` ist Protokoll.
        queued: [],
        // 18.08.: Warum gerade nichts läuft, muss man abfragen können, ohne im
        // Log zu suchen — `null` heißt: seit dem Start war keine Routine fällig.
        schleuse: schleuseLetztes(),
        wach: wachStand().wach,
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

    // ---------- Netzwerk-Sync: Einladungen + Kontakte (Wargame funnel-stufen.md) ----------
    // Fünf Minuten Laufzeit — deshalb im Hintergrund gestartet und sofort
    // geantwortet. Wer wissen will, ob er durch ist, fragt GET /linkedin/netzwerk.
    if (req.method === 'POST' && url.pathname === '/linkedin/netzwerk-sync') {
      if (netzwerkSync.laeuft) return json(res, 409, { error: 'Netzwerk-Sync läuft bereits', ...netzwerkStand() })
      void starteNetzwerkSync()
      return json(res, 202, { gestartet: true, ...netzwerkStand() })
    }

    if (req.method === 'GET' && url.pathname === '/linkedin/netzwerk') {
      return json(res, 200, netzwerkStand())
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

    // ---------- „Als gepostet markieren" (O9 / D5) ----------
    // Der Schreiber, den das Manifest nie hatte. Bewusst ein eigener, winziger
    // Endpoint statt des PUT-Wegs: die App schickt nur `{brand, postId}` bzw.
    // `{brand, week}` und nie ein ganzes Manifest — sie kann den Rest der Datei
    // also gar nicht überschreiben. Vault-Dateien schreibt nur der Runner (D5).
    if (url.pathname === '/content/posted' && req.method === 'POST') {
      let body
      try {
        body = JSON.parse(await readBodyCapped(req, MANIFEST_MAX_BYTES))
      } catch (e) {
        if (e?.code === 'ETOOBIG') return json(res, 413, { error: 'Body zu groß' })
        return json(res, 400, { error: 'ungültiges JSON' })
      }
      const brand = String(body?.brand ?? '')
      const week = body?.week ? String(body.week) : null
      const postId = body?.postId ? String(body.postId) : null
      const file = contentManifestPath(brand)
      if (!file) return json(res, 400, { error: `Unbekannter Brand: ${brand}` })
      if (!week && !postId) return json(res, 400, { error: 'week oder postId erwartet' })

      // Läuft der Batch gerade, schreiben wir NICHT — sonst überschreibt einer
      // von beiden den anderen und das Manifest ist danach unvollständig.
      if ([...running.values()].some((r) => r.agent === 'weekly-content')) {
        return json(res, 409, { error: 'Content-Batch läuft gerade — gleich nochmal.' })
      }

      let manifest = null
      try {
        manifest = JSON.parse(await readFile(file, 'utf8'))
      } catch (e) {
        // Fehlt die Datei, ist das kein Fehler: leeres Manifest anlegen.
        if (e?.code === 'ENOENT') manifest = emptyContentManifest(brand)
        else return json(res, 500, { error: 'content.json ist kein gültiges JSON — von Hand prüfen' })
      }
      if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.posts)) {
        return json(res, 500, { error: 'content.json hat nicht die erwartete Form (schemaVersion 1, posts[])' })
      }

      const postedAt = new Date().toISOString()
      let getroffen = 0
      manifest.posts = manifest.posts.map((p) => {
        const passt = postId ? p.id === postId : p.week === week
        if (!passt || p.status === 'posted') return p
        getroffen++
        return { ...p, status: 'posted', postedAt }
      })
      if (getroffen === 0) {
        return json(res, 200, { ok: true, getroffen: 0, updatedAt: manifest.updatedAt ?? null })
      }

      manifest.updatedAt = postedAt
      // Sicherheitsnetz + atomarer Tausch: erst .bak, dann temp schreiben und
      // umbenennen. Ein abgebrochener Schreibvorgang hinterlässt so nie eine
      // halbe Datei, die der nächste GET als kaputtes JSON meldet.
      const inhalt = JSON.stringify(manifest, null, 2) + '\n'
      try {
        const alt = await readFile(file, 'utf8')
        await writeFile(`${file}.bak`, alt, 'utf8')
      } catch (e) {
        if (e?.code !== 'ENOENT') throw e
      }
      const tmp = `${file}.tmp`
      await writeFile(tmp, inhalt, 'utf8')
      try {
        await rename(tmp, file)
      } catch (e) {
        await unlink(tmp).catch(() => {})
        throw e
      }
      console.log(`[content] ${getroffen} Post(s) als gepostet markiert (${postId ?? week})`)
      return json(res, 200, { ok: true, getroffen, updatedAt: manifest.updatedAt })
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
 * Queue-Deckel (O13). `System/Queue` ist seit Migration 0059 nur noch ein
 * Debug-Protokoll — Aufträge vom Handy laufen über `runner_jobs`. Geschrieben
 * wurde hier trotzdem bei jedem Lauf, geleert nie. Beim Boot fliegt raus, was
 * älter als 14 Tage ist; nur Dateien, Ordner bleiben unangetastet.
 */
const QUEUE_MAX_ALTER_MS = 14 * 24 * 60 * 60 * 1000

async function raeumeQueue() {
  try {
    const jetzt = Date.now()
    let geloescht = 0
    for (const name of await readdir(QUEUE_DIR)) {
      const pfad = join(QUEUE_DIR, name)
      try {
        const s = await stat(pfad)
        if (!s.isFile()) continue
        if (jetzt - s.mtimeMs <= QUEUE_MAX_ALTER_MS) continue
        await unlink(pfad)
        geloescht++
      } catch {
        /* Einzelne Datei überspringen — Aufräumen darf den Boot nie aufhalten. */
      }
    }
    if (geloescht > 0) console.log(`[queue] ${geloescht} Datei(en) älter als 14 Tage gelöscht`)
  } catch (e) {
    console.warn('[queue] Aufräumen übersprungen:', e?.message ?? e)
  }
}

void raeumeQueue()

/**
 * Der Wach-Wächter (18.08.2026) — „erst wach, dann losrennen".
 *
 * **Der Fehler, den das behebt.** Siehe Kopf von `startBereit.mjs`: Vier rote
 * Morgen-Läufe mit je null Ereignissen, weil der Mac im DarkWake kurz die Timer
 * feuern ließ und sofort weiterschlief. Der Runner startete Agenten in einen
 * Rechner hinein, der gar nicht arbeiten konnte, und verbrauchte damit den
 * Tagesdeckel, bevor Kevin überhaupt am Schreibtisch saß.
 *
 * Der Tick hier ist die Uhr, an der sich das messen lässt: `setInterval` steht
 * im Schlaf still. Kommt der Tick pünktlich, war der Mac wach; klafft eine
 * Lücke, lag er dazwischen — und die Karenz beginnt von vorn.
 */
const WACH_TICK_MS = 60 * 1000
let letzterWachTick = null
let wachSeit = Date.now()
let wachTimer = null

/**
 * Nach einem erkannten Aufwacher genau einmal nachfassen, sobald die Karenz
 * abgelaufen ist. Ohne das läge zwischen „Kevin klappt den Laptop auf" und dem
 * ersten Morgenbrief-Versuch der Zufall des 5-Minuten-Ticks; so ist es die
 * Karenz plus ein paar Sekunden.
 */
function planeNachDemAufwachen() {
  if (wachTimer) return
  wachTimer = setTimeout(() => {
    wachTimer = null
    // Das Postfach zuerst — es ist die Quelle, aus der die Entwürfe entstehen.
    // Ohne diese Zeile wartete es beim Aufwachen auf den nächsten
    // Fünf-Minuten-Tick, während die Entwürfe schon liefen (18.08. gemessen).
    void maybePostfachSync()
    void maybeMorgenbrief()
    void maybeAntwortEntwuerfe()
    void maybeSortierer()
  }, WACH_KARENZ_MS + 10_000)
  wachTimer.unref?.()
}

function wachTick() {
  const jetzt = Date.now()
  const erstTick = letzterWachTick === null
  const b = bewerteWachheit({ jetzt, letzterTick: letzterWachTick, wachSeit, tickAbstandMs: WACH_TICK_MS })
  letzterWachTick = jetzt
  wachSeit = b.wachSeit
  if (b.schlafErkannt) {
    console.log(`[runner] Mac war ${Math.round(b.luecke / 60000)} Min. weg — Routinen warten auf stabile Wachheit`)
  }
  // Auch der allererste Tick fasst nach: Ein Runner-Neustart ist häufig selbst
  // die Folge eines Aufwachers, und ohne Nachfassen hinge der Morgenbrief bis
  // zum regulären Fünf-Minuten-Tick fest.
  if (b.schlafErkannt || erstTick) planeNachDemAufwachen()
}

/** Wie lange der Mac jetzt am Stück wach ist — Grundlage jeder Startfreigabe. */
function wachStand() {
  return bewerteWachheit({
    jetzt: Date.now(),
    letzterTick: letzterWachTick,
    wachSeit,
    tickAbstandMs: WACH_TICK_MS,
  })
}

/** Warte-Meldungen höchstens alle 30 Minuten je Agent — sonst 200 Zeilen pro Nacht. */
const WARTE_LOG_MS = 30 * 60 * 1000
const warteLog = new Map()

/**
 * Den Sync-Chrome selbst hochfahren, wenn ein Agent ihn braucht (18.08.).
 *
 * Kevins Bild vom Ablauf: „wartet, bis Laptop und Chrome offen sind, und geht
 * dann selbstständig rein." Der Laptop ist seine Sache — Chrome nicht: Das
 * Sync-Profil `~/.uriel-chrome` ist reine Maschinerie, kein Fenster, in dem er
 * arbeitet. Genau derselbe Befehl wie sein Alias `chrome-sync` in `~/.zshrc`.
 *
 * Eng eingezäunt, weil ein Fenster aufpoppt: höchstens einmal pro Stunde, nur
 * tagsüber, abschaltbar über `CHROME_AUTOSTART=0`. Ein LinkedIn, das in diesem
 * Profil ausgeloggt ist, kann das hier NICHT heilen — dann bleibt es bei der
 * Meldung aus `sync.mjs`, und Kevin muss sich einmal von Hand anmelden.
 */
const CHROME_AUTOSTART = process.env.CHROME_AUTOSTART !== '0'
const CHROME_START_ABSTAND_MS = 60 * 60 * 1000
/**
 * Wie lange die Sperre gilt, wenn der Start NICHT geklappt hat (25.08.).
 *
 * Am 24.08. stand der Postfach-Sync 26 Stunden still. Der Runner hatte um
 * 13:20 ein Chrome gestartet, das nie hochkam — und weil die Marke schon vor
 * dem Start geschrieben wird, galt danach trotzdem die volle Stundensperre.
 * Eine Stunde Blindheit als Preis für einen Versuch, der nachweislich
 * gescheitert ist, ist zu teuer.
 *
 * Die Marke bleibt bewusst VOR dem Start stehen: Sie ist der Schutz gegen den
 * Start-Sturm, der Kevin am 20.08. genervt hat („immer wieder geht Chrome
 * auf"). Nur wird sie jetzt zurückdatiert, wenn die Nachprüfung zeigt, dass
 * kein Chrome hochgekommen ist. Gelungener Start: eine Stunde Ruhe.
 * Gescheiterter: zehn Minuten.
 */
const CHROME_FEHLSTART_ABSTAND_MS = 10 * 60 * 1000
/**
 * Die Stunden-Sperre liegt auf Platte, nicht im Prozess (20.08.).
 *
 * Als reine Modul-Variable war sie wirkungslos: Der Runner laeuft unter
 * launchd mit KeepAlive und startet bei jedem Schlaf-/Wach-Zyklus des Macs
 * neu — im Log stehen 171 Starts. Jeder Neustart setzte den Zaehler auf 0,
 * der naechste Tick durfte sofort wieder ein Chrome-Fenster aufmachen. Genau
 * das nervte Kevin am 20.08.: "immer wieder geht Chrome auf".
 */
const CHROME_START_MARKE = join(LOG_DIR, '.letzter-chrome-start')

/**
 * Zeitmarken, die einen Runner-Neustart ueberleben (20.08.).
 *
 * Gleicher Grund wie bei der Chrome-Sperre darunter: launchd startet den
 * Runner bei jedem Schlaf-/Wach-Zyklus neu. Jede reine Modul-Variable faellt
 * dabei auf 0 zurueck — und eine Routine, die alle zwei Stunden laufen soll,
 * lief in Wahrheit nach jedem Aufwachen wieder los.
 */
function markeLies(name) {
  try {
    return Number(readFileSync(join(LOG_DIR, `.${name}`), 'utf8').trim()) || 0
  } catch {
    return 0
  }
}

function markeSchreib(name, wert = Date.now()) {
  try {
    writeFileSync(join(LOG_DIR, `.${name}`), String(wert))
  } catch {
    /* Ohne Marke bleibt es beim alten Verhalten — kein Grund, den Lauf zu verhindern. */
  }
}

function letzterChromeStartAus() {
  try {
    return Number(readFileSync(CHROME_START_MARKE, 'utf8').trim()) || 0
  } catch {
    return 0
  }
}

/** Sperre zurückdatieren, damit der nächste Tick es früher erneut versuchen darf. */
function chromeFehlstartVermerken() {
  markeSchreib(
    'letzter-chrome-start',
    Date.now() - (CHROME_START_ABSTAND_MS - CHROME_FEHLSTART_ABSTAND_MS),
  )
}

async function starteSyncChrome() {
  const stunde = new Date().getHours()
  if (!CHROME_AUTOSTART || stunde < 6 || stunde >= 20) return
  if (Date.now() - letzterChromeStartAus() < CHROME_START_ABSTAND_MS) return
  try {
    writeFileSync(CHROME_START_MARKE, String(Date.now()))
  } catch {
    /* Ohne Marke bleibt es beim alten Verhalten — kein Grund, den Start zu verhindern. */
  }
  try {
    const p = spawn(
      '/usr/bin/open',
      [
        // `-g` haelt das Fenster im Hintergrund: Der Sync braucht keinen Fokus
        // (dafuer gibt es die Fokus-Emulation in netzwerk.mjs), aber ohne `-g`
        // reisst jeder Start Chrome vor Kevins laufende Arbeit.
        '-nag',
        'Google Chrome',
        '--args',
        `--user-data-dir=${join(homedir(), '.uriel-chrome')}`,
        '--remote-debugging-port=9222',
        '--remote-debugging-address=127.0.0.1',
        '--no-first-run',
        '--no-default-browser-check',
      ],
      { detached: true, stdio: 'ignore' },
    )
    p.on('error', (e) => console.error('[runner] Sync-Chrome konnte nicht starten:', e?.message ?? e))
    p.unref()
    console.log('[runner] Sync-Chrome war zu — selbst gestartet, der nächste Tick prüft nach')
  } catch (e) {
    console.error('[runner] Sync-Chrome konnte nicht starten:', e?.message ?? e)
    chromeFehlstartVermerken()
    return
  }

  // Nachfassen statt hoffen: `open` meldet Erfolg, sobald der Startbefehl
  // abgesetzt ist — ob Chrome auch oben bleibt, steht damit noch nicht fest.
  // Auf einem Rechner mit 8 GB beendet macOS es unter Speicherdruck gern
  // gleich wieder, und genau dieser Fall sah bisher aus wie ein Erfolg.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    if (await chromeErreichbar()) return
  }
  console.error(
    '[runner] Sync-Chrome kam nicht hoch — nächster Versuch in ' +
      Math.round(CHROME_FEHLSTART_ABSTAND_MS / 60000) +
      ' Minuten',
  )
  chromeFehlstartVermerken()
}

/**
 * Die Schleuse (18.08.) — Kevins Wunsch: „einen vorab checken lassen, ob wir
 * angemeldet sind und überall reinkommen, und erst dann die anderen loslegen."
 *
 * Der Zustand wird gecacht, weil ihn alle Agenten teilen: Grün hält eine halbe
 * Stunde, Rot nur eine Minute — ein repariertes Login soll sofort greifen, kein
 * Agent soll auf die nächste halbe Stunde warten.
 */
const SCHLEUSE_GRUEN_MS = 30 * 60 * 1000
const SCHLEUSE_ROT_MS = 60 * 1000
/** Der echte CLI-Probelauf: frühestens alle zehn Minuten wieder. */
const DURCHGANG_ABSTAND_MS = 10 * 60 * 1000
/** Ein gelungener Agentenlauf ist der bessere Beweis — und hält sechs Stunden. */
const DURCHGANG_GILT_MS = 6 * 60 * 60 * 1000
let schleuseStand = null
let letzterDurchgang = 0
let letzterErfolgAt = 0

/** Der Befund für Log, Cockpit und Wächter — auch für `/status` lesbar. */
function schleuseLetztes() {
  return schleuseStand ? { ...schleuseStand.urteil, geprueft: new Date(schleuseStand.zeit).toISOString() } : null
}

async function schleuseOffen() {
  const jetzt = Date.now()
  const haltbar = schleuseStand?.urteil.offen ? SCHLEUSE_GRUEN_MS : SCHLEUSE_ROT_MS
  if (schleuseStand && jetzt - schleuseStand.zeit < haltbar) return schleuseStand.urteil

  // Reihenfolge: erst das Billige und Lokale (Millisekunden), dann das Netz.
  const befunde = [
    await pruefeVault(RUNS_DIR),
    await pruefeAnmeldung({ claudeBin: process.env.CLAUDE_BIN ?? 'claude', pfad: CLI_PATH }),
    await pruefeSupabase({ url: SUPABASE_URL, key: SUPABASE_SERVICE_ROLE_KEY }),
  ]

  // Der echte Zug durch die CLI nur, wenn er etwas beweisen kann: Solange heute
  // schon ein Agent durchgelaufen ist, ist der Durchgang belegt — dann wäre der
  // Ping reine Zeremonie.
  const bisGrün = bewerteSchleuse(befunde).offen
  if (bisGrün && jetzt - letzterErfolgAt > DURCHGANG_GILT_MS && jetzt - letzterDurchgang > DURCHGANG_ABSTAND_MS) {
    letzterDurchgang = jetzt
    befunde.push(await pruefeDurchgang({ claudeBin: process.env.CLAUDE_BIN ?? 'claude', pfad: CLI_PATH }))
  }

  const urteil = bewerteSchleuse(befunde)
  // Nur bei Zustandswechsel reden — sonst steht dieselbe Zeile alle fünf
  // Minuten im Log und niemand liest sie mehr.
  const vorher = schleuseStand?.urteil
  if (!vorher || vorher.offen !== urteil.offen || vorher.grund !== urteil.grund) {
    if (urteil.offen) console.log('[runner] Schleuse offen — Agenten dürfen laufen')
    else console.error(`[runner] Schleuse ZU — ${urteil.grund}${urteil.hinweis ? ` · ${urteil.hinweis}` : ''}`)
  }
  schleuseStand = { zeit: jetzt, urteil }
  return urteil
}

/**
 * Darf dieser Agent JETZT starten — oder wartet er auf den Rechner?
 *
 * Ein „nein" ist hier ausdrücklich **kein Fehlversuch**: Es entsteht keine
 * Run-Datei, es zählt nichts auf den Tagesdeckel, und der nächste Tick fragt
 * erneut. Genau das ist der Unterschied zum Zustand vor dem 18.08.
 */
async function warteAufRechner(agent, { brauchtChrome = false } = {}) {
  const { wach } = wachStand()
  // Reihenfolge spart Arbeit: Ist der Mac ohnehin frisch aufgewacht, braucht es
  // weder Netz- noch Chrome-Anfrage.
  const netz = wach ? await netzErreichbar() : false
  const chrome = wach && brauchtChrome ? await chromeErreichbar() : true
  // Fehlt nur noch Chrome, ist das der eine Punkt, den der Runner selbst
  // erledigen kann — starten und beim nächsten Tick nachsehen.
  if (wach && netz && brauchtChrome && !chrome) void starteSyncChrome()
  let stand = startBereitAus({ wach, netz, chrome, brauchtChrome })
  // Steht der Rechner, entscheidet die Schleuse — das, was alle Agenten
  // gemeinsam brauchen, wird einmal geprüft und nicht von jedem einzeln.
  if (stand.bereit) {
    const tor = await schleuseOffen()
    if (!tor.offen) stand = { bereit: false, fehlt: [tor.grund], grund: tor.grund }
  }
  if (!stand.bereit) {
    const zuletzt = warteLog.get(agent)
    if (!zuletzt || zuletzt.grund !== stand.grund || Date.now() - zuletzt.zeit > WARTE_LOG_MS) {
      warteLog.set(agent, { grund: stand.grund, zeit: Date.now() })
      console.log(`[runner] ${agent} wartet — ${stand.grund}`)
    }
  } else {
    warteLog.delete(agent)
  }
  return stand.bereit
}

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
    // O17: Nach Status statt nach Dateiname — ein Fehlschlag um 7:00 darf nicht
    // als „heute schon gelaufen" zählen. Der laufende Agent ist mitgeprüft.
    const heute = nowStamp().slice(0, 10)
    if (!(await routineFaellig('morgenbrief', heute))) return
    // 18.08.: Erst der Rechner, dann der Agent. Ein „nein" kostet nichts und
    // wiederholt sich beim nächsten Tick — der Brief kommt dann eben um 9.
    if (!(await warteAufRechner('morgenbrief'))) return
    console.log('[runner] morgenbrief startet (kein erfolgreicher Lauf heute)…')
    // Denselben Input mitgeben, den der Cockpit-Knopf liefert — sonst sagt der
    // Brief von 7:00 jeden Morgen „Blindflug, keine Vitals durchgereicht".
    // Scheitert der Bau (Netz, DB), läuft der Brief wie bisher ohne Daten —
    // ein blinder Brief ist besser als gar keiner.
    let input = {}
    if (SNAPSHOT_ENABLED) {
      try {
        input = await baueMorgenbriefInput({
          supabaseUrl: SUPABASE_URL,
          serviceKey: SUPABASE_SERVICE_ROLE_KEY,
          jetzt,
        })
      } catch (e) {
        console.error('[runner] morgenbrief-input fehlgeschlagen — Brief läuft ohne App-Daten:', e?.message ?? e)
      }
    }
    await startRun('morgenbrief', input)
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
    const heute = nowStamp().slice(0, 10)
    if (!(await routineFaellig('linkedin-antwort-entwuerfe', heute))) return
    if (!(await warteAufRechner('linkedin-antwort-entwuerfe'))) return
    // 18.08.: Erst das Postfach, dann die Entwürfe. Ohne diese Reihenfolge
    // schreibt der Agent morgens auf dem Stand von gestern Mittag.
    if (!(await postfachFrisch())) {
      console.log('[runner] antwort-entwuerfe wartet — Postfach ist noch nicht frisch gesynct')
      void maybePostfachSync()
      return
    }

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

/**
 * Der Sortierer als Zeit-Routine (25.08.2026).
 *
 * Kevins Auftrag: *„Den Agenten, der vorsortiert, mach den auf jeden Fall. Den
 * werden wir brauchen."* Die Wortlisten erwischten am 25.08. nur 12 von 177
 * fälligen Threads; „Als Unternehmer 5-10KG Fett in 90 Tagen" stand mitten in
 * der Arbeitsliste. Umgekehrt warf derselbe Filter Makler raus, die sich
 * ungewöhnlich beschreiben. Beide Fehler kann nur jemand korrigieren, der die
 * Nachrichten liest.
 *
 * **Zwei Stunden nach den Antwort-Entwürfen** (Standard 8:00). Der Sortierer
 * ist der unwichtigste der drei Läufe — sein Ergebnis wirkt erst auf die
 * Listen von morgen, während eine unbeantwortete Nachricht heute wartet. Er
 * geht deshalb zuletzt und nie gleichzeitig mit einem anderen CLI-Lauf.
 */
const SORTIERER_AB_STUNDE = Number(process.env.SORTIERER_STUNDE ?? ENTWUERFE_AB_STUNDE + 2)

async function maybeSortierer() {
  try {
    if (!SNAPSHOT_ENABLED) return
    const jetzt = new Date()
    const wochentag = jetzt.getDay()
    if (wochentag === 0 || wochentag === 6) return
    if (jetzt.getHours() < SORTIERER_AB_STUNDE) return
    const heute = nowStamp().slice(0, 10)
    if (!(await routineFaellig('linkedin-sortierer', heute))) return
    if (!(await warteAufRechner('linkedin-sortierer'))) return
    // Erst das Postfach: Ein Urteil gilt dauerhaft, also soll es auf dem
    // vollständigen Verlauf beruhen und nicht auf dem Stand von gestern.
    if (!(await postfachFrisch())) {
      console.log('[runner] sortierer wartet — Postfach ist noch nicht frisch gesynct')
      void maybePostfachSync()
      return
    }

    const { threads } = await holeSortierThreads({
      supabaseUrl: SUPABASE_URL,
      headers: supabaseHeaders(),
      brandSlug: process.env.LINKEDIN_BRAND_SLUG ?? 'herrmann',
    })
    if (!threads.length) return

    const gebaut = baueSortierInput(threads)
    if (!gebaut.input.threads.length) return

    console.log(
      `[runner] sortierer startet — ${gebaut.input.threads.length} Threads ohne Urteil` +
        (gebaut.weitereWarten ? ` (+${gebaut.weitereWarten} warten auf den nächsten Lauf)` : ''),
    )
    await startRun('linkedin-sortierer', gebaut.input)
  } catch (e) {
    console.error('[runner] sortierer übersprungen:', e?.message ?? e)
  }
}

/**
 * Das Postfach als Routine (18.08.2026) — die Lücke, die alles davor entwertet.
 *
 * **Der Fehler, den das behebt.** Am 18.08. um 12:20 stand in der Datenbank als
 * jüngster Postfach-Stempel der **17.08., 13:52** — zweiundzwanzig Stunden alt.
 * Grund: `syncThreads` wurde an genau zwei Stellen gerufen, und beide sind
 * HTTP-Endpunkte. Es gab **keine Routine**. Morgenbrief, Antwort-Entwürfe,
 * Netzwerk und Wächter liefen von selbst — ausgerechnet die Quelle, aus der
 * Antworten, Entwürfe und Follow-up-Stufen stammen, lief nur auf Knopfdruck.
 *
 * Der Wächter schwieg dazu, weil sein Schwellwert bei 48 Stunden liegt: Ein
 * Postfach von gestern Mittag ist ihm noch frisch genug. Für den Agenten, der
 * um 6:00 Antwort-Entwürfe schreibt, ist es das nicht.
 *
 * Zwei Stunden Takt, 6 bis 20 Uhr, auch am Wochenende: Antworten kommen nicht
 * nur werktags, und ein Lauf kostet rund 45 Sekunden.
 */
const POSTFACH_AB_STUNDE = Number(process.env.POSTFACH_STUNDE ?? 6)
const POSTFACH_BIS_STUNDE = Number(process.env.POSTFACH_BIS_STUNDE ?? 20)
const POSTFACH_ABSTAND_MS = Number(process.env.POSTFACH_ABSTAND_MS ?? 2 * 60 * 60 * 1000)
/**
 * Auf Platte, nicht im Prozess (20.08.): Als Modul-Variable war der Zwei-
 * Stunden-Takt wirkungslos — nach jedem Runner-Neustart (Schlaf/Wach, laut Log
 * 171 Starts) sprang der Sync sofort wieder an, riss den Sync-Chrome per
 * `Page.bringToFront` nach vorn und lud LinkedIn. Kevin sah das als "staendlich
 * geht Chrome auf".
 */
let letzterPostfachSync = markeLies('letzter-postfach-sync')
/**
 * Der Tiefenscan läuft wöchentlich — seit 20.08. mit Marke auf Platte.
 *
 * Vorher hing er am Prozess-Start, was bei einem einmal täglich startenden
 * Runner stimmt, bei einem, der nach jedem Aufwachen neu startet, aber nicht:
 * Jeder Neustart blätterte das ganze Postfach neu durch (239 Threads, sichtbar
 * im Sync-Chrome). Die Lücke, die er schließt, bleibt geschlossen — er läuft
 * weiter, nur wieder wirklich wöchentlich.
 */
const TIEFENSCAN_ABSTAND_MS = Number(process.env.TIEFENSCAN_ABSTAND_MS ?? 7 * 24 * 60 * 60 * 1000)
let letzterTiefenscan = markeLies('letzter-tiefenscan')

async function maybePostfachSync() {
  try {
    const stunde = new Date().getHours()
    if (stunde < POSTFACH_AB_STUNDE || stunde >= POSTFACH_BIS_STUNDE) return
    if (Date.now() - letzterPostfachSync < POSTFACH_ABSTAND_MS) return
    if (linkedinSyncRunning) return
    // Braucht den Sync-Chrome — dieselbe Vorprüfung wie jede andere Routine.
    if (!(await warteAufRechner('postfach-sync', { brauchtChrome: true }))) return
    linkedinSyncRunning = true
    letzterPostfachSync = Date.now()
    markeSchreib('letzter-postfach-sync', letzterPostfachSync)
    try {
      // Einmal pro Woche weit zurückblättern statt nur 30 Tage. Grund steht in
      // sync.mjs: ein reines Vorwärtsfenster holt Threads, die es einmal
      // verpasst hat, NIE mehr ein — am 18.08. fehlten so 39 Stück, und Leads
      // galten als unbeschrieben, obwohl der Chat seit Monaten lief.
      const tief = Date.now() - letzterTiefenscan > TIEFENSCAN_ABSTAND_MS
      const synced = await syncThreads(tief ? { scanTage: TIEFENSCAN_TAGE } : {})
      const result = await upsertThreads(synced.threads, {})
      if (tief) {
        letzterTiefenscan = Date.now()
        markeSchreib('letzter-tiefenscan', letzterTiefenscan)
      }
      console.log(
        `[runner] postfach-sync${tief ? ' (Tiefenscan)' : ''}: ${result.geschrieben ?? synced.threads.length} Threads` +
          (result.inserted ? ` · ${result.inserted} neu` : '') +
          (synced.partial ? ' · TEILWEISE (Lauf brach ab)' : ''),
      )
    } finally {
      linkedinSyncRunning = false
    }
  } catch (e) {
    console.error('[runner] postfach-sync übersprungen:', e?.message ?? e)
  }
}

/**
 * Wie frisch ist das Postfach? (18.08.2026)
 *
 * Der Antwort-Entwürfe-Agent liest `linkedin_threads`. Läuft er auf einem
 * Postfach von gestern, schreibt er Entwürfe für Leads, die vielleicht längst
 * geantwortet haben — und übersieht die, die es heute Nacht taten. Deshalb
 * wartet er, bis der Postfach-Sync heute einmal durch war, statt blind zu
 * starten.
 */
async function postfachFrisch() {
  if (!SNAPSHOT_ENABLED) return true // ohne DB keine Aussage — dann nicht blockieren
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/linkedin_threads?select=last_synced_at&order=last_synced_at.desc&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    )
    if (!res.ok) return true
    const rows = await res.json()
    const stempel = Date.parse(rows[0]?.last_synced_at ?? '')
    if (!Number.isFinite(stempel)) return true
    // Sechs Stunden: großzügig genug, dass ein Sync um 6:00 den Lauf um 6:05
    // trägt, streng genug, dass „gestern Mittag" nicht durchgeht.
    return Date.now() - stempel < 6 * 60 * 60 * 1000
  } catch {
    return true
  }
}

/** Dream-Check (REBUILD-PLAN §8): beim Start, max. 1x pro Kalendertag. */
/** Was die Oberfläche über den Netzwerk-Sync wissen muss. */
function netzwerkStand() {
  return { laeuft: netzwerkSync.laeuft, seit: netzwerkSync.seit, letztes: netzwerkSync.letztes }
}

/**
 * Beide Netzwerk-Listen lesen und wegschreiben.
 *
 * Läuft im Hintergrund (der Aufrufer wartet nicht) und hinterlässt sein
 * Ergebnis in `netzwerkSync.letztes`. Einladungen zuerst: sie sind die längere
 * Liste und die, an der die InMail-Welle hängt.
 *
 * **Ein Teil-Ergebnis wird geschrieben, nicht verworfen.** Bricht die zweite
 * Liste ab, ist die erste trotzdem aktuell — und `vollstaendig` sagt ohnehin,
 * worauf man sich verlassen darf.
 */
/**
 * Wie weit wird geblättert? (17.08.2026)
 *
 * Im Alltag kurz: Beide Listen sind nach Datum sortiert, das Neue steht oben —
 * zehn Runden reichen für rund hundert Einträge und damit für ein Vielfaches
 * dessen, was an einem Tag dazukommt (17.08.: sieben neue Kontakte). Der volle
 * Durchlauf über 1.600 Einträge dauert sieben Minuten und bewegt sich durch
 * Kevins Konto — das ist nichts, was mehrmals täglich laufen sollte.
 *
 * Einmal in der Woche trotzdem ganz durch: Nur ein vollständiger Lauf darf
 * schließen, dass jemand aus einer Liste VERSCHWUNDEN ist (`upsertNetzwerk`
 * hängt genau daran), und nur er schreibt die Gesamtzahl fort, an der der
 * Widerspruchs-Wächter die Erntelücke misst. Bei einem kurzen Lauf bleibt beides
 * unangetastet — er kann also nichts kaputt machen, nur ergänzen.
 */
const NETZWERK_RUNDEN_KURZ = 10

async function starteNetzwerkSync({ kurz = false } = {}) {
  if (netzwerkSync.laeuft) return netzwerkStand()
  netzwerkSync = { laeuft: true, seit: new Date().toISOString(), letztes: netzwerkSync.letztes }
  const teile = []
  try {
    // Der Lock gilt prozessübergreifend: ein Handlauf im Terminal und die
    // Tages-Routine hier würden sich sonst dieselben Chrome-Tabs streitig
    // machen (am 12.08. gemessen: beide Läufe endeten unvollständig).
    const ergebnis = await mitNetzwerkLock(async () => {
      for (const welche of ['einladungen', 'kontakte']) {
        const gelesen = await leseListe(welche, {
          log: (...a) => console.log(...a),
          ...(kurz ? { maxRunden: NETZWERK_RUNDEN_KURZ } : {}),
        })
        if (gelesen.loginWall) {
          teile.push({ seite: welche, fehler: 'Login-Wall — im Sync-Chrome bei LinkedIn anmelden' })
          break
        }
        teile.push(await upsertNetzwerk(gelesen))
        console.log(
          `[runner] netzwerk-sync ${welche}: ${gelesen.eintraege.length}/${gelesen.gesamt}` +
            ` · vollständig: ${gelesen.vollstaendig ? 'ja' : 'nein'}`,
        )
      }
      return null
    })
    if (ergebnis?.blockiert) {
      console.log('[runner] netzwerk-sync übersprungen — ein anderer Lauf hält den Lock')
      netzwerkSync.letztes = { fertig: new Date().toISOString(), teile: [], blockiert: true }
      return netzwerkStand()
    }
    netzwerkSync.letztes = { fertig: new Date().toISOString(), teile }
  } catch (e) {
    console.error('[runner] netzwerk-sync fehlgeschlagen:', e?.message ?? e)
    netzwerkSync.letztes = { fertig: new Date().toISOString(), teile, fehler: e?.message ?? String(e) }
  } finally {
    netzwerkSync.laeuft = false
    netzwerkSync.seit = null
  }
  return netzwerkStand()
}

/**
 * Der Netzwerk-Sync als Tages-Routine (12.08.2026).
 *
 * Bewusst NICHT huckepack am Postfach-Sync: der läuft eine Minute und wird oft
 * gerufen, dieser fünf. Einmal am Tag genügt vollkommen — Einladungen und
 * Annahmen sind Tagesgeschäft, keine Minutenzahlen. Damit muss Kevin an den
 * Knopf nur, wenn er es genauer wissen will.
 *
 * Kein Vault-Run, also auch kein `routineFaellig`: das Gedächtnis ist die
 * Uhrzeit des letzten erfolgreichen Laufs in diesem Prozess plus der Stempel in
 * der Tabelle. Nach einem Runner-Neustart läuft er einmal zusätzlich — das ist
 * billiger als eine eigene Buchführung.
 */
const NETZWERK_AB_STUNDE = Number(process.env.NETZWERK_SYNC_STUNDE ?? 7)
let netzwerkTagesStempel = null

/**
 * Lief heute schon ein vollständiger Netzwerk-Lauf? (17.08.2026)
 *
 * Die Antwort steht in `linkedin_netzwerk_meta` und überlebt damit einen
 * Runner-Neustart — die Prozessvariable tut das nicht. Genau daran hing ein
 * teurer Fehler: Am Morgen des 17.08. startete der Runner wegen abgelaufener
 * Anmeldung immer wieder neu, und JEDER Start schickte einen siebenminütigen
 * Durchlauf durch Kevins LinkedIn — um 07:02, 07:04, 07:05 und 07:07. Das ist
 * nicht nur Zeit, das ist ein Muster, für das LinkedIn Konten sperrt.
 */
async function netzwerkHeuteSchonDurch(heute) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/runner_snapshots?key=eq.linkedin_netzwerk_meta&select=data&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    )
    if (!res.ok) return false
    const rows = await res.json()
    const data = rows[0]?.data ?? {}
    // Zwei Wege zählen: ein vollständiger Lauf (schreibt `vollAt` je Liste)
    // oder ein kurzer (schreibt `letzterLaufAt`). Sonst liefe nach jedem
    // Neustart wenigstens der kurze Lauf erneut durch Kevins Konto.
    if (String(data.letzterLaufAt ?? '').slice(0, 10) === heute) return true
    return ['kontakte', 'einladungen'].every((s) => String(data[s]?.vollAt ?? '').slice(0, 10) === heute)
  } catch {
    // Im Zweifel NICHT überspringen: ein ausgelassener Lauf ist harmloser als
    // veraltete Zahlen — aber ein Lauf zu viel wäre hier der teurere Fehler,
    // deshalb entscheidet unten zusätzlich der gesetzte Tagesstempel.
    return false
  }
}

/**
 * Den Zeitpunkt des letzten Laufs festhalten — auch für kurze Läufe.
 *
 * Landet neben den Vollständigkeits-Stempeln in `linkedin_netzwerk_meta`, damit
 * es eine einzige Stelle bleibt, an der steht, wann dieser Sync zuletzt an
 * Kevins Konto war.
 */
async function merkeNetzwerkLauf(stempel) {
  try {
    const kopf = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    }
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/runner_snapshots?key=eq.linkedin_netzwerk_meta&select=data&limit=1`,
      { headers: kopf },
    )
    const rows = res.ok ? await res.json() : []
    const data = { ...(rows[0]?.data ?? {}), letzterLaufAt: stempel }
    await fetch(`${SUPABASE_URL}/rest/v1/runner_snapshots`, {
      method: 'POST',
      headers: { ...kopf, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'linkedin_netzwerk_meta', data, updated_at: stempel }),
    })
  } catch (e) {
    console.error('[runner] netzwerk-Lauf nicht vermerkt:', e?.message ?? e)
  }
}

async function maybeNetzwerkSync() {
  try {
    const jetzt = new Date()
    if (jetzt.getHours() < NETZWERK_AB_STUNDE) return
    const heute = nowStamp().slice(0, 10)
    if (netzwerkTagesStempel === heute) return
    // Frisch gestartet: erst in der Datenbank nachsehen, statt blind loszulaufen.
    if (netzwerkTagesStempel === null && (await netzwerkHeuteSchonDurch(heute))) {
      netzwerkTagesStempel = heute
      console.log('[runner] netzwerk-sync übersprungen — heute bereits vollständig gelaufen')
      return
    }
    if (netzwerkSync.laeuft) return
    if (!SNAPSHOT_ENABLED) return // ohne service_role kein Schreibweg
    // Dieser Lauf geht durch den Sync-Chrome — ohne ihn nicht anfangen (18.08.).
    // Der Tagesstempel darf erst danach fallen, sonst gilt ein Lauf als erledigt,
    // den es nie gab.
    if (!(await warteAufRechner('netzwerk-sync', { brauchtChrome: true }))) return
    netzwerkTagesStempel = heute
    // Sonntag ist der volle Durchlauf, an allen anderen Tagen nur die Spitze
    // der Listen — das Neue steht dort ohnehin oben.
    const kurz = jetzt.getDay() !== 0
    console.log(`[runner] netzwerk-sync startet (${kurz ? 'kurz, nur die neuesten' : 'voller Durchlauf'})…`)
    await starteNetzwerkSync({ kurz })
    await merkeNetzwerkLauf(new Date().toISOString())
  } catch (e) {
    console.error('[runner] netzwerk-sync übersprungen:', e?.message ?? e)
  }
}

/**
 * Die Lead-Pflege als laufende Routine (20.08.2026, Migration 0076).
 *
 * `scripts/leads-sync.ts` legt fehlende Leads an, verheiratet die Spiegel und
 * schreibt neue Ereignisse fort. Ohne diesen Takt hätte das Lead-System einen
 * Backfill-Stand von heute und würde ab morgen auseinanderlaufen: jede neue
 * Einladung, jeder neue Thread stünde ohne Lead da.
 *
 * Läuft VOR dem Widerspruchs-Wächter, nicht danach — die Routine verbucht
 * Erstnachrichten, die ein Thread beweist, und der Wächter soll das Ergebnis
 * sehen statt den alten Stand zu melden.
 *
 * Der Umweg über einen Kindprozess ist Absicht: Die Identitäts-Regeln liegen
 * in TypeScript, weil die Oberfläche sie fürs Handverbinden ebenfalls braucht.
 * Eine zweite Fassung in .mjs wäre eine zweite Wahrheit — teurer als ein
 * Prozessstart alle 30 Minuten.
 */
let letzterLeadsLauf = 0
const LEADS_ABSTAND_MS = 30 * 60 * 1000

async function maybeLeadsSync() {
  try {
    if (!SNAPSHOT_ENABLED) return // ohne service_role kein Schreibweg
    if (Date.now() - letzterLeadsLauf < LEADS_ABSTAND_MS) return
    letzterLeadsLauf = Date.now()
    // `fileURLToPath`, nicht `.pathname`: Der Repo-Pfad enthält ein Leerzeichen
    // („Kevin OS"), und `.pathname` liefert es prozentkodiert zurück. spawn
    // sucht dann wörtlich nach „Kevin%20OS" und scheitert mit ENOENT —
    // genau so im Runner-Log vom 20.08., 14:42 zu sehen.
    const wurzel = fileURLToPath(new URL('..', import.meta.url))
    await new Promise((fertig) => {
      // Nicht das tsx-Binary direkt: dessen Shebang ist `#!/usr/bin/env node`,
      // und der LaunchAgent hat kein node im PATH (nvm) — im Log vom 20.08.,
      // 14:54 als „env: node: No such file or directory". `process.execPath`
      // ist der node, mit dem dieser Runner gerade selbst läuft.
      const proc = spawn(process.execPath, [join(wurzel, 'node_modules/tsx/dist/cli.mjs'), 'scripts/leads-sync.ts'], {
        cwd: wurzel,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let letzte = ''
      proc.stdout.on('data', (d) => {
        const text = String(d).trim()
        if (text) letzte = text.split('\n').pop() ?? letzte
      })
      proc.stderr.on('data', (d) => console.error('[runner] leads-sync:', String(d).trim().slice(0, 300)))
      proc.on('error', (e) => {
        console.error('[runner] leads-sync nicht startbar:', e?.message ?? e)
        fertig()
      })
      proc.on('close', (code) => {
        if (code === 0) console.log(`[runner] leads-sync durch (${letzte})`)
        else console.error(`[runner] leads-sync endete mit Code ${code}`)
        fertig()
      })
    })
  } catch (e) {
    console.error('[runner] leads-sync übersprungen:', e?.message ?? e)
  }
}

/**
 * Der Widerspruchs-Wächter als laufende Routine (17.08.2026).
 *
 * Er braucht kein Chrome und keine Uhrzeit-Schwelle: Er liest nur, was in der
 * Datenbank steht, und ist in Sekunden durch. Genau deshalb darf er oft laufen
 * — der Fehler, für den es ihn gibt, entsteht nicht nachts um drei, sondern
 * immer dann, wenn eine Nachricht vom Handy rausgeht und der Haken im Cockpit
 * ausbleibt.
 */
let letzterWaechterLauf = 0
const WAECHTER_ABSTAND_MS = 15 * 60 * 1000

async function maybeWaechter() {
  try {
    if (!SNAPSHOT_ENABLED) return // ohne service_role kein Schreibweg
    if (Date.now() - letzterWaechterLauf < WAECHTER_ABSTAND_MS) return
    letzterWaechterLauf = Date.now()
    const { ladeUndPruefe, schreibeBefund } = await import('./widersprueche.mjs')
    const ergebnis = await ladeUndPruefe()
    // 18.08.: Eine geschlossene Schleuse gehört ganz nach vorn. Sie ist der
    // Grund, warum in der Agenten-Liste NICHTS steht — und „nichts" ist der
    // Zustand, den man am leichtesten übersieht. Der Weg über den Wächter
    // spart eine eigene Cockpit-Anzeige: Das Band auf dem Homescreen zeigt
    // Befunde schon an.
    const tor = schleuseLetztes()
    if (tor && !tor.offen) {
      ergebnis.befunde.unshift({
        schluessel: 'schleuse_zu',
        schwere: 'hoch',
        text: `Agenten angehalten — ${tor.grund}`,
        zahl: -1,
        tun: tor.hinweis || 'Runner-Log ansehen',
      })
      ergebnis.anzahl = ergebnis.befunde.length
      ergebnis.hoch = ergebnis.befunde.filter((b) => b.schwere === 'hoch').length
    }
    await schreibeBefund(ergebnis)
    if (ergebnis.anzahl > 0) {
      console.log(`[runner] wächter: ${ergebnis.anzahl} Widersprüche (${ergebnis.hoch} dringend)`)
    }
  } catch (e) {
    console.error('[runner] wächter übersprungen:', e?.message ?? e)
  }
}

async function maybeDream() {
  try {
    const today = nowStamp().slice(0, 10)
    if (!(await routineFaellig('dream-check', today))) return
    // Auch dieser Lauf geht durch die CLI und hat am 18.08. dieselbe Falle
    // vor sich: Er startet fünf Sekunden nach dem Runner, und der startet oft
    // genau dann, wenn der Mac gerade eben erst aufgewacht ist.
    if (!(await warteAufRechner('dream-check'))) return

    const names = await readdir(RUNS_DIR)
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

  // Die Uhr, an der die Routinen ablesen, ob der Mac wach ist (18.08.). Muss
  // vor ihnen laufen und feiner ticken als sie: Ein DarkWake von einer Minute
  // darf nicht zwischen zwei Fünf-Minuten-Ticks unsichtbar bleiben.
  wachTick()
  const wt = setInterval(wachTick, WACH_TICK_MS)
  wt.unref?.()

  // Morgenbrief: kurz nach dem Start prüfen (Mac gerade aufgeklappt) und dann
  // alle 5 Minuten — so kommt er auch, wenn der Rechner erst um 9 angeht.
  setTimeout(() => void maybeMorgenbrief(), 10_000)
  const mb = setInterval(() => void maybeMorgenbrief(), MORGENBRIEF_CHECK_MS)
  mb.unref?.()

  // Das Postfach zuerst: Es ist die Quelle, aus der die Entwürfe gebaut werden.
  setTimeout(() => void maybePostfachSync(), 15_000)
  const pf = setInterval(() => void maybePostfachSync(), MORGENBRIEF_CHECK_MS)
  pf.unref?.()

  // Antwort-Entwürfe im selben Takt, aber eine Stunde früher als der Morgenbrief:
  // beim Aufklappen des Macs prüfen und dann alle 5 Minuten.
  setTimeout(() => void maybeAntwortEntwuerfe(), 20_000)
  const ae = setInterval(() => void maybeAntwortEntwuerfe(), MORGENBRIEF_CHECK_MS)
  ae.unref?.()

  // Der Sortierer im selben Takt, zwei Stunden später. Versetzter Start (50 statt
  // 20 Sekunden), damit auf 8 GB nie zwei CLI-Läufe gleichzeitig hochfahren.
  setTimeout(() => void maybeSortierer(), 50_000)
  const so = setInterval(() => void maybeSortierer(), MORGENBRIEF_CHECK_MS)
  so.unref?.()

  // Netzwerk-Sync einmal täglich — NUR über den regulären Tick. Ein Lauf kurz
  // nach dem Start wäre bei jedem Runner-Neustart ein neuer Fünf-Minuten-Lauf
  // über Kevins LinkedIn; der erste Tick in fünf Minuten reicht vollkommen.
  const nw = setInterval(() => void maybeNetzwerkSync(), MORGENBRIEF_CHECK_MS)
  nw.unref?.()

  // Lead-Pflege vor dem Wächter: sie verbucht, was ein Thread beweist, damit
  // der Wächter nicht den Stand von vorgestern meldet.
  setTimeout(() => void maybeLeadsSync(), 25_000)
  const ls = setInterval(() => void maybeLeadsSync(), MORGENBRIEF_CHECK_MS)
  ls.unref?.()

  // Der Widerspruchs-Wächter: kurz nach dem Start einmal, danach im 15-Minuten-
  // Takt (er selbst bremst über `WAECHTER_ABSTAND_MS`). Reines Lesen der
  // Datenbank — kein Chrome, kein Vault, kein Modell.
  setTimeout(() => void maybeWaechter(), 30_000)
  const wa = setInterval(() => void maybeWaechter(), MORGENBRIEF_CHECK_MS)
  wa.unref?.()

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
