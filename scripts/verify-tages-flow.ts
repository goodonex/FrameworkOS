/**
 * Drift-Wache für den Tages-Flow (11.08.2026).
 *
 * Der Flow bestimmt, was Kevin morgens zuerst in die Hand nimmt — und wohin
 * ihn der Zähler weiterschiebt, wenn eine Stufe steht. Geprüft wird deshalb
 * genau das, was ihn still falsch machen könnte: eine verrutschte Reihenfolge,
 * ein erfundenes oder abgetipptes Tagesziel, ein Feld, das `daily_metrics`
 * gar nicht hat, und ein Auto-Advance, der im Kreis läuft oder eine offene
 * Stufe überspringt.
 *
 * Start: npx tsx scripts/verify-tages-flow.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { WEEK_TARGETS } from '../app/src/cockpit/lib/goals'
import { METRIC_FIELDS } from '../app/src/cockpit/lib/metrikFelder'
import { ANFRAGEN_LIMIT_TAG } from '../app/src/cockpit/lib/prioritaet'
import {
  ARBEITSTAGE_WOCHE,
  REAKTIVIERUNG_ZIEL_TAG,
  TAGES_FLOW,
  TAGES_FLOW_ZIELE,
  ersteOffeneStufe,
  flowFortschritt,
  naechsteStufe,
  sollFuer,
  stufeFuerFeld,
  stufenStaende,
  type FlowEingabe,
  type StufenId,
} from '../app/src/cockpit/lib/tagesFlow'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p: string) => readFileSync(join(wurzel, p), 'utf8')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

/** Kurzform für eine Eingabe: nur die Felder setzen, die der Fall braucht. */
function eingabe(teil: Partial<FlowEingabe> = {}): FlowEingabe {
  return { today: {}, faelligHeute: 0, ...teil }
}

// --- 1. Die Reihenfolge ist Kevins Diktat (D1) ---------------------------
const erwartet: StufenId[] = ['anfragen', 'nachrichten', 'looms', 'followups', 'reaktivierung']
check(
  'die fünf Stufen stehen in Kevins Reihenfolge',
  JSON.stringify(TAGES_FLOW.map((s) => s.id)) === JSON.stringify(erwartet),
  `Ist: ${TAGES_FLOW.map((s) => s.id).join(' → ')}`,
)
check('keine Dublette unter den Stufen', new Set(TAGES_FLOW.map((s) => s.id)).size === TAGES_FLOW.length)
check('kein Feld zählt zweimal', new Set(TAGES_FLOW.map((s) => s.feld)).size === TAGES_FLOW.length)

// --- 2. Die Felder sind echt --------------------------------------------
for (const s of TAGES_FLOW) {
  check(
    `${s.id} zählt ein echtes Metrikfeld (${s.feld})`,
    (METRIC_FIELDS as readonly string[]).includes(s.feld),
    'Ein Tipp auf ein Feld, das daily_metrics nicht hat, verschwindet spurlos.',
  )
  check(`${s.id} hat Label, Lang-Label und Hinweis`, !!s.label && !!s.langLabel && !!s.hinweis)
}

