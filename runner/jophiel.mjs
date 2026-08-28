/**
 * Brücke zu Jophiel — dem Website-Generator, der neben Uriel läuft
 * (25.08.2026, Blaupause `docs/wargames/sales-canvas.md`, Zug 6).
 *
 * Jophiel baut die Demo-Seiten, die Kevin im Loom zeigt. Die Klammer zwischen
 * beiden Welten ist `project.json.leadName`: Dort steht, zu welchem Uriel-Lead
 * eine gebaute Seite gehört.
 *
 * **Warum das über den Runner geht und nicht direkt:** Das Cockpit läuft auf
 * einer HTTPS-Domain, sobald Kevin nicht am eigenen Rechner sitzt. Von dort
 * ist `127.0.0.1:4100` weder erreichbar noch erlaubt (`runnerBridge.ts`). Der
 * Runner ist der einzige Weg — und er spiegelt die Liste zusätzlich nach
 * Supabase, damit das Handy überhaupt etwas sieht.
 *
 * **Ein nicht laufender Nebendienst darf Kevins Sales-Seite nicht kaputt
 * machen.** Jophiel läuft nur, wenn Kevin ihn gestartet hat. Ist er aus,
 * antwortet diese Brücke mit einer leeren Liste und `jophielErreichbar: false`
 * — nie mit einem Fehler. Das Canvas zeigt dann eine stille Zeile.
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const JOPHIEL_ROOT = resolve(
  process.env.JOPHIEL_ROOT ?? join(homedir(), 'Kevin OS', '02 Projekte', 'jophiel'),
)

/** Wohin die verkleinerten Vorschaubilder kommen. Nicht in Jophiels Ordner. */
const THUMB_DIR = join(homedir(), 'Library', 'Caches', 'kevin-os', 'jophiel-thumbs')

/** Ohne `config.json` die Voreinstellung aus Jophiels eigener Datei (25.08.: 4100). */
const PORT_FALLBACK = 4100

/**
 * Welche Aufnahmen es gibt — Jophiels `config.json` kennt genau zwei Namen
 * (`screenshots`), dazu je eine `alt-`-Variante der ALTEN Seite und die
 * `-full`-Fassungen der ganzen Seite.
 *
 * `-full` fehlt hier mit Absicht: Das sind 3–6 MB pro Bild, und auf einer
 * Karte ist ohnehin nur der erste Bildschirm zu sehen. Wer die ganze Seite
 * will, öffnet die Vorschau.
 */
export const SHOT_NAMEN = ['desktop', 'mobile', 'alt-desktop', 'alt-mobile']

/**
 * Slug und Aufnahme aus der URL sind Fremdeingaben, und beide landen in einem
 * Dateipfad. Deshalb hier eine Positivliste statt einer Filterung: Der Slug
 * darf nur das enthalten, was Jophiels `slugify` erzeugt, und der Name muss
 * einer der vier bekannten sein. `..`, `/` und alles andere fällt damit
 * automatisch heraus, ohne dass es jemand einzeln verbieten muss.
 */
export function gueltigerSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 120
}

export function gueltigerShotName(name) {
  return SHOT_NAMEN.includes(name)
}

let portGemerkt = null

/** Der Port aus Jophiels `config.json`. Einmal gelesen, dann gemerkt. */
export async function jophielPort() {
  if (portGemerkt !== null) return portGemerkt
  try {
    const cfg = JSON.parse(await readFile(join(JOPHIEL_ROOT, 'config.json'), 'utf8'))
    const p = Number(cfg?.ports?.api)
    portGemerkt = Number.isInteger(p) && p > 0 && p < 65536 ? p : PORT_FALLBACK
  } catch {
    portGemerkt = PORT_FALLBACK
  }
  return portGemerkt
}

/** Liegt eine Aufnahme dieses Namens vor? */
async function hatAufnahme(slug, name) {
  try {
    await stat(join(JOPHIEL_ROOT, 'projects', slug, 'shots', `${name}.png`))
    return true
  } catch {
    return false
  }
}

/**
 * Wann wurde diese Aufnahme zuletzt geschrieben? `null`, wenn es sie nicht gibt.
 *
 * Der Spiegel (28.08.2026, `sales-canvas-v2.md` Zug 7) braucht die Zahl, um zu
 * erkennen, ob sich etwas geaendert hat — sonst laedt er zwoelf Bilder in
 * jedem Minutentakt erneut hoch.
 */
export async function shotStand(slug, name) {
  if (!gueltigerSlug(slug) || !gueltigerShotName(name)) return null
  try {
    return Math.round((await stat(join(JOPHIEL_ROOT, 'projects', slug, 'shots', `${name}.png`))).mtimeMs)
  } catch {
    return null
  }
}

