/**
 * Drift-Wache für den Tages-Flow (11.08.2026, neu diktiert 18.08.2026).
 *
 * Der Flow bestimmt, was Kevin morgens zuerst in die Hand nimmt — und wohin
 * ihn der Zähler weiterschiebt, wenn eine Stufe steht. Geprüft wird deshalb
 * genau das, was ihn still falsch machen könnte: eine verrutschte Reihenfolge,
 * ein erfundenes oder abgetipptes Tagesziel, ein Feld, das `daily_metrics`
 * gar nicht hat, ein Soll, das beim Abhaken unter Kevin wegschrumpft, eine
 * Frische-Stufe, die wie ein Zähler behandelt wird, und ein Auto-Advance, der
 * im Kreis läuft oder auf der zähllosen Antworten-Stufe landet.
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
  ANTWORT_FRISCHE_STUNDEN,
  ARBEITSTAGE_WOCHE,
  FOLLOWUP_PORTION_TAG,
  PORTION_STUFEN,
  REAKTIVIERUNG_ZIEL_TAG,
  TAGES_FLOW,
  TAGES_FLOW_ZIELE,
  ersteOffeneStufe,
  flowFortschritt,
  flowQuellen,
  naechsteStufe,
  naechsteZaehlbareStufe,
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

// Indizes der Stufen — einmal benannt, damit die Fälle lesbar bleiben.
const ANFRAGEN = 0
const ERSTNACHRICHTEN = 1
const ANTWORTEN = 2
const FOLLOWUPS = 3
const REAKTIVIERUNG = 4
const LOOMS = 5

// --- 1. Die Reihenfolge ist Kevins Diktat (D1, 18.08.2026) ---------------
const erwartet: StufenId[] = ['anfragen', 'erstnachrichten', 'antworten', 'followups', 'reaktivierung', 'looms']
check(
  'die sechs Stufen stehen in Kevins Reihenfolge',
  JSON.stringify(TAGES_FLOW.map((s) => s.id)) === JSON.stringify(erwartet),
  `Ist: ${TAGES_FLOW.map((s) => s.id).join(' → ')}`,
)
check('keine Dublette unter den Stufen', new Set(TAGES_FLOW.map((s) => s.id)).size === TAGES_FLOW.length)
const zaehlFelder = TAGES_FLOW.filter((s) => s.feld !== null).map((s) => s.feld)
check('kein Feld zählt zweimal', new Set(zaehlFelder).size === zaehlFelder.length)

// --- 2. Die Felder sind echt --------------------------------------------
for (const s of TAGES_FLOW) {
  if (s.art === 'frische') continue
  check(
    `${s.id} zählt ein echtes Metrikfeld (${s.feld})`,
    s.feld !== null && (METRIC_FIELDS as readonly string[]).includes(s.feld),
    'Ein Tipp auf ein Feld, das daily_metrics nicht hat, verschwindet spurlos.',
  )
}
for (const s of TAGES_FLOW) {
  check(`${s.id} hat Label, Lang-Label und Hinweis`, !!s.label && !!s.langLabel && !!s.hinweis)
}
check(
  'die Antworten-Stufe zaehlt seit 0081 abgearbeitete Antworten',
  TAGES_FLOW[ANTWORTEN].art === 'zaehler' && TAGES_FLOW[ANTWORTEN].feld === 'antworten_erledigt',
  'Kevin will sie abarbeiten koennen („null von fuenf … am Ende elf von elf"), und dafuer braucht die Stufe ein Soll.',
)
check(
  'sie zaehlt NICHT antworten_li',
  TAGES_FLOW[ANTWORTEN].feld !== 'antworten_li',
  'antworten_li sind die ERHALTENEN Antworten (Kanal-Kennzahl im Trichter-Eingang). Wer beide zusammenlegt, macht daraus eine Erledigungsquote.',
)
check('alle Stufen sind Zähl-Stufen', TAGES_FLOW.every((s) => s.art === 'zaehler'))
check(
  'zurzeit gibt es keine Frische-Stufe mehr',
  TAGES_FLOW.every((s) => s.art !== 'frische'),
  'Der frische-Zweig in stufenStaende() hat damit keinen Nutzer. Er bleibt fuer den naechsten Fall stehen — wer hier eine Stufe hinzufuegt, liest ihn bitte zuerst, statt ihm zu vertrauen.',
)

// --- 3. Ziele werden abgeleitet, nicht abgetippt -------------------------
const quelle = lies('app/src/cockpit/lib/tagesFlow.ts')
check(
  'das Anfragen-Ziel kommt aus ANFRAGEN_LIMIT_TAG',
  TAGES_FLOW[ANFRAGEN].standardZiel === ANFRAGEN_LIMIT_TAG,
)
check(
  'Erstnachrichten haben kein festes Ziel — es gehen alle raus, die da sind',
  TAGES_FLOW[ERSTNACHRICHTEN].standardZiel === null,
)
check(
  'Follow-ups haben kein festes Ziel — ihr Soll ist die Portion aus dem Fälligen',
  TAGES_FLOW[FOLLOWUPS].standardZiel === null,
)
check(
  'das Reaktivierungs-Ziel steht als benannte Konstante',
  TAGES_FLOW[REAKTIVIERUNG].standardZiel === REAKTIVIERUNG_ZIEL_TAG,
)
check(
  'das Loom-Ziel kommt aus dem Wochenziel geteilt durch die Arbeitswoche',
  TAGES_FLOW[LOOMS].standardZiel === Math.round(WEEK_TARGETS.looms / ARBEITSTAGE_WOCHE),
)
check('das Loom-Ziel ist damit 2', TAGES_FLOW[LOOMS].standardZiel === 2)
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

// --- 4. Das Soll aus den Daten: stabil unterm Abhaken --------------------
check(
  'Erstnachrichten: das Soll sind die Offenen',
  sollFuer(TAGES_FLOW[ERSTNACHRICHTEN], eingabe({ erstnachrichtenOffen: 7 })) === 7,
)
check(
  'Erstnachrichten: das Soll bleibt beim Abhaken stehen (offen 4 + erledigt 3 = 7)',
  sollFuer(TAGES_FLOW[ERSTNACHRICHTEN], eingabe({ erstnachrichtenOffen: 4, today: { li_nachrichten: 3 } })) === 7,
  'Sonst schrumpfte das Ziel mit jedem Haken und „7/7" wäre nie erreichbar.',
)
check(
  'Follow-ups: die Portion drosselt den Berg',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 200 })) === FOLLOWUP_PORTION_TAG,
  'Ein Soll von 200 wäre nie grün — eine Zeile, die nie grün wird, ist ein Vorwurf, keine Routine.',
)
check(
  'Follow-ups: ein kleiner Berg bleibt das Soll (3 fällig → 3)',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 3 })) === 3,
)
check(
  'Follow-ups: das Soll bleibt beim Abhaken stehen (fällig 15 + erledigt 5, Drossel 20 → 20)',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 15, today: { li_followups: 5 } })) === 20,
)
check('ohne fällige Threads ist das Soll 0', sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 0 })) === 0)
check(
  'eine negative Fälligkeit kann nicht auftreten und wird auf 0 geklemmt',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: -3 })) === 0,
)
check(
  'die Zielüberschreibung setzt die Drossel, nicht das Fällige (Drossel 5, fällig 200 → 5)',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 200, ziele: { followups: 5 } })) === 5,
)
check(
  'die Drossel erfindet keine Arbeit (Drossel 99, fällig 4 → 4)',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 4, ziele: { followups: 99 } })) === 4,
  'Sonst rechnete sich die Warteschlange schön — in die andere Richtung.',
)
check(
  'Looms: das Ziel wird auf die offenen Zusagen gedeckelt (Ziel 2, 1 offen → 1)',
  sollFuer(TAGES_FLOW[LOOMS], eingabe({ loomsOffen: 1 })) === 1,
)
check(
  'Looms: ohne Kenntnis der Offenen bleibt das feste Ziel',
  sollFuer(TAGES_FLOW[LOOMS], eingabe({})) === 2,
  'Lieber ein zu hohes Soll als ein erfundenes „nichts fällig".',
)
check(
  'Looms: das Soll bleibt beim Abhaken stehen (1 offen + 1 erledigt, Ziel 2 → 2)',
  sollFuer(TAGES_FLOW[LOOMS], eingabe({ loomsOffen: 1, today: { looms: 1 } })) === 2,
)

// --- 5. Eingefrorene Portionen schlagen die Live-Rechnung ----------------
check(
  'eine Portion friert das Soll ein (nachgerückte Fälle zählen nicht mehr)',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 200, portionen: { followups: 20 } })) === 20 &&
    sollFuer(TAGES_FLOW[ERSTNACHRICHTEN], eingabe({ erstnachrichtenOffen: 12, portionen: { erstnachrichten: 7 } })) === 7,
  'Ohne Einfrieren ist „20/20" ein bewegliches Ziel — um 14 Uhr sind es 23, und die Stufe wird nie grün.',
)
check(
  'eine kaputte Portion fällt auf die Live-Rechnung zurück',
  sollFuer(TAGES_FLOW[FOLLOWUPS], eingabe({ faelligHeute: 3, portionen: { followups: Number.NaN } })) === 3,
)

// --- 6. Zielüberschreibung aus ui_settings ------------------------------
check(
  'eine gültige Überschreibung gilt (Reaktivierung 10 statt 5)',
  sollFuer(TAGES_FLOW[REAKTIVIERUNG], eingabe({ ziele: { reaktivierung: 10 } })) === 10,
)
check(
  '0 ist eine gültige Überschreibung (Stufe heute aus)',
  sollFuer(TAGES_FLOW[REAKTIVIERUNG], eingabe({ ziele: { reaktivierung: 0 } })) === 0,
)
for (const [was, wert] of [
  ['Text', '5'],
  ['Komma-Zahl', 2.5],
  ['negativ', -1],
  ['NaN', Number.NaN],
  ['unendlich', Number.POSITIVE_INFINITY],
  ['absurd gross', 100_000],
  ['null', null],
] as const) {
  check(
    `eine kaputte Überschreibung (${was}) fällt auf den Standard zurück`,
    sollFuer(TAGES_FLOW[REAKTIVIERUNG], eingabe({ ziele: { reaktivierung: wert as unknown as number } })) ===
      REAKTIVIERUNG_ZIEL_TAG,
    'Ein kaputter ui_settings-Wert darf keine Stufe für immer offen halten.',
  )
}
check('der ui_settings-Schlüssel ist benannt', TAGES_FLOW_ZIELE.length > 0)

// --- 7. Die Antworten-Stufe (seit 0081 ein Zaehler) ----------------------
//
// Vorher war sie eine Frische-Frage: „43 duerfen warten, solange keiner ueber
// der Schwelle ist." Das war klug und beantwortete Kevins Frage trotzdem
// nicht. Jetzt gilt: wer wartet, wird beantwortet — alle, ohne Drossel. Eine
// unbeantwortete Antwort ist ein offener Faden zu jemandem, der GERADE
// geschrieben hat; da gibt es keinen Berg, den man in Portionen abtruege.
check('die Frische-Schwelle steht weiter (fuer die Farbe an der Zeile)', ANTWORT_FRISCHE_STUNDEN === 24)

const wartet43 = stufenStaende(eingabe({ antworten: { warten: 43, aeltesteStunden: 3 } }))[ANTWORTEN]
check(
  '43 Wartende sind 43 offene Antworten, nicht „frisch genug"',
  !wartet43.erledigt && wartet43.soll === 43 && wartet43.wert === 0,
  `Ist: erledigt=${wartet43.erledigt} soll=${wartet43.soll} wert=${wartet43.wert}`,
)
const niemand = stufenStaende(eingabe({ antworten: { warten: 0, aeltesteStunden: null } }))[ANTWORTEN]
check('niemand wartet → die Stufe steht', niemand.erledigt && niemand.soll === 0)

const halbFertig = stufenStaende(
  eingabe({ today: { antworten_erledigt: 2 }, antworten: { warten: 3, aeltesteStunden: 5 } }),
)[ANTWORTEN]
check(
  'das Soll bleibt beim Abhaken stehen: 2 erledigt + 3 offen = 5',
  halbFertig.soll === 5 && halbFertig.wert === 2 && !halbFertig.erledigt,
  `Ist: ${halbFertig.wert} von ${halbFertig.soll}. Ohne „+ wert" schrumpfte das Soll mit jedem Haken mit und die Zeile loege ueber den Tag.`,
)
const ganzFertig = stufenStaende(
  eingabe({ today: { antworten_erledigt: 5 }, antworten: { warten: 0, aeltesteStunden: null } }),
)[ANTWORTEN]
check('5 von 5 steht', ganzFertig.erledigt && ganzFertig.wert === 5 && ganzFertig.soll === 5)

check(
  'die Antworten-Stufe friert ihr Soll ein',
  PORTION_STUFEN.includes('antworten'),
  'Sonst waere die Zeile ein bewegliches Ziel: kommt um 14 Uhr eine sechste Antwort, stuende „3 von 6" statt „3 von 5" — und der Tag waere nie abgearbeitet.',
)
const eingefroren = stufenStaende(
  eingabe({
    today: { antworten_erledigt: 3 },
    antworten: { warten: 3, aeltesteStunden: 5 },
    portionen: { antworten: 5 },
  }),
)[ANTWORTEN]
check(
  'die eingefrorene Portion sticht die Live-Rechnung',
  eingefroren.soll === 5,
  `Ist ${eingefroren.soll} — live waeren es 6, aber die sechste ist Ware fuer morgen.`,
)

// --- 8. Stände ----------------------------------------------------------
const standardTag = eingabe({
  today: { li_anfragen: 30, li_nachrichten: 3, looms: 2, li_followups: 0, inmails: 0 },
  faelligHeute: 3,
  erstnachrichtenOffen: 0,
  loomsOffen: 0,
  antworten: { warten: 5, aeltesteStunden: 2 },
})
const s1 = stufenStaende(standardTag)
check('sechs Stände für sechs Stufen', s1.length === 6)
check('Anfragen stehen bei 30/30', s1[ANFRAGEN].erledigt && s1[ANFRAGEN].wert === 30 && s1[ANFRAGEN].soll === 30)
check('Erstnachrichten stehen (alle raus: offen 0)', s1[ERSTNACHRICHTEN].erledigt)
check('Antworten sind offen (0 von 5)', !s1[ANTWORTEN].erledigt && s1[ANTWORTEN].soll === 5)
check('Follow-ups sind offen (0 von 3)', !s1[FOLLOWUPS].erledigt && s1[FOLLOWUPS].soll === 3)
check('Reaktivierung ist offen (0 von 5)', !s1[REAKTIVIERUNG].erledigt && s1[REAKTIVIERUNG].soll === 5)
check('Looms stehen bei 2/2', s1[LOOMS].erledigt)
check('die erste offene Stufe sind die Antworten', ersteOffeneStufe(s1) === ANTWORTEN)
check('Fortschritt: 3 von 6', JSON.stringify(flowFortschritt(s1)) === JSON.stringify({ erledigt: 3, gesamt: 6 }))

const uebererfuellt = stufenStaende(eingabe({ today: { li_anfragen: 44 } }))
check('mehr als das Ziel gilt als erledigt', uebererfuellt[ANFRAGEN].erledigt)

// Leere Pflicht: die Quelle ist leer, obwohl das eingefrorene Soll höher lag —
// zwei Erstnachrichten verworfen statt gesendet. Die Stufe darf nicht für
// immer rot bleiben.
const verworfen = stufenStaende(
  eingabe({ erstnachrichtenOffen: 0, today: { li_nachrichten: 5 }, portionen: { erstnachrichten: 7 } }),
)[ERSTNACHRICHTEN]
check('leere Quelle heisst erledigt, auch unterm eingefrorenen Soll', verworfen.erledigt && verworfen.soll === 7)

const leererTag = stufenStaende(eingabe())
check('ein leerer Tag beginnt bei den Anfragen', ersteOffeneStufe(leererTag) === ANFRAGEN)
check(
  'Follow-ups gelten bei Soll 0 als erledigt und werden übersprungen (D5)',
  leererTag[FOLLOWUPS].erledigt && leererTag[FOLLOWUPS].soll === 0,
)
check('ein fehlendes Feld in der Tageszeile zählt als 0, nicht als NaN', leererTag[ANFRAGEN].wert === 0)

const allesFertig = stufenStaende(
  eingabe({
    today: { li_anfragen: 30, li_nachrichten: 2, looms: 2, inmails: 5 },
    faelligHeute: 0,
    erstnachrichtenOffen: 0,
    loomsOffen: 0,
    antworten: { warten: 0, aeltesteStunden: null },
  }),
)
check('ein vollendeter Tag hat keine offene Stufe', ersteOffeneStufe(allesFertig) === -1)
check('Fortschritt am vollendeten Tag: 6 von 6', flowFortschritt(allesFertig).erledigt === 6)

// --- 9. Auto-Advance ----------------------------------------------------
check('von Stufe 1 aus geht es auf die nächste offene (Antworten)', naechsteStufe(s1, ANFRAGEN) === ANTWORTEN)
check('von den Follow-ups aus geht es weiter zur Reaktivierung', naechsteStufe(s1, FOLLOWUPS) === REAKTIVIERUNG)
check(
  'nach der letzten offenen Stufe wird von vorne gesucht',
  naechsteStufe(s1, LOOMS) === ANTWORTEN,
  'Wer mittendrin einsteigt, darf vorne Offenes nicht verlieren.',
)
check('ist alles erledigt, gibt es kein Weiter (-1)', naechsteStufe(allesFertig, 0) === -1)
check(
  'die eigene Stufe kommt nie als Antwort zurück',
  (() => {
    const nurEineOffen = stufenStaende(
      eingabe({
        today: { li_anfragen: 30, li_nachrichten: 2, looms: 2, inmails: 0 },
        faelligHeute: 0,
        erstnachrichtenOffen: 0,
        loomsOffen: 0,
        antworten: { warten: 0, aeltesteStunden: null },
      }),
    )
    return naechsteStufe(nurEineOffen, REAKTIVIERUNG) === -1
  })(),
  'Sonst schöbe der Auto-Advance den Zähler auf sich selbst und liefe im Kreis.',
)
check('ein leerer Flow bricht den Auto-Advance nicht', naechsteStufe([], 0) === -1)

/**
 * Der Zähl-Advance darf seit 0081 auf der Antworten-Stufe landen — sie hat
 * jetzt ein Feld und damit eine Seite unter `/tracking/zaehlen`. Der Schutz,
 * um den es hier geht, bleibt trotzdem noetig: ein Sprungziel ohne Feld waere
 * `/tracking/zaehlen/null`, also eine Sackgasse. Dass zurzeit keine Stufe ohne
 * Feld existiert, macht die Regel nicht ueberfluessig, sondern nur still.
 */
