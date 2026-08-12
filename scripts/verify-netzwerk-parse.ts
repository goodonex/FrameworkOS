/**
 * Drift-Wache für das Lesen der Netzwerk-Seiten (12.08.2026).
 *
 * Diese Funktionen entscheiden, wer in Kevins InMail-Welle landet und wer als
 * „angenommen, nie angeschrieben" gilt. Ein Parser-Fehler ist hier teurer als
 * ein Absturz: er erzeugt eine Liste, die plausibel aussieht und falsch ist.
 *
 * Die Fixtures sind **wortgleich** aus dem laufenden Sync-Chrome abgegriffen
 * (12.08.2026), nicht erfunden.
 *
 * Start: npx tsx scripts/verify-netzwerk-parse.ts
 */
import {
  gesamtzahlAus,
  gesendetDatum,
  istVollstaendig,
  karteZuEintrag,
  profilKeyAus,
  vernetztDatum,
} from '../runner/linkedin/netzwerkParse.mjs'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-08-12T12:00:00.000Z')

// --- 1. Der Profil-Schlüssel -------------------------------------------
check(
  'echte Einladungs-URL',
  profilKeyAus('https://www.linkedin.com/in/josef-seibold-728710112/') === 'josef-seibold-728710112',
)
check('ohne Schrägstrich am Ende', profilKeyAus('https://www.linkedin.com/in/aram-jaber-323955280') === 'aram-jaber-323955280')
check('mit Query', profilKeyAus('https://www.linkedin.com/in/dirk-fleckenstein-571a12244/?trk=abc') === 'dirk-fleckenstein-571a12244')
check('Grossschreibung wird vereinheitlicht', profilKeyAus('https://www.linkedin.com/in/Max-Muster/') === 'max-muster')
check('Umlaut-Kodierung wird aufgelöst', profilKeyAus('https://www.linkedin.com/in/j%C3%BCrgen-hall/') === 'jürgen-hall')
for (const [was, wert] of [
  ['leer', ''],
  ['null', null],
  ['undefined', undefined],
  ['fremde URL', 'https://example.com/foo'],
  ['Firmenseite', 'https://www.linkedin.com/company/herrmann/'],
  ['nur /in/', 'https://www.linkedin.com/in/'],
] as const) {
  check(`kein Schlüssel aus ${was}`, profilKeyAus(wert as unknown as string) === null)
}

// --- 2. Datum der Kontaktliste (absolut) -------------------------------
check('„Am 10. August 2026 vernetzt"', vernetztDatum('Am 10. August 2026 vernetzt')?.getFullYear() === 2026)
check('Monat trifft (August = 7)', vernetztDatum('Am 10. August 2026 vernetzt')?.getMonth() === 7)
check('Tag trifft', vernetztDatum('Am 10. August 2026 vernetzt')?.getDate() === 10)
check('März mit Umlaut', vernetztDatum('Am 3. März 2026 vernetzt')?.getMonth() === 2)
check('Maerz ohne Umlaut', vernetztDatum('Am 3. Maerz 2026 vernetzt')?.getMonth() === 2)
check('kein Datum in einer Einladungs-Zeile', vernetztDatum('Vor 53 Minuten gesendet') === null)
check('Unsinn ergibt kein Datum', vernetztDatum('irgendwas') === null)
check('erfundener Monat ergibt kein Datum', vernetztDatum('Am 3. Foobar 2026 vernetzt') === null)

// --- 3. Datum der Einladungsliste (relativ) ----------------------------
const min53 = gesendetDatum('Vor 53 Minuten gesendet', JETZT)
check('„Vor 53 Minuten" liegt 53 Minuten zurück', min53 !== null && Math.round((JETZT.getTime() - min53.getTime()) / 60000) === 53)
const wo3 = gesendetDatum('Vor 3 Wochen gesendet', JETZT)
check('„Vor 3 Wochen" liegt 21 Tage zurück', wo3 !== null && Math.round((JETZT.getTime() - wo3.getTime()) / 86_400_000) === 21)
const mo2 = gesendetDatum('Vor 2 Monaten gesendet', JETZT)
check('„Vor 2 Monaten" liegt ~60 Tage zurück', mo2 !== null && Math.round((JETZT.getTime() - mo2.getTime()) / 86_400_000) === 60)
check('„Vor 1 Tag"', gesendetDatum('Vor 1 Tag gesendet', JETZT) !== null)
check('„Vor 5 Stunden"', gesendetDatum('Vor 5 Stunden gesendet', JETZT) !== null)
check('„Vor 1 Jahr"', gesendetDatum('Vor 1 Jahr gesendet', JETZT) !== null)
check('ohne Zahl kein Datum', gesendetDatum('Vor kurzem gesendet', JETZT) === null)
check('leer ergibt null', gesendetDatum('', JETZT) === null)
check(
  'ein relatives Datum liegt nie in der Zukunft',
  (gesendetDatum('Vor 1 Minuten gesendet', JETZT)?.getTime() ?? Infinity) <= JETZT.getTime(),
)

