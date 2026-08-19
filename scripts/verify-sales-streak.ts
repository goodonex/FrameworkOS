/**
 * Drift-Wache für die Sales-Serien (18.08.2026).
 *
 * Die Serie ist das Belohnungssystem des Tages-Flows — eine Zahl, die unfair
 * reisst, wird ignoriert statt gejagt. Geprüft wird deshalb genau das, was
 * sie unfair machen könnte: ein Wochenende, das als Riss zählt; ein laufender
 * Tag, der die Serie auf 0 stellt; ein Kunden-Freitag, den der Wochen-Freeze
 * nicht auffängt; eine Aus-den-Daten-Stufe, die ohne eingefrorene Portion
 * beurteilt wird; und ein Soll von 0, das als Versäumnis gilt.
 *
 * Start: npx tsx scripts/verify-sales-streak.ts
 */
import {
  bereiteDatenVor,
  isoWoche,
  salesSerie,
  stufeGruenAnTag,
  type MetrikTag,
  type PortionsTag,
} from '../app/src/cockpit/lib/salesStreak'
import { TAGES_FLOW, type StufenId } from '../app/src/cockpit/lib/tagesFlow'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const stufe = (id: StufenId) => {
  const s = TAGES_FLOW.find((s) => s.id === id)
  if (!s) throw new Error(`Stufe ${id} fehlt`)
  return s
}
const ANFRAGEN = stufe('anfragen')
const ERSTNACHRICHTEN = stufe('erstnachrichten')
const FOLLOWUPS = stufe('followups')
const ANTWORTEN = stufe('antworten')

// Kalender-Anker: Di 18.08.2026. Mo 17.08., Fr 14.08., Do 13.08. …
const DI = '2026-08-18'
const MO = '2026-08-17'
const SO = '2026-08-16'
const SA = '2026-08-15'
const FR = '2026-08-14'
const DO = '2026-08-13'
const MI = '2026-08-12'
const DI_VOR = '2026-08-11'
const MO_VOR = '2026-08-10'
const FR_VOR = '2026-08-07'

function metrik(datum: string, anfragen: number): MetrikTag {
  return { datum, li_anfragen: anfragen }
}

// --- 1. ISO-Woche --------------------------------------------------------
check('Mi, Do und Fr derselben Woche teilen den Schlüssel', isoWoche(MI) === isoWoche(DO) && isoWoche(DO) === isoWoche(FR))
check('Mo 17.08. und Di 18.08. liegen in einer Woche', isoWoche(MO) === isoWoche(DI))
check('Mo 10.08. und Fr 14.08. liegen in einer Woche (W33)', isoWoche(MO_VOR) === isoWoche(FR))
check('Fr 14.08. liegt in der Vorwoche', isoWoche(FR) !== isoWoche(MO))
check('die Woche ist ISO-benannt', /^\d{4}-W\d{2}$/.test(isoWoche(DI)))
check('Jahreswechsel: der 01.01.2027 (Fr) gehört zu 2026-W53', isoWoche('2027-01-01') === '2026-W53')

// --- 2. Urteile ----------------------------------------------------------
const datenUrteil = bereiteDatenVor(
  [metrik(MO, 30), metrik(FR, 12)],
  [
    { datum: MO, stufe: 'erstnachrichten', soll: 5 },
    { datum: FR, stufe: 'erstnachrichten', soll: 0 },
  ],
)
check('festes Ziel erreicht → grün', stufeGruenAnTag(ANFRAGEN, MO, datenUrteil) === true)
check('festes Ziel verfehlt → rot', stufeGruenAnTag(ANFRAGEN, FR, datenUrteil) === false)
check('Tag ohne Metrik-Zeile → rot (0 gezählt), nicht null', stufeGruenAnTag(ANFRAGEN, DO, datenUrteil) === false)
check(
  'Aus-den-Daten-Stufe ohne Portion → KEIN Urteil',
  stufeGruenAnTag(ERSTNACHRICHTEN, DO, datenUrteil) === null,
  'Vor der Einführung der Tabelle gibt es nichts zu beurteilen — die Serie beginnt dort, nicht bei „alles rot".',
)
check(
  'Portion 0 heisst: nichts war fällig, Pflicht erfüllt → grün',
  stufeGruenAnTag(ERSTNACHRICHTEN, FR, datenUrteil) === true,
)
check(
  'Portion 5 ohne gebuchte Nachrichten → rot',
  stufeGruenAnTag(ERSTNACHRICHTEN, MO, datenUrteil) === false,
)
check('die Frische-Stufe hat keine Historie und kein Urteil', stufeGruenAnTag(ANTWORTEN, MO, datenUrteil) === null)

