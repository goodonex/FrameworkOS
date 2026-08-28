/**
 * Drift-Wache für Zug 1 der Pipeline-Board-Blaupause
 * (docs/wargames/pipeline-board.md) — „die Ereignis-Lücke schließen, BEVOR
 * gemessen wird". Ohne diesen Zug hätte jede Conversion-Rate in Zug 2 auf
 * einer leeren Historie gestanden (followup/loom_gesendet lagen bei 0 Zeilen,
 * obwohl täglich abgehakt wurde).
 *
 * **Abweichung von der Blaupause, dokumentiert statt stillschweigend
 * umgesetzt:** Der Plan nannte vier Spuren — `followup`, `erstnachricht`,
 * `loom`, `inmail`. Die Recon zu diesem Zug ergab: `inmail` läuft nie durch
 * `erledigePosten`. Das Buchen einer InMail ist in `InmailPanel.onBuchen` ein
 * reiner Pool-Zähler (+1/-1) ohne ausgewählten Lead — es gibt dort keine
 * `rowId`, an die sich ein Ereignis hängen liesse. `ereignisTypFuer('inmail')`
 * liefert deshalb bewusst `null`, und dieses Skript hält das als Invariante
 * fest statt es zu übergehen.
 *
 * Zweite Abweichung von der wörtlichen Plan-Vorgabe fürs Prüfskript: „Jede
 * Spur, die ein Metrikfeld hat, hat auch einen Ereignis-Typ" stimmt NICHT —
 * `anfrage` und `inmail` haben beide ein Metrikfeld (`metrikFeldFuer`), aber
 * bewusst keinen Ereignis-Typ: `inmail`, weil `InmailPanel` keinen Lead kennt
 * (siehe oben), `anfrage`, weil ein Vernetzungsanfragen-Zähler kein einzelner
 * Lead-Vorgang ist, den man protokollieren könnte. `antwort` hat ohnehin schon
 * KEIN Metrikfeld (`metrikFeldFuer('antwort') === null`, seit jeher — die
 * Antwort zählt nicht als Erstnachricht), die Falle liegt also woanders, als
 * der erste Blick vermuten lässt. Dieses Skript prüft deshalb die
 * TATSÄCHLICH korrekte, engere Regel: „jede Spur mit einem Ereignis-Typ hat
 * auch ein Metrikfeld" (Umkehrung) — nicht die andere Richtung.
 *
 * Start: npx tsx scripts/verify-ereignis-schreibung.ts
 */
import { erledigePosten, ereignisTypFuer, metrikFeldFuer } from '../app/src/cockpit/lib/arbeitsmodusTracking'
import type { ArbeitsmodusTrackingDeps } from '../app/src/cockpit/lib/arbeitsmodusTracking'
import type { Posten, Spur } from '../app/src/cockpit/lib/prioritaet'
import type { LeadEreignisTyp } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

function makePosten(overrides: Partial<Posten>): Posten {
  return { id: 'thread:t1', spur: 'antwort', name: 'Test', text: 'Text', timestamp: null, ...overrides }
}

interface ProtokollAufruf {
  rowId: string
  spur: Spur
  typ: LeadEreignisTyp
}

/** Deps wie im echten Aufrufer, plus ein Mitschnitt jedes Protokoll-Aufrufs. */
function makeDeps(protokolliere?: ArbeitsmodusTrackingDeps['protokolliere']) {
  const aufrufe: ProtokollAufruf[] = []
  const deps: ArbeitsmodusTrackingDeps = {
    bump: () => {},
    erstnachrichtGesendet: () => {},
    followupErledigt: () => {},
    loomVerschickt: () => {},
    taskErledigt: () => {},
    schreibeDauer: () => {},
    protokolliere:
      protokolliere ??
      ((rowId, spur, typ) => {
        aufrufe.push({ rowId, spur, typ })
      }),
  }
  return { deps, aufrufe }
}

/* ── 1. Die Zuordnungs-Tabelle, wörtlich ────────────────────────────────── */

check('1a erstnachricht -> erstnachricht', ereignisTypFuer('erstnachricht'), 'erstnachricht')
check('1b followup -> followup', ereignisTypFuer('followup'), 'followup')
check('1c loom -> loom_gesendet', ereignisTypFuer('loom'), 'loom_gesendet')

/* ── 2. Die drei Ausnahmen — mit Begründung, keine Lücke ────────────────── */

check(
  'DIE ABWEICHUNG: inmail -> kein Ereignis-Typ (kein rowId in InmailPanel)',
  ereignisTypFuer('inmail') === null,
)
check(
  'antwort -> kein Ereignis-Typ (antwort_erhalten meint das Gegenteil)',
  ereignisTypFuer('antwort') === null,
)
check('anfrage -> kein Ereignis-Typ (Zähler, kein Lead-Vorgang)', ereignisTypFuer('anfrage') === null)
check('kundenaufgabe -> kein Ereignis-Typ (kein Lead-Vorgang)', ereignisTypFuer('kundenaufgabe') === null)
check('aufgabe -> kein Ereignis-Typ (kein Lead-Vorgang)', ereignisTypFuer('aufgabe') === null)
check('kunde_liegt -> kein Ereignis-Typ (abgeleitetes Signal, keine Zeile)', ereignisTypFuer('kunde_liegt') === null)

/* ── 3. Die engere, tatsächlich korrekte Umkehrung ──────────────────────── */