const antwortenOffen = stufenStaende(
  eingabe({
    today: { li_anfragen: 30, li_nachrichten: 2 },
    faelligHeute: 3,
    erstnachrichtenOffen: 0,
    antworten: { warten: 2, aeltesteStunden: 30 },
  }),
)
check(
  'der Zähl-Advance landet auf der Antworten-Stufe, weil sie jetzt zaehlbar ist',
  naechsteZaehlbareStufe(antwortenOffen, ANFRAGEN) === ANTWORTEN,
)
check(
  'der normale Advance ebenso',
  naechsteStufe(antwortenOffen, ANFRAGEN) === ANTWORTEN,
)
check(
  'kein Sprungziel ohne Feld — sonst waere es /tracking/zaehlen/null',
  (() => {
    const ziel = naechsteZaehlbareStufe(antwortenOffen, ANFRAGEN)
    return ziel < 0 || TAGES_FLOW[ziel].feld !== null
  })(),
)

// --- 10. flowQuellen: eine Abfrage, eine Zahl ---------------------------
const jetzt = new Date('2026-08-18T12:00:00Z')
const q = flowQuellen(
  {
    followup: [{}, {}, {}],
    erstnachricht: [{}],
    loom: [{}, {}],
    antwort: [
      { timestamp: '2026-08-18T09:00:00Z' },
      { timestamp: '2026-08-16T12:00:00Z' },
      { timestamp: null },
    ],
  },
  jetzt,
)
check('flowQuellen zählt die Listen selbst', q.faelligHeute === 3 && q.erstnachrichtenOffen === 1 && q.loomsOffen === 2)
check(
  'die älteste Antwort bestimmt die Frische (48 h)',
  q.antworten?.warten === 3 && Math.round(q.antworten?.aeltesteStunden ?? 0) === 48,
)
const leer = flowQuellen({}, jetzt)
check('leere Quellen sind leer, nicht kaputt', leer.faelligHeute === 0 && leer.antworten?.aeltesteStunden === null)