// --- 3. Die Serie: Wochenenden zählen nicht und brechen nicht -------------
const wochenendFest = bereiteDatenVor(
  [metrik(DI, 30), metrik(MO, 30), metrik(FR, 30), metrik(DO, 30)],
  [],
)
const s3 = salesSerie(ANFRAGEN, DI, wochenendFest)
check(
  'Do–Fr–(WE)–Mo–Di sind eine Serie von 4',
  s3.laenge === 4 && !s3.heuteOffen,
  `Ist: ${JSON.stringify(s3)}`,
)

// --- 4. Der laufende Tag bricht nichts ------------------------------------
const heuteOffen = bereiteDatenVor([metrik(MO, 30), metrik(FR, 30)], [])
const s4 = salesSerie(ANFRAGEN, DI, heuteOffen)
check(
  'heute noch nichts gebucht → Serie 2, heute offen',
  s4.laenge === 2 && s4.heuteOffen,
  `Ist: ${JSON.stringify(s4)}`,
)

// --- 5. Der Wochen-Freeze -------------------------------------------------
// Do grün, Fr verpasst (Kunde), Mo grün, Di (heute) grün → Serie 3, Fr eingefroren.
const kundenFreitag = bereiteDatenVor([metrik(DI, 30), metrik(MO, 30), metrik(DO, 30)], [])
const s5 = salesSerie(ANFRAGEN, DI, kundenFreitag)
check(
  'ein verpasster Freitag friert ein, statt zu reissen',
  s5.laenge === 3 && !s5.heuteOffen,
  `Ist: ${JSON.stringify(s5)}`,
)

// Auch am Kopf: Fr verpasst, Mo (heute) noch offen → die Serie von Do lebt.
const montagFrueh = bereiteDatenVor([metrik(DO, 30), metrik(MI, 30)], [])
const s5b = salesSerie(ANFRAGEN, MO, montagFrueh)
check(
  'Freitag beim Kunden, Montag früh geöffnet → Serie lebt (2, heute offen)',
  s5b.laenge === 2 && s5b.heuteOffen,
  `Ist: ${JSON.stringify(s5b)}`,
)

// Zwei Risse in EINER Woche sprengen das Budget: Mi+Do verpasst → Serie endet.
const zweiRisse = bereiteDatenVor([metrik(DI, 30), metrik(MO, 30), metrik(FR, 30), metrik(DI_VOR, 30), metrik(MO_VOR, 30)], [])
const s5c = salesSerie(ANFRAGEN, DI, zweiRisse)
check(
  'zwei verpasste Tage derselben Woche reissen die Serie',
  s5c.laenge === 3,
  `Mi 12. und Do 13. fehlen beide (Woche ${isoWoche(MI)}) — nur einer davon ist einfrierbar. Ist: ${JSON.stringify(s5c)}`,
)

// Je ein Riss in ZWEI Wochen: beide eingefroren, die Serie läuft durch.
// Verpasst sind Mo 17. (W34) und Mi 12. (W33) — grün bleiben 5 Werktage.
const zweiWochen = bereiteDatenVor(
  [metrik(DI, 30), metrik(FR, 30), metrik(DO, 30), metrik(DI_VOR, 30), metrik(MO_VOR, 30)],
  [],
)
const s5d = salesSerie(ANFRAGEN, DI, zweiWochen)
check(
  'ein Riss je Woche (Mo 17. und Mi 12.) wird zweimal eingefroren',
  s5d.laenge === 5 && !s5d.heuteOffen,
  `Ist: ${JSON.stringify(s5d)}`,
)
// Gegenprobe: zwei Risse in EINER Woche (Fr 14. + Mo 10., beide W33) — nach
// dem ersten Freeze endet die Serie am zweiten Riss.
const zweiRisseEineWoche = bereiteDatenVor(
  [metrik(DI, 30), metrik(MO, 30), metrik(DO, 30), metrik(MI, 30), metrik(DI_VOR, 30), metrik(FR_VOR, 30)],
  [],
)
const s5e = salesSerie(ANFRAGEN, DI, zweiRisseEineWoche)
check(
  'der zweite Riss derselben Woche beendet die Serie (5, nicht 6)',
  s5e.laenge === 5,
  `Fr 14. friert ein, Mo 10. reisst — FR_VOR zählt nicht mehr. Ist: ${JSON.stringify(s5e)}`,
)