// --- 4. Ganze Karten, wortgleich aus dem Browser ------------------------
const einladung = karteZuEintrag(
  {
    href: 'https://www.linkedin.com/in/josef-seibold-728710112/',
    nameAusBild: 'Josef Seibolds Profilbild',
    zeilen: [
      'Einladungen verwalten',
      'Eingegangen',
      'Gesendet',
      'Personen (882)',
      'Josef Seibold',
      'Geschäftsführer bei Vid Immobilien GmbH',
      'Vor 53 Minuten gesendet',
      'Zurückziehen',
    ],
  },
  JETZT,
)
check('Einladung: Name', einladung?.name === 'Josef Seibold')
check('Einladung: Headline', einladung?.headline === 'Geschäftsführer bei Vid Immobilien GmbH')
check('Einladung: Schlüssel', einladung?.profilKey === 'josef-seibold-728710112')
check('Einladung: Sendedatum gesetzt', typeof einladung?.eingeladenAt === 'string')
check(
  'Einladung: KEIN Annahmedatum — sie ist ja offen',
  einladung?.angenommenAt === null,
  'Ein Annahmedatum hier würde die Person fälschlich zum Kontakt machen.',
)
check(
  'Einladung: die Seiten-Navigation landet nicht im Namen',
  !/Einladungen verwalten|Personen/.test(einladung?.name ?? ''),
)

const kontakt = karteZuEintrag(
  {
    href: 'https://www.linkedin.com/in/felix-moosbauer-123/',
    nameAusBild: 'Felix Moosbauers Profilbild',
    zeilen: [
      '642 Kontakte',
      'Sortieren nach:',
      'Sortieren nach: Neu hinzugefügt',
      'Neu hinzugefügt',
      'Mit Filtern suchen',
      'Felix Moosbauer',
      'Geschäftsführender Gesellschafter bei FMD Invest GmbH | Immobilien, Projektmanagement Immobilien',
      'Am 10. August 2026 vernetzt',
    ],
  },
  JETZT,
)
check('Kontakt: Name', kontakt?.name === 'Felix Moosbauer')
check('Kontakt: Headline vollständig', (kontakt?.headline ?? '').includes('FMD Invest GmbH'))
check('Kontakt: Annahmedatum gesetzt', typeof kontakt?.angenommenAt === 'string')
check('Kontakt: kein erfundenes Sendedatum', kontakt?.eingeladenAt === null)
check('Kontakt: Sortier-Bedienelemente sind kein Name', kontakt?.name !== 'Sortieren nach:')

const ohneHeadline = karteZuEintrag(
  {
    href: 'https://www.linkedin.com/in/dieter-brunner-744979217/',
    nameAusBild: 'Dieter Brunners Profilbild',
    zeilen: ['Dieter Brunner', '--', 'Vor 53 Minuten gesendet', 'Zurückziehen'],
  },
  JETZT,
)
check('„--" wird nicht als Headline gespeichert', ohneHeadline?.headline === '')
check('Name trotzdem da', ohneHeadline?.name === 'Dieter Brunner')

// Der Rückfall aufs Profilbild und die Genitiv-Falle darin: „Josef Seibolds
// Profilbild" braucht das s weg, „Karen Dierks Profilbild" nicht. Der
// Profil-Schlüssel entscheidet.
const nurBild = karteZuEintrag(
  {
    href: 'https://www.linkedin.com/in/karen-dierks-32195/',
    nameAusBild: 'Karen Dierks Profilbild',
    zeilen: ['Personen (882)', 'Vor 3 Wochen gesendet'],
  },
  JETZT,
)
check(
  'Name auf -s bleibt erhalten, weil der Schlüssel ihn bestätigt',
  nurBild?.name === 'Karen Dierks',
  `Ist: ${nurBild?.name}`,
)
const genitiv = karteZuEintrag(
  {
    href: 'https://www.linkedin.com/in/josef-seibold-728710112/',
    nameAusBild: 'Josef Seibolds Profilbild',
    zeilen: ['Personen (882)', 'Vor 3 Wochen gesendet'],
  },
  JETZT,
)
check(
  'das Genitiv-s fliegt, wenn der Schlüssel es nicht kennt',
  genitiv?.name === 'Josef Seibold',
  `Ist: ${genitiv?.name}`,
)
check(
  'ein Name ohne s bleibt unangetastet',
  karteZuEintrag(
    { href: 'https://www.linkedin.com/in/dirk-fleckenstein-571a12244/', nameAusBild: 'Dirk Fleckenstein Profilbild', zeilen: ['Personen (882)'] } as never,
    JETZT,
  )?.name === 'Dirk Fleckenstein',
)

check('ohne Profil-URL kein Eintrag', karteZuEintrag({ href: 'https://example.com', zeilen: ['X'] } as never, JETZT) === null)
check('ohne Namen kein Eintrag', karteZuEintrag({ href: 'https://www.linkedin.com/in/x-1/', zeilen: [] } as never, JETZT) === null)
check('leere Zeilen brechen nichts', karteZuEintrag({ href: 'https://www.linkedin.com/in/x-1/' } as never, JETZT) === null)

// --- 5. Gesamtzahl + Vollständigkeit ------------------------------------
check('„Personen (882)"', gesamtzahlAus('Einladungen verwalten Eingegangen Gesendet Personen (882) Josef') === 882)
check('„642 Kontakte"', gesamtzahlAus('642 Kontakte Sortieren nach:') === 642)
check('Tausenderpunkt', gesamtzahlAus('1.204 Kontakte') === 1204)
check('nichts Zählbares', gesamtzahlAus('irgendein Text') === null)

check('882 von 882 ist vollständig', istVollstaendig(882, 882))
check('870 von 882 gilt als vollständig (Puffer)', istVollstaendig(870, 882))
check(
  '500 von 882 ist NICHT vollständig',
  !istVollstaendig(500, 882),
  'Sonst kippte ein abgebrochener Lauf 380 Leute aus der InMail-Liste.',
)
check('0 von 882 ist nicht vollständig', !istVollstaendig(0, 882))
check('ohne Gesamtzahl nie vollständig', !istVollstaendig(100, null as unknown as number))
check('Gesamtzahl 0 ist nie vollständig', !istVollstaendig(0, 0))

console.log(`\nverify-netzwerk-parse: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