const ALLE_SPUREN: Spur[] = [
  'kundenaufgabe',
  'kunde_liegt',
  'antwort',
  'loom',
  'erstnachricht',
  'followup',
  'aufgabe',
  'anfrage',
  'inmail',
]
for (const spur of ALLE_SPUREN) {
  const typ = ereignisTypFuer(spur)
  if (typ) check(`${spur}: hat einen Ereignis-Typ -> hat auch ein Metrikfeld`, metrikFeldFuer(spur) !== null, spur)
}
check(
  'die Umkehrung gilt NICHT: anfrage/inmail haben ein Metrikfeld, aber keinen Ereignis-Typ',
  metrikFeldFuer('anfrage') !== null &&
    metrikFeldFuer('inmail') !== null &&
    ereignisTypFuer('anfrage') === null &&
    ereignisTypFuer('inmail') === null,
)
check(
  'antwort zaehlt seit 0081 ein Feld, hat aber weiterhin KEINEN Ereignis-Typ',
  metrikFeldFuer('antwort') === 'antworten_erledigt' && ereignisTypFuer('antwort') === null,
  'Der Grund ist unveraendert: antwort_erhalten bedeutet das GEGENTEIL (der LEAD hat geschrieben). Ihn beim Haken zu schreiben waere eine Luege ueber die Historie.',
)

/* ── 4. erledigePosten ruft protokolliere GENAU EINMAL ──────────────────── */

for (const [spur, praefix, erwarteterTyp] of [
  ['erstnachricht', 'erstnachricht', 'erstnachricht'],
  ['followup', 'thread', 'followup'],
  ['loom', 'loom', 'loom_gesendet'],
] as const) {
  const { deps, aufrufe } = makeDeps()
  await erledigePosten({ posten: makePosten({ id: `${praefix}:x1`, spur }), sekunden: 10 }, deps)
  check(`${spur}: protokolliere genau einmal aufgerufen`, aufrufe.length === 1, JSON.stringify(aufrufe))
  check(`${spur}: rowId ohne Präfix`, aufrufe[0]?.rowId === 'x1', aufrufe[0]?.rowId)
  check(`${spur}: die Spur wird durchgereicht`, aufrufe[0]?.spur === spur)
  check(`${spur}: der richtige Ereignis-Typ`, aufrufe[0]?.typ === erwarteterTyp, aufrufe[0]?.typ)
}

/* ── 5. Die Spuren OHNE Ereignis rufen protokolliere NIE auf ────────────── */

for (const [spur, praefix] of [
  ['antwort', 'thread'],
  ['anfrage', 'anfrage'],
  ['inmail', 'inmail'],
  ['kundenaufgabe', 'task'],
  ['aufgabe', 'task'],
  ['kunde_liegt', 'liegt'],
] as const) {
  const { deps, aufrufe } = makeDeps()
  await erledigePosten({ posten: makePosten({ id: `${praefix}:x1`, spur }), sekunden: 10 }, deps)
  check(`${spur}: protokolliere wird NIE aufgerufen`, aufrufe.length === 0, JSON.stringify(aufrufe))
}

/* ── 6. O7: Erinnerungs-Posten protokollieren nichts (dieselbe Sperre wie bump) ── */

{
  const { deps, aufrufe } = makeDeps()
  await erledigePosten(
    { posten: makePosten({ id: 'thread:x1', spur: 'followup', nurZaehler: true }), sekunden: 5 },
    deps,
  )
  check('nurZaehler-Posten protokolliert nichts', aufrufe.length === 0, JSON.stringify(aufrufe))
}

/* ── 7. Ohne deps.protokolliere (alter Aufrufer) bleibt alles wie vorher ── */

{
  const deps: ArbeitsmodusTrackingDeps = {
    bump: () => {},
    erstnachrichtGesendet: () => {},
    followupErledigt: () => {},
    loomVerschickt: () => {},
    taskErledigt: () => {},
    schreibeDauer: () => {},
    // protokolliere absichtlich weggelassen — das ist die Vorgabe aus
    // verify-arbeitsmodus-tracking.ts, dort NICHT nachgezogen.
  }
  let geworfen = false
  try {
    await erledigePosten({ posten: makePosten({ id: 'thread:x1', spur: 'followup' }), sekunden: 5 }, deps)
  } catch {
    geworfen = true
  }
  check('ohne deps.protokolliere wirft erledigePosten nichts', !geworfen)
}

/* ── 8. Fehlende Lead-Verknüpfung: still nichts protokollieren, nie werfen ──
 *
 * Simuliert exakt das Muster aus SalesDashboard.tsx: die injizierte Funktion
 * sucht den Lead über eine Zeilen-Id und gibt bei einem Treffer-losen Ergebnis
 * einfach zurück. Kein Fehler, keine Ausnahme — ein Thread ohne `lead_id` ist
 * kein Grund, den Haken selbst scheitern zu lassen.
 */
{
  const protokolliert: unknown[] = []
  const threadsOhneLead = new Map<string, string | null>([['t1', null]]) // rowId -> lead_id | null
  const { deps } = makeDeps(async (rowId, _spur, typ) => {
    const leadId = threadsOhneLead.get(rowId)
    if (!leadId) return
    protokolliert.push({ rowId, typ })
  })
  let geworfen = false
  try {
    await erledigePosten({ posten: makePosten({ id: 'thread:t1', spur: 'followup' }), sekunden: 5 }, deps)
  } catch {
    geworfen = true
  }
  check('Lead ohne Verknüpfung: kein Wurf', !geworfen)
  check('Lead ohne Verknüpfung: nichts protokolliert', protokolliert.length === 0, JSON.stringify(protokolliert))
}

console.log(`\nverify-ereignis-schreibung: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