/**
 * Die Projektliste, auf das Nötige eingedampft.
 *
 * `brief` bleibt draußen: Der ist mehrere Kilobyte lang pro Projekt (der ganze
 * Auftragstext an den Bau-Agenten) und hat auf einer Karte nichts verloren —
 * er würde nur den Supabase-Spiegel aufblähen.
 */
export async function jophielProjekte() {
  const port = await jophielPort()
  let roh
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/projects`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return { projekte: [], jophielErreichbar: false }
    roh = await res.json()
  } catch {
    // ECONNREFUSED, Zeitüberschreitung, kaputtes JSON — alles derselbe Fall:
    // Jophiel läuft gerade nicht. Kein Fehler, nur nichts zu zeigen.
    return { projekte: [], jophielErreichbar: false }
  }
  if (!Array.isArray(roh)) return { projekte: [], jophielErreichbar: false }

  const projekte = []
  for (const p of roh) {
    if (!gueltigerSlug(p?.slug)) continue
    projekte.push({
      slug: p.slug,
      name: String(p.name ?? ''),
      /** Die Klammer zu Uriel — welcher Lead gehört zu dieser Seite. */
      leadName: String(p.leadName ?? ''),
      status: String(p.status ?? ''),
      createdAt: String(p.createdAt ?? ''),
      note: String(p.note ?? ''),
      oldUrl: String(p.oldUrl ?? ''),
      /** Gibt es überhaupt etwas zu zeigen? Entscheidet über die Kartensorte. */
      hatShot: await hatAufnahme(p.slug, 'desktop'),
      hatAltShot: await hatAufnahme(p.slug, 'alt-desktop'),
      /** Slug-adressierbare Vorschau. Jophiels UI hat KEINEN Deep-Link (Z0). */
      vorschauUrl: `http://127.0.0.1:${port}/preview/${p.slug}`,
    })
  }
  return { projekte, jophielErreichbar: true }
}

/** `sips` verkleinern lassen — auf jedem Mac vorhanden, kein Paket nötig. */
function sips(args) {
  return new Promise((fertig) => {
    const p = spawn('/usr/bin/sips', args, { stdio: 'ignore' })
    p.on('error', () => fertig(false))
    p.on('close', (code) => fertig(code === 0))
  })
}

/**
 * Eine Aufnahme als Vorschaubild — verkleinert und zwischengespeichert.
 *
 * **Warum überhaupt verkleinert:** Die Originale im Bestand sind 1,0–4,5 MB
 * (am 25.08. nachgemessen). Ein Dutzend davon auf einer Seite macht Kevins
 * Sales-Ansicht bleischwer, und `loading="lazy"` verschiebt das Problem nur
 * bis zum ersten Scrollen. `sharp` ist in diesem Repo nicht zu haben — die
 * Zero-Dependency-Regel gilt —, aber `sips` liegt auf jedem Mac und ist ein
 * Prozessaufruf, kein Paket.
 *
 * Der Zeitstempel der Quelle steht im Dateinamen: Baut Jophiel die Seite neu,
 * entsteht automatisch ein neues Vorschaubild, ohne dass jemand einen
 * Zwischenspeicher leeren muss.
 *
 * @returns {{buf: Buffer, mime: string} | null}
 */
export async function jophielShot(slug, name) {
  if (!gueltigerSlug(slug) || !gueltigerShotName(name)) return null
  const quelle = join(JOPHIEL_ROOT, 'projects', slug, 'shots', `${name}.png`)
  let mtime
  try {
    mtime = Math.round((await stat(quelle)).mtimeMs)
  } catch {
    return null
  }

  const ziel = join(THUMB_DIR, `${slug}__${name}__${mtime}.jpg`)
  try {
    return { buf: await readFile(ziel), mime: 'image/jpeg' }
  } catch {
    /* noch nicht erzeugt */
  }

  await mkdir(THUMB_DIR, { recursive: true })
  // JPEG statt PNG: Ein Screenshot ist ein Foto einer Seite, kein Strichbild.
  // Bei 640 px Breite und Qualität 70 landet er unter 150 kB — verlustfreies
  // PNG derselben Breite läge beim Drei- bis Vierfachen.
  const ok = await sips(['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '-Z', '640', quelle, '--out', ziel])
  if (!ok) {
    // Lieber das Original als gar kein Bild — dann ist die Karte eben schwer.
    try {
      return { buf: await readFile(quelle), mime: 'image/png' }
    } catch {
      return null
    }
  }
  try {
    return { buf: await readFile(ziel), mime: 'image/jpeg' }
  } catch {
    return null
  }
}
