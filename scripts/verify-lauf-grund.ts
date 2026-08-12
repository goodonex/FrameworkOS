/**
 * Drift-Wache für die Abbruchgründe (12.08.2026).
 *
 * Die Gründe entscheiden, ob Kevin morgens handeln muss oder weiterarbeiten
 * kann. Eine falsche Einordnung ist teurer als gar keine: „erledigt sich von
 * selbst" bei einer abgelaufenen Anmeldung hiesse, dass die Agenten wieder
 * tagelang stillstehen, während die Oberfläche Entwarnung gibt.
 *
 * Geprüft wird gegen **echte Mitschriften** aus dem Vault-Runordner, nicht nur
 * gegen erfundene Zeichenketten.
 *
 * Start: npx tsx scripts/verify-lauf-grund.ts
 */
import { grundKurz, laufGrund } from '../runner/laufGrund.mjs'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

// --- 1. Der Fall, der die Runde ausgelöst hat ---------------------------
// Wortgleich aus 2026-08-12-080020-morgenbrief.md.
const ECHT_ANMELDUNG = `# Run fehlgeschlagen (Exit 1)

**Mitschrift bis zum Abbruch** — 3 Ereignisse · 0 Werkzeug-Aufrufe

\`\`\`
[+00:02] Sitzung gestartet · 27 Werkzeuge · /Users/kevinherrmann/Second Brain
[+00:02] Text (72 Z.) · Failed to authenticate: OAuth session expired and could not…
[+00:02] Fertig (success) · 0.3s · 1 Züge · $0.0000
\`\`\``

const anmeldung = laufGrund(ECHT_ANMELDUNG)
check('die echte Mitschrift vom 12.08. wird erkannt', anmeldung?.schluessel === 'anmeldung')
check('sie heisst „Anmeldung abgelaufen"', anmeldung?.kurz === 'Anmeldung abgelaufen')
check(
  'sie verlangt Handeln — das ist der Kern',
  anmeldung?.handeln === true,
  'Ohne dieses Flag stünde der Ausfall wieder tagelang unbemerkt da.',
)
check('sie sagt, was zu tun ist', /claude/.test(anmeldung?.hinweis ?? ''))

// --- 2. Der zweite echte Fall: Zeitlimit -------------------------------
// Wortgleich aus 2026-08-12-072719-linkedin-antwort-entwuerfe.md.
const ECHT_ZEITLIMIT = `# Run abgebrochen (Exit 143 — Zeitlimit 10 Minuten)

**Mitschrift bis zum Abbruch** — 3 Ereignisse · 0 Werkzeug-Aufrufe`

const zeitlimit = laufGrund(ECHT_ZEITLIMIT)
check('das echte Zeitlimit wird erkannt', zeitlimit?.schluessel === 'zeitlimit')
check('die Dauer steht in der Meldung', zeitlimit?.kurz === 'Zeitlimit erreicht (10 Min.)')
check('ein Zeitlimit verlangt kein Handeln', zeitlimit?.handeln === false)

// --- 3. Reihenfolge ist Bedeutung --------------------------------------
check(
  'hängt der Agent wegen der Anmeldung ins Zeitlimit, gewinnt die Anmeldung',
  laufGrund('# Run abgebrochen (Exit 143 — Zeitlimit 10 Minuten)\nOAuth session expired')?.schluessel ===
    'anmeldung',
  'Sonst behandelt man den Schatten statt der Ursache.',
)

// --- 4. Die übrigen Muster ---------------------------------------------
for (const [text, erwartet, handeln] of [
  ['Error: rate limit exceeded', 'kontingent', false],
  ['usage limit reached for this month', 'kontingent', false],
  ['fetch failed', 'netz', false],
  ['getaddrinfo ENOTFOUND api.anthropic.com', 'netz', false],
  ['Invalid API key · please check', 'anmeldung', true],
  ['You are not logged in', 'anmeldung', true],
] as const) {
  const g = laufGrund(text)
  check(`„${text.slice(0, 34)}…" → ${erwartet}`, g?.schluessel === erwartet, `Ist: ${g?.schluessel ?? 'null'}`)
  check(`„${erwartet}" verlangt Handeln: ${handeln}`, g?.handeln === handeln)
}

// --- 5. Unbekanntes wird nicht erfunden --------------------------------
const unbekannt = laufGrund('# Run fehlgeschlagen (Exit 7)\n\nirgendwas ging schief')
check('ein unbekannter Abbruch nennt den nackten Code', unbekannt?.kurz === 'Abbruch (Code 7)')
check(
  'und behauptet keinen Handlungsbedarf',
  unbekannt?.handeln === false,
  'Eine erfundene Dringlichkeit ist schlimmer als keine.',
)
check('ein erfolgreicher Lauf hat keinen Grund', laufGrund('# Run fertig\n\nalles gut') === null)
check('Exit 0 ist kein Grund', laufGrund('# Run fertig (Exit 0)') === null)

// --- 6. Robustheit -----------------------------------------------------
for (const [was, wert] of [
  ['leer', ''],
  ['nur Leerzeichen', '   \n  '],
  ['null', null],
  ['undefined', undefined],
  ['Zahl', 42],
  ['Objekt', {}],
] as const) {
  check(`${was} bricht die Erkennung nicht`, laufGrund(wert as unknown as string) === null)
}

// --- 7. Die Kurzfassung für die Liste ----------------------------------
check('grundKurz nennt den Grund', grundKurz(ECHT_ANMELDUNG) === 'Anmeldung abgelaufen')
check('ohne Grund bleibt der Ersatz stehen', grundKurz('# Run fertig', 'Fehler') === 'Fehler')
check('der Ersatz ist frei wählbar', grundKurz('', 'FEHLER') === 'FEHLER')

console.log(`\nverify-lauf-grund: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