// --- 11. Nachschlag und Anschluss an die Zähl-Liste ----------------------
check('stufeFuerFeld findet die Anfragen-Stufe', stufeFuerFeld('li_anfragen')?.id === 'anfragen')
check('stufeFuerFeld findet die Erstnachrichten', stufeFuerFeld('li_nachrichten')?.id === 'erstnachrichten')
check('stufeFuerFeld gibt bei Unsinn null', stufeFuerFeld('gibtsnicht') === null)
check('stufeFuerFeld verträgt undefined', stufeFuerFeld(undefined) === null)
check(
  'ein Metrikfeld ausserhalb des Flows gehört keiner Stufe',
  stufeFuerFeld('ig_anfragen') === null,
  'Instagram und Call-Follow-ups sind bewusst nicht Teil des Tages-Rituals.',
)

// Ob die Zähl-Liste den Flow trägt (Reihenfolge, kein fehlendes Feld), prüft
// `verify-zaehl-modus.ts` — dort ist diese Liste zu Hause.

// --- 12. Die Kette im Hero (D6: der Hero rechnet nichts) -----------------
const kette = lies('app/src/cockpit/components/home/TagesFlowStack.tsx')
const hero = lies('app/src/cockpit/components/home/HeroHorizont.tsx')
const home = lies('app/src/cockpit/pages/UrielHome.tsx')

