/**
 * Drift-Wache für die Runde (31.08.2026).
 *
 * Der Umbau dreht die Steuerung um: kein Zeitplan mehr, sondern ein Lauf, den
 * Kevin auslöst. Vier Fehler würden ihn genau dort treffen, wo er sie erst
 * bemerkt, wenn der Tag schon verloren ist:
 *
 * 1. **Der Balken lügt.** Gleich breite Abschnitte für eine Etappe von sieben
 *    Minuten und eine von drei Sekunden — nach zwei Tagen glaubt er ihm nicht
 *    mehr und schaut wieder ins Log.
 * 2. **Ein Fehler in einer Etappe kippt die ganze Runde.** Bricht die
 *    Einladungsliste ab, sind Postfach und Verläufe trotzdem frisch; das ist
 *    der Stand, mit dem gearbeitet wird.
 * 3. **Die Frage beim Öffnen kommt bei jedem Tabwechsel.** Dann ist sie in
 *    einer Woche weggeklickt, ohne gelesen zu werden.
 * 4. **Der Zeitplan kommt still zurück.** Ein `!== '0'` an der falschen Stelle,
 *    und Kevins Chrome geht wieder von selbst an die Arbeit.
 *
 * Start: npx tsx scripts/verify-runde.ts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ETAPPEN,
  FRAGE_AB_MS,
  frageBeimOeffnen,
  kopfText,
  neueRunde,
  prozent,
  restText,
  schliesseRunde,
  setzeEtappe,
  standText,
} from '../runner/runde.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0

function check(was: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ok   ${was}`)
  } else {
    fail++
    console.log(`  FEHL ${was}${detail ? ' — ' + detail : ''}`)
  }
}

const T0 = new Date('2026-08-31T09:00:00+02:00').getTime()
const alle = (r: any, status: string) => r.etappen.every((e: any) => e.status === status)
const hole = (r: any, s: string) => r.etappen.find((e: any) => e.schluessel === s)

console.log('\n1) Die Etappen selbst')
{
  check('acht Etappen in fester Reihenfolge', ETAPPEN.length === 8)
  check('die Quellen laufen vor den Agenten', ETAPPEN.findIndex((e) => e.schluessel === 'postfach') < ETAPPEN.findIndex((e) => e.schluessel === 'entwuerfe'))
  check('Leads werden vor dem Wächter verbucht', ETAPPEN.findIndex((e) => e.schluessel === 'leads') < ETAPPEN.findIndex((e) => e.schluessel === 'waechter'))
  check('die Gewichte ergeben 100', ETAPPEN.reduce((s, e) => s + e.gewicht, 0) === 100)
  // Der eigentliche Punkt: die längste Etappe muss den breitesten Abschnitt haben.
  const laengste = [...ETAPPEN].sort((a, b) => b.gewicht - a.gewicht)[0]
  check('die Einladungsliste ist der breiteste Abschnitt', laengste.schluessel === 'einladungen', laengste.schluessel)
  check('der Wächter ist der schmalste', [...ETAPPEN].sort((a, b) => a.gewicht - b.gewicht)[0].schluessel === 'waechter')
  check('vier Etappen brauchen Chrome', ETAPPEN.filter((e) => e.brauchtChrome).length === 4)
}

console.log('\n2) Der Balken')
{
  let r = neueRunde({ jetzt: T0 })
  check('eine frische Runde steht bei 0 %', prozent(r) === 0)

  r = setzeEtappe(r, 'postfach', { status: 'fertig', anteil: 1 })
  check('die erste Etappe bringt ihr Gewicht, nicht ein Achtel', prozent(r) === 12, String(prozent(r)))

  // Feinfortschritt: die Einladungsliste ist zur Hälfte durch.
  r = setzeEtappe(r, 'verlauf', { status: 'fertig' })
  r = setzeEtappe(r, 'einladungen', { status: 'laeuft', anteil: 0.5 })
  check('eine halb gelaufene Etappe zählt halb', prozent(r) === 12 + 13 + 13, String(prozent(r)))

  // Ohne Chrome: die vier Chrome-Etappen sind übersprungen, der Rest läuft.
  let ohne = neueRunde({ jetzt: T0 })
  for (const s of ['postfach', 'verlauf', 'einladungen', 'kontakte']) ohne = setzeEtappe(ohne, s, { status: 'uebersprungen' })
  for (const s of ['leads', 'waechter', 'sortierer', 'entwuerfe']) ohne = setzeEtappe(ohne, s, { status: 'fertig' })
  check('ein Lauf ohne Chrome erreicht trotzdem 100 %', prozent(ohne) === 100, String(prozent(ohne)))

  // Eine Teilmenge (Nachmittags-Knopf, nur die Quellen) rechnet auf sich selbst.
  let teil = neueRunde({ jetzt: T0, nur: ['postfach', 'verlauf'] })
  check('eine Teil-Runde hat nur ihre Etappen', teil.etappen.length === 2)
  teil = setzeEtappe(teil, 'postfach', { status: 'fertig' })
  teil = setzeEtappe(teil, 'verlauf', { status: 'fertig' })
  check('eine Teil-Runde erreicht 100 %, nicht 25 %', prozent(teil) === 100, String(prozent(teil)))

  check('der Prozentwert bleibt zwischen 0 und 100', [neueRunde({ jetzt: T0 }), r, ohne, teil].every((x) => prozent(x) >= 0 && prozent(x) <= 100))
  check('ein kaputter Anteil kippt die Rechnung nicht', prozent(setzeEtappe(neueRunde({ jetzt: T0 }), 'postfach', { status: 'laeuft', anteil: 9 })) === 12)
}

console.log('\n3) Ein Fehler kippt nicht die Runde')
{
  let r = neueRunde({ jetzt: T0 })
  r = setzeEtappe(r, 'postfach', { status: 'fertig' })
  r = setzeEtappe(r, 'einladungen', { status: 'fehler', text: 'Liste brach ab' })
  for (const s of ['verlauf', 'kontakte', 'leads', 'waechter', 'sortierer', 'entwuerfe']) r = setzeEtappe(r, s, { status: 'fertig' })
  const fertig = schliesseRunde(r, { jetzt: T0 + 600_000 })
  check('die Runde gilt als fertig, nicht als Fehler', fertig.status === 'fertig', fertig.status)
  check('der Fehler bleibt an seiner Etappe stehen', hole(fertig, 'einladungen').status === 'fehler')
  check('die Kopfzeile benennt die Lücke', kopfText(fertig).includes('Lücke'), kopfText(fertig))

  // Nur wenn wirklich nichts durchlief, ist die Runde rot.
  let tot = neueRunde({ jetzt: T0 })
  for (const e of ETAPPEN) tot = setzeEtappe(tot, e.schluessel, { status: 'fehler' })
  check('ein Lauf ohne eine einzige gelungene Etappe ist ein Fehler', schliesseRunde(tot, { jetzt: T0 }).status === 'fehler')

  // Ein Lauf, bei dem nur übersprungen wurde (kein Chrome), ist kein Fehler.
  let leer = neueRunde({ jetzt: T0 })
  for (const e of ETAPPEN) leer = setzeEtappe(leer, e.schluessel, { status: 'uebersprungen' })
  check('ein komplett übersprungener Lauf ist kein Fehler', schliesseRunde(leer, { jetzt: T0 }).status === 'fertig')

  const abgebrochen = schliesseRunde(neueRunde({ jetzt: T0 }), { jetzt: T0, abgebrochen: true })
  check('Abbruch heißt abgebrochen, nicht fertig', abgebrochen.status === 'abgebrochen')
  check('nach dem Abbruch läuft keine Etappe mehr', !abgebrochen.etappen.some((e: any) => e.status === 'laeuft'))
}

console.log('\n4) Die Frage beim Öffnen')
{
  check('ohne je geladen zu haben wird gefragt', frageBeimOeffnen({ letzterStand: null, jetzt: T0 }))
  check('während ein Lauf läuft wird nicht gefragt', !frageBeimOeffnen({ letzterStand: null, jetzt: T0, laeuft: true }))
  const vorEinerStunde = new Date(T0 - 60 * 60 * 1000).toISOString()
  check('eine Stunde alter Stand fragt nicht nach', !frageBeimOeffnen({ letzterStand: vorEinerStunde, jetzt: T0 }))
  const vorFuenf = new Date(T0 - 5 * 60 * 60 * 1000).toISOString()
  check('fünf Stunden alter Stand fragt nach', frageBeimOeffnen({ letzterStand: vorFuenf, jetzt: T0 }))
  check('die Grenze liegt bei vier Stunden', FRAGE_AB_MS === 4 * 60 * 60 * 1000)
  check('ein kaputter Zeitstempel führt zur Frage, nicht zum Stillstand', frageBeimOeffnen({ letzterStand: 'Quatsch', jetzt: T0 }))
}

console.log('\n5) Die Sätze, die Kevin liest')
{
  check('ohne Lauf: „noch nie geladen"', standText(null, T0) === 'noch nie geladen')
  check('heute Morgen steht als Uhrzeit da', standText(new Date('2026-08-31T07:40:00+02:00').toISOString(), T0) === 'heute 07:40')
  check('gestern Abend heißt gestern', standText(new Date('2026-08-30T19:40:00+02:00').toISOString(), T0) === 'gestern 19:40')
  check('vorgestern zählt in Tagen', standText(new Date('2026-08-29T19:40:00+02:00').toISOString(), T0).startsWith('vor 2 Tagen'))
  check('älter als eine Woche zeigt das Datum', standText(new Date('2026-08-01T19:40:00+02:00').toISOString(), T0).startsWith('01.08.'))

  let r = neueRunde({ jetzt: T0 })
  r = setzeEtappe(r, 'einladungen', { status: 'laeuft' })
  check('die Kopfzeile nennt die laufende Etappe', kopfText(r) === 'Offene Einladungen', kopfText(r))
  check('die Restschätzung nennt Minuten', /Minute/.test(restText(r)), restText(r))
  // Die Schätzung muss FALLEN, nicht klein sein: „noch etwa 3 Minuten" bei
  // offener Entwürfe-Etappe ist richtig (sie dauert real drei bis fünf), eine
  // erzwungene „gleich fertig"-Meldung wäre die Lüge.
  let fast = neueRunde({ jetzt: T0 })
  for (const e of ETAPPEN.slice(0, 7)) fast = setzeEtappe(fast, e.schluessel, { status: 'fertig' })
  const minutenAus = (t: string) => Number(t.match(/\d+/)?.[0] ?? 0)
  check(
    'die Schätzung fällt, je weiter der Lauf ist',
    minutenAus(restText(fast)) < minutenAus(restText(neueRunde({ jetzt: T0 }))),
    `${restText(fast)} vs. ${restText(neueRunde({ jetzt: T0 }))}`,
  )
  let ganzFast = neueRunde({ jetzt: T0 })
  for (const e of ETAPPEN) ganzFast = setzeEtappe(ganzFast, e.schluessel, { status: 'fertig' })
  ganzFast = setzeEtappe(ganzFast, 'waechter', { status: 'laeuft', anteil: 0.5 })
  check('bei der letzten kurzen Etappe heißt es „ein bis zwei Minuten"', /ein bis zwei/.test(restText(ganzFast)), restText(ganzFast))
  check('nach dem Lauf gibt es keine Restschätzung', restText(schliesseRunde(fast, { jetzt: T0 })) === '')
  // Am 31.08. beim ersten echten Lauf gefunden: Eine Teil-Runde mit nur dem
  // Wächter meldete „noch etwa 22 Minuten", weil relativ statt absolut gerechnet
  // wurde. Eine Schätzung, die für Sekunden Arbeit eine halbe Stunde ansagt,
  // ist schlimmer als gar keine.
  const nurWaechter = neueRunde({ jetzt: T0, nur: ['waechter'] })
  check('eine kleine Teil-Runde sagt keine 22 Minuten an', /ein bis zwei/.test(restText(nurWaechter)), restText(nurWaechter))
  check('die volle Runde sagt rund zwanzig Minuten an', /2[0-4] Minuten/.test(restText(neueRunde({ jetzt: T0 }))), restText(neueRunde({ jetzt: T0 })))
  check('alles durch heißt „Alles auf dem neuesten Stand"', kopfText(schliesseRunde((() => { let x = neueRunde({ jetzt: T0 }); for (const e of ETAPPEN) x = setzeEtappe(x, e.schluessel, { status: 'fertig' }); return x })(), { jetzt: T0 })) === 'Alles auf dem neuesten Stand')
}

console.log('\n6) Der Zeitplan bleibt aus')
{
  const quelle = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')
  check('ROUTINEN_AUTOMATIK ist opt-in, nicht opt-out', /const ROUTINEN_AUTOMATIK = process\.env\.ROUTINEN_AUTOMATIK === '1'/.test(quelle))
  check('die Routinen hängen am Schalter', /if \(ROUTINEN_AUTOMATIK\) \{/.test(quelle))
  check('der Dream-Agent startet nicht mehr bei jedem Aufwachen', /if \(ROUTINEN_AUTOMATIK\) setTimeout\(\(\) => void maybeDream\(\), 5000\)/.test(quelle))
  check('der Autostart von Chrome bleibt ebenfalls aus', /const CHROME_AUTOSTART = process\.env\.CHROME_AUTOSTART === '1'/.test(quelle))
  check('die drei Endpunkte der Runde stehen', /url\.pathname === '\/runde'/.test(quelle) && /'\/runde\/start'/.test(quelle) && /'\/runde\/abbrechen'/.test(quelle))
  check('der Start antwortet sofort statt zu warten', /void starteRunde\(/.test(quelle))
  check('nur ein Lauf gleichzeitig', /if \(laufendeRunde\?\.status === 'laeuft'\) return rundeStand\(\)/.test(quelle))
  check('ein abgebrochener Lauf setzt den Stand nicht auf frisch', /if \(laufendeRunde\.status === 'fertig'\) \{\s*\n\s*markeSchreib\(RUNDE_MARKE/.test(quelle))
  check('die Runde öffnet Chrome nicht, sie prüft es', !/starteSyncChrome\(\)/.test(quelle.split('DIE RUNDE')[1] ?? ''))

  const kern = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')
  check('Leads-Sync hat einen bremsenlosen Kern', /async function tueLeadsSync/.test(kern))
  check('der Wächter hat einen bremsenlosen Kern', /async function tueWaechter/.test(kern))
  check('die Automatik ruft denselben Kern, kein zweiter Codepfad', /await tueLeadsSync\(\)/.test(kern) && /await tueWaechter\(\)/.test(kern))

  const netz = readFileSync(join(wurzel, 'runner/linkedin/netzwerk.mjs'), 'utf8')
  check('die Liste meldet ihren Fortschritt zurück', /fortschritt\(\{ geerntet: nachKey\.size, gesamt/.test(netz))
  check('eine kaputte Anzeige bringt den Lauf nicht zu Fall', /try \{\s*\n\s*fortschritt\(/.test(netz))
}

console.log('\n7) Der kurze Lauf — nur das Neue holen')
{
  const netz = readFileSync(join(wurzel, 'runner/linkedin/netzwerk.mjs'), 'utf8')
  const kern = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')

  check('leseListe kennt schon bekannte Schlüssel', /bekannt = null,/.test(netz))
  check('nur UNBEKANNTE zählen als „neu"', /if \(bekannt && !bekannt\.has\(eintrag\.profilKey\) && !nachKey\.has\(eintrag\.profilKey\)\) neueDieseRunde\+\+/.test(netz))
  check('zwei Runden ohne Neues beenden den Lauf', /const RUNDEN_OHNE_NEUE = 2/.test(netz) && /ohneNeue >= RUNDEN_OHNE_NEUE/.test(netz))
  // Die Regel, an der alles hängt: Ein kurzer Lauf darf niemandem den Status
  // nehmen. `vollstaendig` bleibt die einzige Erlaubnis dafür (netzwerkUpsert).
  check('der kurze Lauf beansprucht keine Vollständigkeit', /vollstaendig: istVollstaendig\(eintraege\.length, gesamt\)/.test(netz))
  check('der Abbruchgrund wird zurückgegeben', /abbruchGrund,/.test(netz))
  check('„nichts Neues" ist kein Abbruch-Fehler', /abbruchGrund === 'nichts-neues' \? '' :/.test(kern))

  check('die Runde lädt die bekannten Schlüssel', /async function bekannteProfilKeys/.test(kern))
  // Bei 1.090 offenen Einladungen wäre eine einzelne Abfrage neunzig zu kurz —
  // die fehlenden gälten jedes Mal als neu und trieben den Lauf bis zum Deckel.
  check('sie blättert über den 1000-Zeilen-Deckel', /offset=\$\{off\}/.test(kern) && /off \+= 1000/.test(kern))
  check('ohne Datenbank wird voll geblättert, nicht lückenhaft', /return new Set\(\)/.test(kern))
  check('der volle Durchlauf ist wöchentlich, nicht täglich', /NETZWERK_VOLL_ABSTAND_MS \?\? 7 \* 24 \* 60 \* 60 \* 1000/.test(kern))
  check('die Wochen-Marke fällt nur bei wirklich vollen Listen', /listen\.every\(\(e\) => e\.status === 'fertig'\)/.test(kern))
}

console.log('\n8) Live über die Brücke')
{
  const kern = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')
  const api = readFileSync(join(wurzel, 'app/src/cockpit/lib/rundeApi.ts'), 'utf8')

  check('der Runner spiegelt den Stand nach Supabase', /pushSnapshotKey\('runde_stand'/.test(kern))
  check('der Spiegel ist gedrosselt', /const RUNDE_SPIEGEL_MS = 2500/.test(kern))
  check('Etappenwechsel und Abschluss spiegeln sofort', (kern.match(/spiegleRunde\(\{ sofort: true \}\)/g) ?? []).length >= 3)
  check('das Handy kann eine Runde beauftragen', /job\.kind === 'runde'/.test(kern))
  check('der Auftrag wartet nicht auf den ganzen Lauf', /void starteRunde\(\{\s*\n\s*ausloeser: 'handy'/.test(kern))
  check('das Abbrechen geht auch über die Brücke', /job\.kind === 'runde_abbrechen'/.test(kern))

  check('die App wählt zwischen Draht und Brücke', /if \(runnerDirekt\(\)\) return hole\('\/runde'\)/.test(api))
  check('live wird der Spiegel gelesen', /leseSpiegel<RundeStand>\('runde_stand'\)/.test(api))
  check('live wird ein Auftrag abgelegt, nicht gewartet', /beauftrageRunnerOhneWarten\('runde'/.test(api))
  // Der Fall, der sonst ewig „lädt": Kevin klappt den Laptop zu, während der
  // Lauf läuft. Der Spiegel friert ein und behauptet weiter „läuft".
  check('ein eingefrorener Spiegel behauptet nicht „läuft"', /laeuft: gespiegelt\.data\.laeuft && !eingefroren/.test(api))
  check('die Grenze dafür sind zwei Minuten', /const SPIEGEL_GILT_MS = 2 \* 60 \* 1000/.test(api))
}

console.log(`\nverify-runde: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
