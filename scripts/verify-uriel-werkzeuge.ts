/**
 * Drift-Wache für Uriels Werkzeugkasten (11.08.2026).
 *
 * Die Definitionen stehen in `lib/urielTools.ts`, die Ausführung im
 * `UrielDock`. Zwei Dateien, eine Wahrheit — und genau dazwischen entsteht der
 * unangenehmste Fehler: ein Werkzeug, das Uriel angeboten bekommt, aber nicht
 * ausführen kann. Es ruft es dann auf, bekommt „Unbekanntes Werkzeug" zurück
 * und erzählt dem Nutzer irgendetwas.
 *
 * Der Anlass war die Gegenrichtung: Uriel hatte für das LinkedIn-Postfach GAR
 * KEIN Werkzeug und behauptete deshalb, das Cockpit kenne nur handgetippte
 * Zahlen — obwohl der Voyager-Sync das Postfach spiegelt. Ein Werkzeug, das
 * fehlt, merkt man erst an einer falschen Antwort.
 *
 * Start: npx tsx scripts/verify-uriel-werkzeuge.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { URIEL_TOOLS } from '../app/src/cockpit/lib/urielTools'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const dock = readFileSync(join(wurzel, 'app/src/cockpit/components/UrielDock.tsx'), 'utf8')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

// --- 1. Jedes angebotene Werkzeug ist auch ausführbar --------------------
for (const t of URIEL_TOOLS) {
  check(
    `${t.name} hat einen Zweig im Executor`,
    dock.includes(`case '${t.name}':`),
    'Uriel bekäme das Werkzeug angeboten und liefe beim Aufruf in „Unbekanntes Werkzeug".',
  )
  check(`${t.name} hat eine Beschreibung`, t.description.trim().length > 20)
  check(`${t.name} hat ein Objekt-Schema`, t.input_schema.type === 'object')
  for (const pflicht of t.input_schema.required ?? []) {
    check(
      `${t.name}: Pflichtfeld ${pflicht} ist im Schema beschrieben`,
      Object.prototype.hasOwnProperty.call(t.input_schema.properties, pflicht),
    )
  }
}

// --- 2. Kein Executor-Zweig ohne Definition -----------------------------
const zweige = [...dock.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1])
const bekannt = new Set(URIEL_TOOLS.map((t) => t.name))
for (const z of zweige) {
  check(
    `Executor-Zweig ${z} hat eine Werkzeug-Definition`,
    bekannt.has(z),
    'Toter Code — Uriel kann dieses Werkzeug nie aufrufen, weil es ihm nie angeboten wird.',
  )
}

check('keine doppelten Werkzeugnamen', new Set([...bekannt]).size === URIEL_TOOLS.length)

// --- 3. Das LinkedIn-Werkzeug nennt seine Grenze ------------------------
/**
 * Der eigentliche Fehler war nicht die fehlende Zahl, sondern die
 * selbstbewusste Erklärung dazu. Ein Werkzeug, das nicht sagt, was es NICHT
 * weiss, lädt genau das wieder ein.
 */
const postfach = URIEL_TOOLS.find((t) => t.name === 'get_linkedin_postfach')
check('es gibt ein Werkzeug für das LinkedIn-Postfach', Boolean(postfach))
check(
  'das Postfach-Werkzeug nennt seine Grenze (angenommene Anfragen)',
  /nicht|NICHT/.test(postfach?.description ?? '') && /Vernetzungsanfrage/.test(postfach?.description ?? ''),
)
check(
  'der Executor liefert die Grenze mit den Daten aus',
  dock.includes('nicht_enthalten'),
  'Sonst steht sie nur im Schema und fällt aus der Antwort heraus.',
)

/**
 * Der zweite, teurere Irrtum: Uriel bekam die Eimer-NAMEN ohne ihre Bedeutung
 * und hat sich `faellig` als „noch keine Erstnachricht geschrieben" ausgedacht.
 * Tatsaechlich liegt dort nur, wo Kevin BEREITS geschrieben hat. Wer danach
 * handelt, schickt 61 zweite „erste" Nachrichten.
 */
const beschreibung = postfach?.description ?? ''
for (const eimer of ['faellig', 'du_bist_dran', 'wartet', 'verwaist', 'abschluss', 'pruefen', 'ruht']) {
  check(
    `die Beschreibung erklärt den Eimer ${eimer}`,
    // Bewusst `includes` statt einer zusammengebauten RegExp: die erste Fassung
    // stand als Template-Literal da, in dem `\s` zu einem simplen „s" zerfiel —
    // die Prüfung meldete drei Fehler, die es nicht gab.
    beschreibung.includes(`\`${eimer}\` =`),
    'Ein Eimer-Name ohne Bedeutung ist eine Einladung, sich eine auszudenken.',
  )
}
check(
  'die Beschreibung sagt, dass in faellig schon geschrieben wurde',
  /BEREITS geschrieben|bereits geschrieben/.test(postfach?.description ?? ''),
)
check(
  'die Beschreibung verweist für Erstnachrichten auf das richtige Feld',
  /erstnachrichten_offen/.test(postfach?.description ?? ''),
)
check(
  'der Executor liefert erstnachrichten_offen mit',
  /erstnachrichten_offen:/.test(dock),
  'Sonst muss Uriel die Zahl wieder aus einem Eimer herleiten — genau das ging schief.',
)
check(
  'erstnachrichten_offen zählt nur den Status offen',
  /erstnachrichten\.items\.filter\(\(e\) => e\.status === 'offen'\)/.test(dock),
)

// --- 4. Uriel liest das Postfach, schreibt es aber nicht ----------------
const linkedinZweig = dock.slice(dock.indexOf("case 'get_linkedin_postfach':"), dock.indexOf("case 'search_contacts':"))
check(
  'die LinkedIn-Werkzeuge schreiben nichts',
  !/markDone|snooze\(|wake\(|update|insert|upsert/.test(linkedinZweig),
  'Lesen ist der Auftrag. Schreiben gehört in die Oberfläche, wo Kevin es sieht.',
)

console.log(`\nverify-uriel-werkzeuge: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
