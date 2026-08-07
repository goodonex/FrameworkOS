/**
 * Verifikation für O17, Schritt 1 (docs/BACKLOG.md): die Mitschrift eines
 * Agenten-Laufs. Prüft `runner/agentStream.mjs` gegen echte Ereignis-Zeilen der
 * Claude-CLI (`--output-format stream-json --verbose`, Version 2.1.209).
 *
 * Zwei Dinge dürfen nie kaputtgehen:
 * 1. Der Endtext muss **unverändert** aus dem `result`-Ereignis kommen — die
 *    Freigaben-Queue liest den ```json-Block aus der Run-Datei.
 * 2. Ein abgebrochener Lauf muss ein lesbares Protokoll hinterlassen, nicht
 *    „kein Output".
 *
 * Start: npx tsx scripts/verify-agent-stream.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import {
  laufBilanz,
  neuerLauf,
  nimmBrocken,
  nimmZeile,
  protokollText,
  seitStart,
  werkzeugArgument,
} from '../runner/agentStream.mjs'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

const T0 = 1_000_000

// 1. Zeitstempel
check('1 Start', seitStart(0), '+00:00')
check('1b 9 Sekunden', seitStart(9_400), '+00:09')
check('1c 12 Minuten', seitStart(12 * 60_000 + 3_000), '+12:03')
check('1d über eine Stunde', seitStart(3 * 3600_000 + 4 * 60_000 + 5_000), '+3:04:05')
check('1e Unsinn wird 0', seitStart(NaN as unknown as number), '+00:00')
check('1f negativ wird 0', seitStart(-500), '+00:00')

// 2. Werkzeug-Argument: das Feld, an dem man den Aufruf wiedererkennt
check('2 Read', werkzeugArgument({ file_path: '/Users/k/Second Brain/x.md' }), '/Users/k/Second Brain/x.md')
check('2b Bash', werkzeugArgument({ command: 'ls -la' }), 'ls -la')
check('2c Priorität file_path vor command', werkzeugArgument({ command: 'x', file_path: '/a' }), '/a')
check('2d ohne bekanntes Feld', werkzeugArgument({ irgendwas: 1 }), '')
check('2e kein Objekt', werkzeugArgument(null), '')
check(
  '2f Whitespace normalisiert und gekürzt',
  werkzeugArgument({ command: 'a'.repeat(200) }).length,
  70,
)

// 3. Echte Ereignis-Zeilen (aus einem tatsächlichen Lauf, gekürzt)
const initEv = JSON.stringify({
  type: 'system',
  subtype: 'init',
  cwd: '/Users/k/Second Brain',
  session_id: 's1',
  tools: ['Read', 'Bash', 'Grep'],
})
const textEv = JSON.stringify({
  type: 'assistant',
  message: { model: 'claude-opus-4-8', content: [{ type: 'text', text: 'Guten Morgen, hier der Brief.' }] },
})
const denkEv = JSON.stringify({
  type: 'assistant',
  message: { content: [{ type: 'thinking', thinking: 'x'.repeat(4200) }] },
})
const toolEv = JSON.stringify({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '06 Daily Notes/2026-08-07.md' } }] },
})
const toolErgebnisEv = JSON.stringify({
  type: 'user',
  message: { content: [{ type: 'tool_result', content: 'Zeile eins\nZeile zwei' }] },
})
const toolFehlerEv = JSON.stringify({
  type: 'user',
  message: { content: [{ type: 'tool_result', is_error: true, content: 'File not found' }] },
})
const resultEv = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  duration_ms: 987_654,
  num_turns: 42,
  result: '# Morgen-Brief\n\n```json\n{"drafts":[]}\n```',
  total_cost_usd: 1.2345,
})

{
  const lauf = neuerLauf(T0)
  nimmZeile(lauf, initEv, T0 + 1_000)
  nimmZeile(lauf, toolEv, T0 + 12_000)
  nimmZeile(lauf, toolErgebnisEv, T0 + 13_000)
  nimmZeile(lauf, denkEv, T0 + 60_000)
  nimmZeile(lauf, textEv, T0 + 90_000)
  nimmZeile(lauf, resultEv, T0 + 120_000)

  check('3 sechs Protokollzeilen', lauf.zeilen.length, 6)
  check('3b Sitzung mit Werkzeug-Zahl', lauf.zeilen[0], '[+00:01] Sitzung gestartet · 3 Werkzeuge · /Users/k/Second Brain')
  check('3c Werkzeug mit Argument', lauf.zeilen[1], '[+00:12] → Read  06 Daily Notes/2026-08-07.md')
  check('3d Werkzeug-Ergebnis mit Länge', lauf.zeilen[2], '[+00:13] ↳ 21 Z.')
  check('3e Denken wird gezählt', lauf.zeilen[3], '[+01:00] Denkt (4200 Z.)')
  check('3f Endtext exakt aus result', lauf.ergebnis, '# Morgen-Brief\n\n```json\n{"drafts":[]}\n```')
  check('3g Kennzahlen', lauf.meta, {
    dauerMs: 987_654,
    zuege: 42,
    kostenUsd: 1.2345,
    fehler: false,
    subtype: 'success',
  })
  check('3h Bilanz', laufBilanz(lauf), {
    werkzeugAufrufe: 1,
    werkzeuge: [['Read', 1]],
    denkZeichen: 4200,
    ereignisse: 6,
    unlesbar: 0,
  })
}

// 4. Der Fall, um den es geht: Abbruch ohne result-Ereignis.
{
  const lauf = neuerLauf(T0)
  nimmZeile(lauf, initEv, T0 + 1_000)
  nimmZeile(lauf, toolEv, T0 + 200_000)
  const text = protokollText(lauf, { titel: 'Mitschrift bis zum Abbruch' })
  check('4 kein Ergebnis', lauf.ergebnis, null)
  check('4b Protokoll nennt den Titel', text.includes('**Mitschrift bis zum Abbruch**'), true)
  check('4c Protokoll trägt die Zeitmarke', text.includes('[+03:20] → Read'), true)
  check('4d Werkzeug-Bilanz im Kopf', text.includes('Read×1'), true)
  check('4e nicht mehr „kein Output"', /kein Output/.test(text), false)
}

// 5. Leerer Lauf (Prozess starb vor dem ersten Ereignis) bleibt lesbar.
{
  const lauf = neuerLauf(T0)
  check('5 Platzhalter statt Leere', protokollText(lauf).includes('(noch nichts)'), true)
}

// 6. Robustheit: Müll darf das Protokoll nicht kippen.
{
  const lauf = neuerLauf(T0)
  nimmZeile(lauf, '', T0)
  nimmZeile(lauf, '   ', T0)
  nimmZeile(lauf, 'kein json', T0)
  nimmZeile(lauf, '{"kaputt":', T0)
  nimmZeile(lauf, 'null', T0)
  nimmZeile(lauf, '"nur ein String"', T0)
  nimmZeile(lauf, JSON.stringify({ type: 'system', subtype: 'hook_started' }), T0)
  nimmZeile(lauf, JSON.stringify({ type: 'unbekannt', irgendwas: true }), T0)
  check('6 nichts protokolliert', lauf.zeilen.length, 0)
  check('6b unlesbare gezählt', lauf.unlesbar, 4)
}

// 7. Rate-Limit nur melden, wenn es greift.
{
  const lauf = neuerLauf(T0)
  nimmZeile(lauf, JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } }), T0)
  check('7 „allowed" ist kein Ereignis', lauf.zeilen.length, 0)
  nimmZeile(lauf, JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected' } }), T0)
  check('7b Ablehnung steht drin', lauf.zeilen[0]?.includes('Rate-Limit: rejected'), true)
}

// 8. Brocken-Zerlegung: TCP zerschneidet Zeilen mitten im JSON.
{
  const lauf = neuerLauf(T0)
  const ganz = `${initEv}\n${toolEv}\n${resultEv}\n`
  let puffer = ''
  // In 40 Stücke zerhackt — so kommt es real aus dem Socket.
  const stueck = Math.ceil(ganz.length / 40)
  for (let i = 0; i < ganz.length; i += stueck) {
    puffer = nimmBrocken(lauf, puffer, ganz.slice(i, i + stueck), T0 + i)
  }
  check('8 alle drei Ereignisse trotz Zerstückelung', lauf.zeilen.length, 3)
  check('8b Endtext unversehrt', lauf.ergebnis, '# Morgen-Brief\n\n```json\n{"drafts":[]}\n```')
  check('8c kein Rest im Puffer', puffer, '')
  check('8d nichts als unlesbar verbucht', lauf.unlesbar, 0)
}

// 9. Ein Ereignis mit mehreren Inhalts-Teilen (Text + Werkzeug in einer Nachricht).
{
  const lauf = neuerLauf(T0)
  nimmZeile(
    lauf,
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Ich lese kurz nach.' },
          { type: 'tool_use', name: 'Grep', input: { pattern: 'Follow-up' } },
          { type: 'tool_use', name: 'Grep', input: { pattern: 'Termin' } },
        ],
      },
    }),
    T0 + 5_000,
  )
  check('9 drei Zeilen aus einem Ereignis', lauf.zeilen.length, 3)
  check('9b Grep doppelt gezählt', lauf.werkzeuge, { Grep: 2 })
  check('9c leerer Text wird übersprungen', (() => {
    const l = neuerLauf(T0)
    nimmZeile(l, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '  ' }] } }), T0)
    return l.zeilen.length
  })(), 0)
}

// 10. Fehlgeschlagenes result (is_error) — Endtext gibt es trotzdem.
{
  const lauf = neuerLauf(T0)
  nimmZeile(
    lauf,
    JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, result: 'abgebrochen', num_turns: 99 }),
    T0 + 1_000,
  )
  check('10 Fehler-Flag steht in den Kennzahlen', lauf.meta?.fehler, true)
  check('10b Subtyp im Protokoll', lauf.zeilen[0]?.includes('error_max_turns'), true)
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
