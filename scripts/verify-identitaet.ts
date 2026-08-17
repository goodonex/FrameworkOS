/**
 * Drift-Wache für das Identity-OS (16.08.2026).
 *
 * Geprüft wird, was hier still falsch werden kann:
 *
 * 1. **Die Serien.** Eine Clean-Serie, die morgens auf 0 fällt, weil der Tag
 *    noch offen ist, wäre demotivierend und falsch. Eine Vertriebs-Serie, die
 *    am Montag reißt, weil Samstag kein Block lief, wäre schlicht ein Fehler.
 *    Beide Regeln stehen in `identityStreak.ts` und werden hier festgenagelt.
 * 2. **Das Board gegen den Bilder-Ordner.** Ein Eintrag ohne Datei ist ein
 *    kaputtes Bild in der Morgenlese; eine Datei ohne Eintrag ist ein Bild,
 *    das Kevin ausgewählt hat und das niemand je sieht. Beide Richtungen.
 * 3. **Der Check-in gegen Migration 0072.** Ein Feld, das die Tabelle nicht
 *    hat, scheitert erst beim Speichern — also beim Benutzen.
 *
 * Start: npx tsx scripts/verify-identitaet.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  ANTI_VISION,
  CHECKIN_EINHEITEN,
  HERO_BILD,
  KAPITEL,
  MORGENLESE,
  PORTRAET_BILD,
  REGELN,
  VERHALTEN,
  VISIONSTEXT,
  WARUM,
} from '../app/src/cockpit/lib/identityInhalte'
import { VISIONBOARD, alleBoardBilder, boardPfad } from '../app/src/cockpit/lib/visionboard'
import {
  istWochenende,
  laengsteSerie,
  laufendeSerie,
  letzteTage,
  tagDavor,
  tagZaehlt,
  type StreakTag,
} from '../app/src/cockpit/lib/identityStreak'
import { COCKPIT_BEREICHE } from '../app/src/cockpit/lib/bereiche'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p: string) => readFileSync(join(wurzel, p), 'utf8')

let pass = 0
let fail = 0
function check(label: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a === b) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${b}, bekommen ${a}`)
  }
}
function wahr(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? ` — ${hinweis}` : ''}`)
  }
}

// ---------------------------------------------------------------------------
// Die Kalender-Annahme, auf der alle Wochenend-Fälle stehen
// ---------------------------------------------------------------------------
const FR = '2026-08-14'
const SA = '2026-08-15'
const SO = '2026-08-16'
const MO = '2026-08-17'
const DI = '2026-08-18'

wahr('14.08.2026 ist ein Werktag (Freitag)', !istWochenende(FR))
wahr('15.08.2026 ist Wochenende', istWochenende(SA))
wahr('16.08.2026 ist Wochenende', istWochenende(SO))
wahr('17.08.2026 ist ein Werktag (Montag)', !istWochenende(MO))

check('tagDavor rechnet über den Monatswechsel', tagDavor('2026-09-01'), '2026-08-31')
check('tagDavor rechnet über den Jahreswechsel', tagDavor('2027-01-01'), '2026-12-31')
wahr('Vertriebsblock zählt samstags nicht', !tagZaehlt('vertriebsblock', SA))
wahr('Clean zählt samstags', tagZaehlt('clean', SA))
wahr('Sport zählt samstags', tagZaehlt('sport', SA))

// ---------------------------------------------------------------------------
// Serien
// ---------------------------------------------------------------------------
const leer: StreakTag[] = []
const zeile = (datum: string, felder: Partial<Omit<StreakTag, 'datum'>>): StreakTag => ({
  datum,
  vertriebsblock: false,
  clean: false,
  sport: false,
  morgenlese: false,
  ...felder,
})

check('ohne Einträge keine Serie', laufendeSerie(leer, 'clean', SO).laenge, 0)
check('ohne Einträge kein letzter Tag', laufendeSerie(leer, 'clean', SO).letzterTag, null)

// Der laufende Tag bricht nichts (Fachregel 1).
check(
  'heute abgehakt zählt sofort',
  laufendeSerie([zeile(SO, { clean: true })], 'clean', SO).laenge,
  1,
)
const offen = laufendeSerie([zeile(SA, { clean: true })], 'clean', SO)
check('heute offen, gestern gesetzt → Serie läuft weiter', offen.laenge, 1)
wahr('heute offen wird als solches gemeldet', offen.heuteOffen)
check(
  'heute UND gestern offen → Serie ist gerissen',
  laufendeSerie([zeile(FR, { clean: true })], 'clean', SO).laenge,
  0,
)
wahr(
  'gerissene Serie meldet nicht „heute offen"',
  !laufendeSerie([zeile(FR, { clean: true })], 'clean', SO).heuteOffen,
)

check(
  'lückenlose Clean-Kette zählt jeden Tag',
  laufendeSerie([zeile(FR, { clean: true }), zeile(SA, { clean: true }), zeile(SO, { clean: true })], 'clean', SO)
    .laenge,
  3,
)
check(
  'eine Lücke beendet die Kette',
  laufendeSerie(
    [zeile('2026-08-12', { clean: true }), zeile(SA, { clean: true }), zeile(SO, { clean: true })],
    'clean',
    SO,
  ).laenge,
  2,
)
check(
  'ein false-Eintrag zählt wie ein fehlender Tag',
  laufendeSerie([zeile(SA, { clean: false }), zeile(SO, { clean: true })], 'clean', SO).laenge,
  1,
)

// Fachregel 2: Wochenenden überspringen, nicht brechen.
const vertriebMontag = laufendeSerie([zeile(FR, { vertriebsblock: true })], 'vertriebsblock', MO)
check('Vertriebs-Serie überlebt das Wochenende', vertriebMontag.laenge, 1)
wahr('am Montag früh gilt der Tag als offen', vertriebMontag.heuteOffen)
check(
  'Vertriebs-Serie zählt nur Werktage',
  laufendeSerie(
    [
      zeile('2026-08-13', { vertriebsblock: true }),
      zeile(FR, { vertriebsblock: true }),
      zeile(SA, { vertriebsblock: true }), // Samstag zählt nicht mit
      zeile(MO, { vertriebsblock: true }),
    ],
    'vertriebsblock',
    MO,
  ).laenge,
  3,
)
check(
  'Clean reisst am Wochenende sehr wohl',
  laufendeSerie([zeile(FR, { clean: true })], 'clean', SO).laenge,
  0,
)
check(
  'am Sonntag schaut die Vertriebs-Serie auf den Freitag',
  laufendeSerie([zeile(FR, { vertriebsblock: true })], 'vertriebsblock', SO).letzterTag,
  FR,
)

check(
  'Einträge in der Zukunft erfinden keine Serie',
  laufendeSerie([zeile(DI, { clean: true })], 'clean', SO).laenge,
  0,
)

// Rekord
check('Rekord ohne Einträge ist 0', laengsteSerie(leer, 'clean'), 0)
check(
  'Rekord findet die längste vergangene Kette',
  laengsteSerie(
    [
      zeile('2026-07-01', { clean: true }),
      zeile('2026-07-02', { clean: true }),
      zeile('2026-07-03', { clean: true }),
      zeile('2026-08-10', { clean: true }),
    ],
    'clean',
  ),
  3,
)
check(
  'Rekord der Vertriebs-Serie überspringt Wochenenden',
  laengsteSerie(
    [zeile('2026-08-13', { vertriebsblock: true }), zeile(FR, { vertriebsblock: true }), zeile(MO, { vertriebsblock: true })],
    'vertriebsblock',
  ),
  3,
)

// Punktreihe
const punkte = letzteTage([zeile(SO, { clean: true })], 'clean', SO, 7)
check('Punktreihe hat sieben Tage', punkte.length, 7)
check('neuester Tag steht zuletzt', punkte[punkte.length - 1].datum, SO)
wahr('heute ist als heute markiert', punkte[punkte.length - 1].heute)
wahr('gesetzter Tag ist gefüllt', punkte[punkte.length - 1].gesetzt)
check(
  'die Vertriebs-Punktreihe enthält keine Wochenenden',
  letzteTage(leer, 'vertriebsblock', MO, 7).filter((t) => istWochenende(t.datum)),
  [],
)

// ---------------------------------------------------------------------------
// Board gegen den Bilder-Ordner — beide Richtungen
// ---------------------------------------------------------------------------
const bilderOrdner = 'app/public/identity'
const dateienImOrdner = readdirSync(join(wurzel, bilderOrdner)).filter((f) => !f.startsWith('.'))
const dateienImBoard = alleBoardBilder().map((b) => b.datei)
// Neben dem Board benutzt die Seite sechs weitere Bilder: den Hero, vier
// Kapitel-Banner und das Porträt neben dem Visionstext.
const dateienDrumherum = [HERO_BILD, PORTRAET_BILD, ...Object.values(KAPITEL).map((k) => k.bild)]
const alleBenutzten = [...dateienImBoard, ...dateienDrumherum]

check(
  'jedes Board-Bild liegt als Datei vor',
  dateienImBoard.filter((d) => !dateienImOrdner.includes(d)),
  [],
)
check(
  'Hero, Kapitel-Banner und Porträt liegen als Datei vor',
  dateienDrumherum.filter((d) => !dateienImOrdner.includes(d)),
  [],
)
check(
  'jede Datei im Ordner wird auch benutzt',
  dateienImOrdner.filter((d) => !alleBenutzten.includes(d)),
  [],
)
check('kein Bild wird doppelt eingebunden', alleBenutzten.length, new Set(alleBenutzten).size)
wahr('das Board ist nicht leer', dateienImBoard.length > 0)
check('vier Kapitel mit Bild', Object.keys(KAPITEL).length, 4)

// Die Uhren stehen aufsteigend nach Preis — Kevins Kuration aus board-final.html.
const uhren = VISIONBOARD.find((g) => g.id === 'uhren')
// Uhren werden vollständig gezeigt, nicht beschnitten (Vorlage).
wahr('die Uhren-Gruppe steht auf „vollständig"', uhren?.vollstaendig === true)
check(
  'die Uhren stehen in Preisreihenfolge',
  uhren?.bilder.map((b) => b.datei),
  [
    'uhr-yachtmaster-126622.jpg',
    'uhr-rolex-daydate-228239.jpg',
    'uhr-ap-royaloak-26735SG.jpg',
    'uhr-adg-honey-pearl.jpg',
    'uhr-rm88-smiley.jpg',
  ],
)
check('jedes Board-Bild hat einen Titel', alleBoardBilder().filter((b) => !b.titel.trim()), [])
check('boardPfad zeigt in den öffentlichen Ordner', boardPfad('x.jpg'), '/identity/x.jpg')

// Kein Bild darf so groß sein, dass die Morgenlese am Handy hängt.
const zuGross = dateienImOrdner.filter(
  (d) => readFileSync(join(wurzel, bilderOrdner, d)).byteLength > 400_000,
)
check('kein Board-Bild über 400 KB', zuGross, [])

// ---------------------------------------------------------------------------
// Check-in gegen Migration 0072
// ---------------------------------------------------------------------------
const migration = lies('supabase/migrations/0072_identity_checkins.sql')
for (const e of CHECKIN_EINHEITEN) {
  wahr(`Migration kennt die Spalte ${e.feld}`, new RegExp(`\\b${e.feld}\\b\\s+boolean`).test(migration))
}
wahr('Migration kennt energie', /\benergie\b\s+smallint/.test(migration))
for (const feld of ['dankbar_1', 'dankbar_2', 'dankbar_3']) {
  wahr(`Migration kennt ${feld}`, new RegExp(`\\b${feld}\\b\\s+text`).test(migration))
}
wahr(
  'der Schlüssel ist derselbe wie bei daily_metrics',
  /unique\s*\(\s*user_id\s*,\s*brand_id\s*,\s*datum\s*\)/.test(migration),
)
wahr('RLS ist eingeschaltet', /alter table identity_checkins enable row level security/.test(migration))
wahr('die Energie-Skala ist in der DB begrenzt', /energie\s*>=\s*1\s*and\s*energie\s*<=\s*10/.test(migration))

// Der Hook schreibt genau die Felder, die es gibt — kein Tippfehler-Feld.
const hook = lies('app/src/cockpit/lib/useIdentityCheckin.ts')
wahr('der Hook schreibt auf identity_checkins', /from\('identity_checkins'\)/.test(hook))
// „Heute" muss aus derselben LOKALEN Uhr kommen wie daily_metrics
// (metricsDates.toIsoDate). isoTag rechnet UTC: zwischen 0 und 2 Uhr deutscher
// Zeit wäre der Abend-Check-in sonst auf dem Vortag gelandet — gefunden beim
// Review am 17.08. um kurz nach Mitternacht, als die Vorschau „16. August" zeigte.
wahr('der Hook nimmt das Datum aus toIsoDate (lokal)', /toIsoDate\(new Date\(\)\)/.test(hook))
wahr('der Hook nimmt das Datum NICHT aus isoTag (UTC)', !/isoTag\(new Date\(\)\)/.test(hook))
wahr(
  'der Hook nutzt denselben Konflikt-Schlüssel',
  /onConflict:\s*'user_id,brand_id,datum'/.test(hook),
)
wahr('der Hook erkennt eine fehlende Tabelle', /PGRST205/.test(hook))

// daily_metrics bleibt unangetastet (HANDOFF: „Keine neuen Metrikfelder").
const metrikFelder = lies('app/src/cockpit/lib/metrikFelder.ts')
for (const feld of ['vertriebsblock', 'clean', 'sport', 'energie', 'dankbar']) {
  wahr(`${feld} ist KEIN daily_metrics-Feld`, !metrikFelder.includes(`'${feld}'`))
}

// ---------------------------------------------------------------------------
// Verdrahtung: Registry, Route, Icon
// ---------------------------------------------------------------------------
const bereich = COCKPIT_BEREICHE.find((b) => b.path === '/identitaet')
wahr('der Bereich steht in der Registry', Boolean(bereich))
check('der Bereich heißt Identität', bereich?.label, 'Identität')
const icons = lies('app/src/cockpit/components/BereichIcon.tsx')
wahr('das Bereichs-Zeichen ist gezeichnet', new RegExp(`\\b${bereich?.icon}:`).test(icons))

const app = lies('app/src/App.tsx')
wahr('die Route ist gemountet', /path="\/identitaet"/.test(app))
wahr('die Route liegt in der Cockpit-Shell', app.indexOf('path="/identitaet"') < app.indexOf('<Route path="/" element={<Navigate'))

// Die Seite muss pointer-events setzen (#app-ui-overlay-Falle vom 08.07.).
const css = lies('app/src/styles/cockpit.css')
wahr('.ck-ident setzt pointer-events', /\.ck-ident\s*\{[^}]*pointer-events:\s*auto/.test(css))

// Das Randlos-Margin muss zum .ck-main-Innenabstand passen: 12px mobil,
// 18px Desktop (cockpit.css:660 vs. :1192). Mit nur -12px stünde am Desktop
// ein 6px-Streifen Seitenverlauf um Hero und Banner — Review-Fund vom 17.08.
wahr('mobil: Randlos-Margin -12px', /\.ck-ident\s*\{[^}]*margin:\s*-12px -12px 0/.test(css))
wahr(
  'Desktop: Randlos-Margin -18px im 901px-Block',
  /@media \(min-width: 901px\)[\s\S]{0,400}\.ck-ident\s*\{\s*margin:\s*-18px -18px 0/.test(css),
)

// Der Ein-Klick-Weg morgens: Homescreen-Zeile (vor 11 Uhr) und der Knopf auf
// /morgen (Ziel des Push) führen beide nach /identitaet.
const home = lies('app/src/cockpit/pages/UrielHome.tsx')
wahr('Homescreen: Morgenlese-Zeile navigiert nach /identitaet', /ck-morgenlese-zeile/.test(home) && /navigate\('\/identitaet'\)/.test(home))
wahr('Homescreen: die Zeile ist zeitgebunden (vor 11 Uhr)', /getHours\(\) < 11/.test(home))
const morgen = lies('app/src/cockpit/pages/MorgenArea.tsx')
wahr('/morgen hat den Morgenlese-Knopf', /navigate\('\/identitaet'\)/.test(morgen))
wahr('die Morgenlese-Zeile ist gestylt', /\.ck-morgenlese-zeile\s*\{[^}]*min-height:\s*(4[4-9]|5\d)px/.test(css))

// Touch-Ziele: die Check-in-Zeile und der Aufklapper müssen ≥ 44px hoch sein.
const zeileHoehe = css.match(/\.ck-ident-zeile\s*\{[^}]*min-height:\s*(\d+)px/)
wahr('die Check-in-Zeile ist ≥ 44px hoch', Number(zeileHoehe?.[1] ?? 0) >= 44, `gemessen ${zeileHoehe?.[1]}px`)
const summaryHoehe = css.match(/\.ck-ident-summary\s*\{[^}]*min-height:\s*(\d+)px/)
wahr('der Aufklapper ist ≥ 44px hoch', Number(summaryHoehe?.[1] ?? 0) >= 44, `gemessen ${summaryHoehe?.[1]}px`)
// Am 16.08. im laufenden Cockpit gemessen: der Regler stand auf 34px und war
// damit das einzige Touch-Ziel der Seite unter der Grenze.
const reglerHoehe = css.match(/\.ck-ident-regler\s*\{[^}]*height:\s*(\d+)px/)
wahr('der Energie-Regler ist ≥ 44px hoch', Number(reglerHoehe?.[1] ?? 0) >= 44, `gemessen ${reglerHoehe?.[1]}px`)

// ---------------------------------------------------------------------------
// Die Inhalte sind da (eine leere Morgenlese fällt sonst erst morgens auf)
// ---------------------------------------------------------------------------
wahr('die Morgenlese hat einen Leitsatz', MORGENLESE.leitsatz.length > 20)
check('die Morgenlese hat drei Sätze', MORGENLESE.saetze.length, 3)
check('vier nicht verhandelbare Standards', MORGENLESE.standards.length, 4)
check('drei Afformationen', MORGENLESE.afformationen.length, 3)
wahr('die Routine nennt den Vertriebsblock', /60–90 Minuten/.test(MORGENLESE.routine.kern))
wahr('das Warum nennt die 10.000 €', MORGENLESE.warum.includes('10.000'))
check('drei Check-in-Einheiten', CHECKIN_EINHEITEN.length, 3)
wahr('die Verhaltens-Identität ist gefüllt', VERHALTEN.length >= 5)
wahr('die Anti-Vision ist gefüllt', ANTI_VISION.length >= 5)
wahr('das Warum hat einen Kern', WARUM.kern.length > 20)
wahr('der Visionstext ist vollständig', VISIONSTEXT.length >= 9)
wahr('der Visionstext beginnt mit dem Namen', VISIONSTEXT[0].startsWith('Kevin Herrmann'))
check('neun Regeln', REGELN.length, 9)
check('genau eine Regel ist betont', REGELN.filter((r) => r.betont).length, 1)
wahr('betont ist die Vertriebsregel', REGELN.find((r) => r.betont)?.titel === 'Vertrieb')

// Scrim-Pflicht: über jedem Bild mit Text liegt ein Verlauf, und der Text
// darüber trägt zusätzlich einen Schatten (DESIGN-TOKENS, Foto-Ambiente).
wahr('der Hero hat einen Scrim', /\.ck-ident-hero-scrim\s*\{[^}]*linear-gradient/.test(css))
wahr('der Kapitel-Banner hat einen Scrim', /\.ck-ident-banner-scrim\s*\{[^}]*linear-gradient/.test(css))
wahr('der Hero-Leitsatz trägt einen Textschatten', /\.ck-ident-leitsatz\s*\{[^}]*text-shadow/.test(css))
wahr('der Banner-Titel trägt einen Textschatten', /\.ck-ident-banner-titel\s*\{[^}]*text-shadow/.test(css))
// Gestapelt wird mit positiven z-index — negative rutschen hinter den
// Hintergrund von .ck-root (position: fixed) und das Bild verschwindet.
wahr('kein negativer z-index in der Identity-Sektion', !/\.ck-ident-[a-z-]*\s*\{[^}]*z-index:\s*-/.test(css))

// ---------------------------------------------------------------------------
// Morgenlese-Serie + Vorlesen (0073, 17.08.)
// ---------------------------------------------------------------------------
const migration73 = lies('supabase/migrations/0073_identity_morgenlese.sql')
wahr('0073 ergaenzt die Spalte morgenlese', /add column if not exists morgenlese boolean not null default false/.test(migration73))
wahr('der Hook laedt morgenlese mit', /select\('datum, vertriebsblock, clean, sport, morgenlese,/.test(hook))
// Die Morgenlese zaehlt JEDEN Kalendertag (Regel 1) — wie Clean, anders als
// der Vertriebsblock.
wahr('Morgenlese zaehlt samstags', tagZaehlt('morgenlese', SA))
check(
  'Morgenlese-Serie reisst am Wochenende',
  laufendeSerie([zeile(FR, { morgenlese: true })], 'morgenlese', SO).laenge,
  0,
)
check(
  'lueckenlose Morgenlese-Kette zaehlt jeden Tag',
  laufendeSerie(
    [zeile(FR, { morgenlese: true }), zeile(SA, { morgenlese: true }), zeile(SO, { morgenlese: true })],
    'morgenlese',
    SO,
  ).laenge,
  3,
)
const ansicht = lies('app/src/cockpit/components/identitaet/IdentitaetAnsicht.tsx')
wahr('der Gelesen-Haken sitzt in der Ansicht', /umschalten\('morgenlese'\)/.test(ansicht))
wahr('das Streak-Band traegt die Morgenlese-Kachel', /feld="morgenlese"/.test(lies('app/src/cockpit/components/identitaet/StreakBand.tsx')))
const vorlesen = lies('app/src/cockpit/components/identitaet/VisionstextVorlesen.tsx')
wahr('Vorlesen: eigene Aufnahme hat Vorrang', /visionstext\.m4a/.test(vorlesen) && /visionstext\.mp3/.test(vorlesen))
wahr('Vorlesen: SPA-Falle wird ueber content-type abgefangen', /startsWith\('audio'\)/.test(vorlesen))
wahr('Vorlesen: Systemstimme als Rueckfall', /speechSynthesis/.test(vorlesen))
wahr('Vorlesen: Aufraeumen beim Verlassen', /useEffect\(\(\) => stopp, \[stopp\]\)/.test(vorlesen))
wahr('Vorlesen haengt am Visionstext', /VisionstextVorlesen/.test(ansicht))

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