check(
  'die Kette bekommt die Stände als Prop, statt sie selbst zu rechnen',
  /staende:\s*StufenStand\[\]/.test(kette) && !/stufenStaende\(/.test(kette),
)
check(
  'die Kette fragt keine Fälligkeit und kein Tagesziel selbst ab',
  !/bucketOf|linkedinFollowups|ANFRAGEN_LIMIT_TAG|WEEK_TARGETS/.test(kette),
  'Der Hero, der selbst rechnet, läuft der Zahl im Tracking davon.',
)
check('die Kette schreibt nichts', !/bump\(|supabase|upsert/.test(kette))
check(
  'die Kette nutzt den bestehenden Widget-Stack, statt eigene Gesten zu bauen',
  /ck-widget-stack/.test(kette) && !/onTouchMove|onPointerMove/.test(kette),
)
check(
  'der Einstiegs-Sprung läuft synchron nach dem Layout, nicht in einem Frame',
  /useLayoutEffect\(/.test(kette) && !/requestAnimationFrame\(/.test(kette),
  'Am 11.08. gemessen: der Frame wurde bei jedem Render weggeräumt, der Sprung kam nie zustande.',
)
check(
  'der Sprung fasst nichts an, was schon sitzt',
  /scrollLeft \/ el\.clientWidth\) === zielStufe\) return/.test(kette),
  'Sonst risse er bei jedem Datenwechsel eine laufende Bewegung ab.',
)
check(
  'ab der ersten Berührung hört das Nachrücken auf',
  /angefasst\.current = true/.test(kette) && /angefasst\.current\) return/.test(kette),
  'Eine Bahn, die sich unter dem eigenen Wisch weiterbewegt, ist ein Ärgernis.',
)
check('die Instrumentierung der Fehlersuche ist wieder draussen', !/console\.log|__flow/.test(kette))
check('auch der Hero selbst rechnet keine Stände', !/stufenStaende\(|useTagesFlow\(/.test(hero))
/**
 * Am 01.09.2026 gefunden, bevor es zuschlagen konnte: Der Tages-Flow friert
 * sein Soll beim ersten Öffnen ein (0074), sobald „alles geladen" ist. Seit die
 * Erstnachrichten-Stufe die WARTENDEN zählt, hängt sie an `linkedin_netzwerk` —
 * und genau das stand in keiner der beiden Ladeprüfungen. Wäre das Netzwerk
 * beim Einfrieren noch unterwegs gewesen, stünde eine 0 in der Tabelle und die
 * Kachel zeigte den ganzen Tag „0 von 0 ✓". Also derselbe Fehler wie zuvor, nur
 * eingefroren und nicht mehr wegzuladen.
 */
check(
  'der Sales-Ladezustand wartet auch auf das Netzwerk',
  /posten\.netzwerk\.loading/.test(readFileSync(join(wurzel, 'app/src/cockpit/pages/SalesDashboard.tsx'), 'utf8')),
  'Sonst friert eine 0 als Tages-Soll ein.',
)
check(
  'der Homescreen wartet ebenfalls auf das Netzwerk',
  /posten\.netzwerk\.loading/.test(home),
  'Sonst friert eine 0 als Tages-Soll ein.',
)
check(
  'der Homescreen leitet die Live-Zahlen aus der bestehenden Postenquelle ab',
  // Absicht statt Schreibweise (31.08.2026): Seit die Erstnachrichten-Stufe die
  // WARTENDEN zählt, kommt neben `posten.quellen` noch `posten.erstnachrichtWartend`
  // dazu — beides aus demselben Hook. Der Regex prüfte vorher die genaue
  // Zeichenfolge und schlug deshalb an einer Erweiterung an, die genau das tut,
  // was er sichern soll.
  /flowQuellen\(\s*\{?\s*\.\.\.?posten\.quellen/.test(home) && !/useLinkedinThreads\(/.test(home),
  'Ein zweiter Ladelauf für dieselben Threads wäre der teuerste Weg zu derselben Zahl.',
)
check(
  'die Antworten-Stufe führt vom Hero in den Sales-Flow, nicht in den Zähler',
  /kachel=antworten/.test(home),
)

// Token-Disziplin: keine Farbe im Komponenten-Code (Gesetz 6).
for (const [name, inhalt] of [
  ['TagesFlowStack.tsx', kette],
  ['HeroHorizont.tsx', hero],
] as const) {
  check(
    `${name} trägt keinen Hexwert und kein rgba()`,
    !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(inhalt),
    'Jede Farbe kommt aus den --ck-*-Tokens.',
  )
}
check(
  'die Glas-Mitte der Ringe steht als Token in cockpit.css',
  /--ck-ring-glas:/.test(lies('app/src/styles/cockpit.css')) && /var\(--ck-ring-glas\)/.test(kette),
)

// --- Looms ohne Tagesdeckel (01.09.2026, Kevins Diktat) ------------------
{
  const staende = stufenStaende({
    today: {},
    faelligHeute: 0,
    erstnachrichtenOffen: 0,
    erstnachrichtenTexte: 0,
    loomsOffen: 12,
  })
  const looms = staende.find((s) => s.stufe.id === 'looms')!
  check('Looms-Soll sind ALLE offenen Zusagen, kein Deckel', looms.soll === 12, `Ist: ${looms.soll}`)
  check('Looms nicht erledigt, solange Zusagen offen sind', !looms.erledigt)
  const gedrosselt = stufenStaende({
    today: {},
    faelligHeute: 0,
    erstnachrichtenOffen: 0,
    erstnachrichtenTexte: 0,
    loomsOffen: 12,
    ziele: { looms: 3 },
  }).find((s) => s.stufe.id === 'looms')!
  check('ein eigenes Looms-Ziel wirkt weiter als bewusste Drossel', gedrosselt.soll === 3, `Ist: ${gedrosselt.soll}`)
}

console.log(`\nverify-tages-flow: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