// --- 3. Ziele werden abgeleitet, nicht abgetippt -------------------------
const quelle = lies('app/src/cockpit/lib/tagesFlow.ts')
check(
  'das Anfragen-Ziel kommt aus ANFRAGEN_LIMIT_TAG',
  TAGES_FLOW[0].standardZiel === ANFRAGEN_LIMIT_TAG,
)
check(
  'das Nachrichten-Ziel kommt aus dem Wochenziel geteilt durch die Arbeitswoche',
  TAGES_FLOW[1].standardZiel === Math.round(WEEK_TARGETS.nachrichten / ARBEITSTAGE_WOCHE),
)
check('das Nachrichten-Ziel ist damit 15', TAGES_FLOW[1].standardZiel === 15)
check(
  'das Loom-Ziel kommt aus dem Wochenziel geteilt durch die Arbeitswoche',
  TAGES_FLOW[2].standardZiel === Math.round(WEEK_TARGETS.looms / ARBEITSTAGE_WOCHE),
)
check('das Loom-Ziel ist damit 5', TAGES_FLOW[2].standardZiel === 5)
check(
  'Follow-ups haben kein festes Ziel — ihr Soll kommt aus den Daten des Tages',
  TAGES_FLOW[3].standardZiel === null,
)
check('das Reaktivierungs-Ziel steht als benannte Konstante', TAGES_FLOW[4].standardZiel === REAKTIVIERUNG_ZIEL_TAG)
check(
  'tagesFlow.ts importiert die Wochenziele, statt sie zu wiederholen',
  /import\s*\{\s*WEEK_TARGETS\s*\}/.test(quelle),
)
check(
  'kein abgetipptes Tagesziel im Modul',
  !/standardZiel:\s*\d+/.test(quelle),
  'Jedes Ziel muss aus einer benannten Quelle kommen, sonst laufen Wochen- und Tageszahl auseinander.',
)
check(
  'der Flow schreibt nichts — kein Datenweg an bump() vorbei',
  !/supabase|fetch\(|upsert|from\(/.test(quelle),
)
check('der Flow ist frei von React (rein prüfbar)', !/from 'react'/.test(quelle))

// --- 4. Das dynamische Soll der vierten Stufe ---------------------------
check('Stufe 4 nimmt das Soll aus der Fälligkeit', sollFuer(TAGES_FLOW[3], eingabe({ faelligHeute: 7 })) === 7)
check('ohne fällige Threads ist das Soll 0', sollFuer(TAGES_FLOW[3], eingabe({ faelligHeute: 0 })) === 0)
check(
  'eine negative Fälligkeit kann nicht auftreten und wird auf 0 geklemmt',
  sollFuer(TAGES_FLOW[3], eingabe({ faelligHeute: -3 })) === 0,
)
check(
  'eine Zielüberschreibung kippt das dynamische Soll NICHT',
  sollFuer(TAGES_FLOW[3], eingabe({ faelligHeute: 4, ziele: { followups: 99 } })) === 4,
  'Sonst rechnete sich die Warteschlange schön.',
)

// --- 5. Zielüberschreibung aus ui_settings ------------------------------
check('eine gültige Überschreibung gilt', sollFuer(TAGES_FLOW[1], eingabe({ ziele: { nachrichten: 20 } })) === 20)
check('0 ist eine gültige Überschreibung (Stufe heute aus)', sollFuer(TAGES_FLOW[1], eingabe({ ziele: { nachrichten: 0 } })) === 0)
for (const [was, wert] of [
  ['Text', '20'],
  ['Komma-Zahl', 2.5],
  ['negativ', -1],
  ['NaN', Number.NaN],
  ['unendlich', Number.POSITIVE_INFINITY],
  ['absurd gross', 100_000],
  ['null', null],
] as const) {
  check(
    `eine kaputte Überschreibung (${was}) fällt auf den Standard zurück`,
    sollFuer(TAGES_FLOW[1], eingabe({ ziele: { nachrichten: wert as unknown as number } })) === 15,
    'Ein kaputter ui_settings-Wert darf keine Stufe für immer offen halten.',
  )
}
check('der ui_settings-Schlüssel ist benannt', TAGES_FLOW_ZIELE.length > 0)

// --- 6. Stände ----------------------------------------------------------
const standardTag = eingabe({
  today: { li_anfragen: 30, li_nachrichten: 15, looms: 5, li_followups: 0, inmails: 0 },
  faelligHeute: 3,
})
const s1 = stufenStaende(standardTag)
check('fünf Stände für fünf Stufen', s1.length === 5)
check('Anfragen stehen bei 30/30', s1[0].erledigt && s1[0].wert === 30 && s1[0].soll === 30)
check('Nachrichten stehen bei 15/15', s1[1].erledigt)
check('Looms stehen bei 5/5', s1[2].erledigt)
check('Follow-ups sind offen (0 von 3)', !s1[3].erledigt && s1[3].soll === 3)
check('Reaktivierung ist offen (0 von 5)', !s1[4].erledigt && s1[4].soll === 5)
check('die erste offene Stufe ist Nummer 4', ersteOffeneStufe(s1) === 3)
check('Fortschritt: 3 von 5', JSON.stringify(flowFortschritt(s1)) === JSON.stringify({ erledigt: 3, gesamt: 5 }))

const uebererfuellt = stufenStaende(eingabe({ today: { li_anfragen: 44 } }))
check('mehr als das Ziel gilt als erledigt', uebererfuellt[0].erledigt)

const leererTag = stufenStaende(eingabe())
check('ein leerer Tag hat nichts erledigt ausser der Stufe ohne Soll', ersteOffeneStufe(leererTag) === 0)
check(
  'Stufe 4 gilt bei Soll 0 als erledigt und wird übersprungen (D5)',
  leererTag[3].erledigt && leererTag[3].soll === 0,
)
check('ein fehlendes Feld in der Tageszeile zählt als 0, nicht als NaN', leererTag[0].wert === 0)

const allesFertig = stufenStaende(
  eingabe({ today: { li_anfragen: 30, li_nachrichten: 15, looms: 5, inmails: 5 }, faelligHeute: 0 }),
)
check('ein vollendeter Tag hat keine offene Stufe', ersteOffeneStufe(allesFertig) === -1)
check('Fortschritt am vollendeten Tag: 5 von 5', flowFortschritt(allesFertig).erledigt === 5)

// --- 7. Auto-Advance ----------------------------------------------------
check('von Stufe 1 aus geht es auf die nächste offene (4)', naechsteStufe(s1, 0) === 3)
check('von Stufe 4 aus geht es weiter auf 5', naechsteStufe(s1, 3) === 4)
check(
  'nach der letzten offenen Stufe wird von vorne gesucht',
  naechsteStufe(s1, 4) === 3,
  'Wer mittendrin einsteigt, darf vorne Offenes nicht verlieren.',
)
check('ist alles erledigt, gibt es kein Weiter (-1)', naechsteStufe(allesFertig, 0) === -1)
check(
  'die eigene Stufe kommt nie als Antwort zurück',
  (() => {
    const nurEineOffen = stufenStaende(
      eingabe({ today: { li_anfragen: 30, li_nachrichten: 15, looms: 5, inmails: 0 }, faelligHeute: 0 }),
    )
    // Offen ist nur Stufe 5 (Index 4) — von dort aus gibt es kein Weiter.
    return naechsteStufe(nurEineOffen, 4) === -1
  })(),
  'Sonst schöbe der Auto-Advance den Zähler auf sich selbst und liefe im Kreis.',
)
check('ein leerer Flow bricht den Auto-Advance nicht', naechsteStufe([], 0) === -1)

// --- 8. Nachschlag und Anschluss an die Zähl-Liste ----------------------
check('stufeFuerFeld findet die Anfragen-Stufe', stufeFuerFeld('li_anfragen')?.id === 'anfragen')
check('stufeFuerFeld gibt bei Unsinn null', stufeFuerFeld('gibtsnicht') === null)
check('stufeFuerFeld verträgt undefined', stufeFuerFeld(undefined) === null)
check(
  'ein Metrikfeld ausserhalb des Flows gehört keiner Stufe',
  stufeFuerFeld('ig_anfragen') === null,
  'Instagram und Call-Follow-ups sind bewusst nicht Teil des Tages-Rituals.',
)

// Ob die Zähl-Liste den Flow trägt (Reihenfolge, kein fehlendes Feld), prüft
// `verify-zaehl-modus.ts` — dort ist diese Liste zu Hause.

console.log(`\nverify-tages-flow: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