// --- 6. Ohne einen einzigen grünen Tag gibt es keine Serie ----------------
const nieGruen = bereiteDatenVor([metrik(MO, 3), metrik(FR, 0)], [])
const s6 = salesSerie(ANFRAGEN, DI, nieGruen)
check('nur Freezes und Rot ist keine Serie', s6.laenge === 0 && !s6.heuteOffen, `Ist: ${JSON.stringify(s6)}`)
check('leere Daten sind eine leere Serie', salesSerie(ANFRAGEN, DI, bereiteDatenVor([], [])).laenge === 0)

// --- 7. Aus-den-Daten-Stufen: die Serie beginnt bei der Einführung ---------
const einfuehrung = bereiteDatenVor(
  [
    { datum: DI, li_followups: 20 },
    { datum: MO, li_followups: 20 },
    // Fr und davor: keine Portionen — Zeit vor der Einführung.
    { datum: FR, li_followups: 7 },
  ],
  [
    { datum: DI, stufe: 'followups', soll: 20 },
    { datum: MO, stufe: 'followups', soll: 20 },
  ],
)
const s7 = salesSerie(FOLLOWUPS, DI, einfuehrung)
check(
  'vor der Einführung bricht die Serie nach dem Freeze-Polster, statt rot zu wüten',
  s7.laenge === 2 && !s7.heuteOffen,
  `Mo+Di beurteilt grün; Fr ohne Portion kostet das Freeze, Do beendet. Ist: ${JSON.stringify(s7)}`,
)

// --- 7b. Der erledigt-Vermerk sticht den Zähler (0075) ---------------------
// Kevins Fall vom 18.08.2026: 37 von 39 Erstnachrichten im Zähler, weil er zwei
// verworfen statt gesendet hat. Die Zeile war grün („Liste leer"), die Serie
// riss. Der Vermerk hält genau diesen Moment fest.
const mitVermerk = bereiteDatenVor(
  [
    { datum: DI, li_nachrichten: 37 },
    { datum: MO, li_nachrichten: 12 },
  ],
  [
    { datum: DI, stufe: 'erstnachrichten', soll: 39, erledigtAt: '2026-08-18T18:41:00Z' },
    { datum: MO, stufe: 'erstnachrichten', soll: 12 },
  ],
)
const s8 = salesSerie(ERSTNACHRICHTEN, DI, mitVermerk)
check(
  'ein erledigt-Vermerk macht den Tag grün, auch wenn der Zähler unter dem Soll blieb',
  s8.laenge === 2 && !s8.heuteOffen,
  `37 von 39, aber Liste leer und vermerkt. Ist: ${JSON.stringify(s8)}`,
)

const ohneVermerk = bereiteDatenVor(
  [
    { datum: DI, li_nachrichten: 37 },
    { datum: MO, li_nachrichten: 12 },
  ],
  [
    { datum: DI, stufe: 'erstnachrichten', soll: 39 },
    { datum: MO, stufe: 'erstnachrichten', soll: 12 },
  ],
)
check(
  'ohne Vermerk bleibt es beim alten Urteil — der Vermerk erfindet keine Serie',
  salesSerie(ERSTNACHRICHTEN, DI, ohneVermerk).laenge === 1,
  'Nur Montag zählt; Dienstag kostet das Freeze der Woche.',
)

const leererTag = bereiteDatenVor(
  [{ datum: DI, li_nachrichten: 0 }],
  [{ datum: DI, stufe: 'erstnachrichten', soll: 0 }],
)
check(
  'ein Tag ohne offene Erstnachrichten (0 von 0) zählt als geschafft',
  salesSerie(ERSTNACHRICHTEN, DI, leererTag).laenge === 1,
  'Eine leere Pflicht ist erfüllt — sonst bestraft die Serie einen ruhigen Tag.',
)

// --- 8. Blatt-Disziplin ---------------------------------------------------
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const quelle = readFileSync(join(wurzel, 'app/src/cockpit/lib/salesStreak.ts'), 'utf8')
check('salesStreak ist frei von React', !/from 'react'/.test(quelle))
check('salesStreak schreibt nichts', !/supabase|fetch\(|upsert/.test(quelle))
check(
  'die Datums-Helfer kommen aus identityStreak, statt dupliziert zu werden',
  /from '\.\/identityStreak'/.test(quelle),
  'Zwei Wochenend-Rechnungen driften — eine reicht.',
)

console.log(`\nverify-sales-streak: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
