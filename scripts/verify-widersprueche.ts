/**
 * Drift-Wache für den Widerspruchs-Wächter (17.08.2026).
 *
 * Der Wächter ist die Antwort auf einen Fehler, der vier Wochen überlebt hat,
 * weil alle Prüfungen grün waren: Sie prüften jede Funktion gegen ausgedachte
 * Beispieldaten, nie zwei Quellen gegeneinander. Damit der Wächter selbst nicht
 * dasselbe Schicksal erleidet, wird hier beides geprüft — dass er anschlägt,
 * wenn ein Satz verletzt ist, UND dass er bei sauberen Daten schweigt. Ein
 * Wächter, der immer piept, wird weggeklickt; einer, der nie piept, ist Deko.
 *
 * Start: npx tsx scripts/verify-widersprueche.ts
 */
import { pruefeWidersprueche } from '../runner/widersprueche.mjs'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) {
    pass++
    console.log(`  ok: ${label}`)
  } else {
    fail++
    console.error(`  FEHLT: ${label}${hinweis ? ` — ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-08-17T14:00:00Z')
const vorStunden = (h: number) => new Date(JETZT.getTime() - h * 3_600_000).toISOString()

/** Ein Datenstand, in dem alle Sätze erfüllt sind — die Ruhelage. */
const sauber = {
  netzwerk: [{ name: 'Neu Kontakt', status: 'angenommen', zuletzt_gesehen_at: vorStunden(2) }],
  threads: [{ name: 'Steven Koller', last_from: 'them', last_synced_at: vorStunden(1) }],
  erstnachrichten: [{ name: 'Anna Neu', status: 'offen' }],
  // Beide Listen mit eigenem Stempel: Seit dem 18.08. entscheidet je Status die
  // EIGENE Liste, ob ein Eintrag veraltet ist (offen → einladungen).
  netzMeta: {
    kontakte: { vollAt: vorStunden(3), gesamt: 659, geerntet: 659 },
    einladungen: { vollAt: vorStunden(3), gesamt: 957, geerntet: 950 },
  },
  runs: [{ status: 'done', finished: vorStunden(6), started: vorStunden(6) }],
}
const schluessel = (d: any) => pruefeWidersprueche(d, JETZT).befunde.map((b: any) => b.schluessel)

console.log('Widerspruchs-Wächter:')
check('saubere Daten erzeugen keinen einzigen Befund', schluessel(sauber).length === 0,
  schluessel(sauber).join(', '))

// Satz 1 — der Originalfehler vom 17.08.
const mitThread = {
  ...sauber,
  erstnachrichten: [{ name: 'Steven Koller', status: 'offen' }, { name: 'Anna Neu', status: 'offen' }],
}
check('offene Erstnachricht trotz Thread wird gemeldet',
  schluessel(mitThread).includes('erstnachricht_trotz_thread'))
check('dieser Befund ist dringend',
  pruefeWidersprueche(mitThread, JETZT).befunde.find((b: any) => b.schluessel === 'erstnachricht_trotz_thread')?.schwere === 'hoch')
check('die Antwort des Leads steht in der Meldung',
  /geantwortet/.test(pruefeWidersprueche(mitThread, JETZT).befunde[0].text))
// Kevins Einwand vom 18.08.: Eine InMail an jemanden mit OFFENER Anfrage ist
// auch ein Thread — aber die vorbereitete Erstnachricht ging dann nie raus.
const ausInMail = {
  ...sauber,
  erstnachrichten: [{ name: 'Steven Koller', status: 'offen' }],
  netzwerk: [{ name: 'Steven Koller', status: 'offen', zuletzt_gesehen_at: vorStunden(1) }],
}
check('der InMail-Fall wird in der Meldung getrennt ausgewiesen',
  /Einladung noch offen/.test(pruefeWidersprueche(ausInMail, JETZT).befunde
    .find((b: any) => b.schluessel === 'erstnachricht_trotz_thread')?.text ?? ''),
  'Sonst hakt ein Sammelklick Nachrichten ab, die nie jemand gelesen hat.')
check('und der Handgriff sagt, dass man die vorher ansieht',
  /vorher ansehen/.test(pruefeWidersprueche(ausInMail, JETZT).befunde
    .find((b: any) => b.schluessel === 'erstnachricht_trotz_thread')?.tun ?? ''))
check('DER FALL 18.08.: bei angenommener Einladung bleibt es beim einfachen Handgriff',
  /Als verschickt verbuchen/.test(pruefeWidersprueche({
    ...sauber,
    erstnachrichten: [{ name: 'Steven Koller', status: 'offen' }],
    netzwerk: [{ name: 'Steven Koller', status: 'angenommen', zuletzt_gesehen_at: vorStunden(1) }],
  }, JETZT).befunde.find((b: any) => b.schluessel === 'erstnachricht_trotz_thread')?.tun ?? ''),
  'Alle 78 vom 18.08. waren dieser Fall — die Meldung darf dort nicht warnen.')

check('ein abgehakter Lead löst nichts aus',
  schluessel({ ...sauber, erstnachrichten: [{ name: 'Steven Koller', status: 'gesendet' }] }).length === 0)
check('Groß-/Kleinschreibung und Doppel-Leerzeichen hebeln den Abgleich nicht aus',
  schluessel({ ...sauber, erstnachrichten: [{ name: '  steven   koller ', status: 'offen' }] })
    .includes('erstnachricht_trotz_thread'))

// Satz 2 — Netzwerk hinkt hinter dem Postfach her.
//
// Seit dem 18.08. mit Beweislast: Gemeldet wird nur, wer beim letzten
// VOLLSTÄNDIGEN Lauf nicht mehr auf der Liste stand. Wer noch draufsteht, ist
// zu Recht „offen" — genau das produziert Kevins InMail-Welle, die Leute mit
// offener Anfrage anschreibt.
check('„Einladung offen" trotz Gespräch wird gemeldet, wenn der Eintrag veraltet ist',
  schluessel({ ...sauber, netzwerk: [{ name: 'Steven Koller', status: 'offen', zuletzt_gesehen_at: vorStunden(30) }] })
    .includes('netzwerk_offen_trotz_thread'))
check('DER FALL 18.08.: wer beim letzten vollen Lauf noch draufstand, ist KEIN Befund',
  schluessel({ ...sauber, netzwerk: [{ name: 'Steven Koller', status: 'offen', zuletzt_gesehen_at: vorStunden(1) }] })
    .length === 0,
  'Sonst meldet der Wächter jede InMail an einen Pending-Kontakt als Datenfehler — acht Fehlalarme am 18.08.')
// DIE FALLE, die es im Echtbetrieb gebraucht hat (18.08.): Postgres liefert
// `+00:00`, toISOString() schreibt `Z`. Als Text sortiert `+` vor `Z` — der
// Vergleich erklärte damit jeden frisch gesehenen Eintrag für veraltet.
check('gemischte Zeitformate hebeln den Vergleich nicht aus',
  schluessel({
    ...sauber,
    netzMeta: { ...sauber.netzMeta, einladungen: { vollAt: '2026-08-17T09:48:01.281Z', gesamt: 957, geerntet: 950 } },
    netzwerk: [{ name: 'Steven Koller', status: 'offen', zuletzt_gesehen_at: '2026-08-17T09:48:01.281+00:00' }],
  }).length === 0,
  'Derselbe Moment in zwei Schreibweisen darf kein Befund sein.')

check('ohne vollständigen Einladungs-Lauf wird gar nichts behauptet',
  schluessel({
    ...sauber,
    netzMeta: { kontakte: { vollAt: vorStunden(3), gesamt: 659, geerntet: 659 } },
    netzwerk: [{ name: 'Steven Koller', status: 'offen', zuletzt_gesehen_at: vorStunden(30) }],
  }).length === 0)

// Satz 3 — ein abgebrochener Lauf muss laut sein (Umbau 18.08.).
//
// Vorher maß die Regel „geerntet vs. Kopfzahl". Die Differenz ist dauerhaft und
// harmlos (LinkedIn zählt oben Konten mit, die keine Karte haben) — und der
// echte Ausfall desselben Morgens, drei Läufe mit 10/40/50 von 957, blieb dabei
// unsichtbar, weil ein Teil-Lauf die Meta nicht anfasst.
check('ein abgebrochener Lauf wird gemeldet',
  schluessel({ ...sauber, netzMeta: { einladungen: { vollAt: vorStunden(30), letzterAbbruch: { at: vorStunden(2), gesamt: 957, geerntet: 40 } } } })
    .includes('sync_abgebrochen'))
check('DER FALL 18.08.: 40 von 957 ist dringend, nicht mittel',
  pruefeWidersprueche({ ...sauber, netzMeta: { einladungen: { vollAt: vorStunden(30), letzterAbbruch: { at: vorStunden(2), gesamt: 957, geerntet: 40 } } } }, JETZT)
    .befunde.find((b: any) => b.schluessel === 'sync_abgebrochen')?.schwere === 'hoch')
check('ein knapper Abbruch ist mittel',
  pruefeWidersprueche({ ...sauber, netzMeta: { einladungen: { vollAt: vorStunden(30), letzterAbbruch: { at: vorStunden(2), gesamt: 957, geerntet: 900 } } } }, JETZT)
    .befunde.find((b: any) => b.schluessel === 'sync_abgebrochen')?.schwere === 'mittel')
check('die Meldung nennt beide Zahlen',
  /40 von 957/.test(pruefeWidersprueche({ ...sauber, netzMeta: { einladungen: { vollAt: vorStunden(30), letzterAbbruch: { at: vorStunden(2), gesamt: 957, geerntet: 40 } } } }, JETZT)
    .befunde.find((b: any) => b.schluessel === 'sync_abgebrochen')?.text ?? ''))
check('DER FALL 18.08.: 648 von 660 nach vollständigem Lauf ist KEIN Befund mehr',
  schluessel({ ...sauber, netzMeta: { ...sauber.netzMeta, kontakte: { vollAt: vorStunden(2), gesamt: 660, geerntet: 648 } } }).length === 0,
  'Am DOM nachgezählt: 648 Karten auf der Seite, „660 Kontakte" im Kopf. Der Scraper hatte alles.')
check('ein nachgeholter Lauf räumt den Abbruch ab',
  schluessel({ ...sauber, netzMeta: { ...sauber.netzMeta, einladungen: { vollAt: vorStunden(1), gesamt: 957, geerntet: 950 } } }).length === 0)

// Satz 3b — der Spiegel darf nicht doppeln (18.08., latenter Schaden aus 0071)
check('mehr Zeilen als Leads in der Quelldatei wird gemeldet',
  schluessel({
    ...sauber,
    erstnachrichten: [{ name: 'A', status: 'offen' }, { name: 'B', status: 'offen' }, { name: 'C', status: 'offen' }],
    erstnachrichtenMeta: { versandfertig: 2 },
  }).includes('erstnachrichten_gedoppelt'))
check('gleich viele sind in Ordnung',
  schluessel({ ...sauber, erstnachrichtenMeta: { versandfertig: 1 } })
    .includes('erstnachrichten_gedoppelt') === false)
check('ohne Meta wird nichts behauptet',
  schluessel({ ...sauber, erstnachrichtenMeta: {} }).includes('erstnachrichten_gedoppelt') === false)

// Satz 4/5 — eingefrorene Quellen
check('Postfach älter als 48 h wird gemeldet',
  schluessel({ ...sauber, threads: [{ name: 'X', last_from: 'me', last_synced_at: vorStunden(72) }] })
    .includes('postfach_alt'))
check('Postfach von gestern ist in Ordnung',
  !schluessel({ ...sauber, threads: [{ name: 'X', last_from: 'me', last_synced_at: vorStunden(30) }] })
    .includes('postfach_alt'))
check('Netzwerk älter als 7 Tage wird gemeldet',
  schluessel({ ...sauber, netzwerk: [{ name: 'X', status: 'angenommen', zuletzt_gesehen_at: vorStunden(24 * 9) }] })
    .includes('netzwerk_alt'))

// Satz 6 — die drei stillen Tage vom 14.–17.08.
check('kein erfolgreicher Lauf seit 3 Tagen wird gemeldet',
  schluessel({ ...sauber, runs: [{ status: 'error', finished: vorStunden(2) }, { status: 'done', finished: vorStunden(72) }] })
    .includes('agenten_still'))
check('ein Erfolg von heute Nacht genügt',
  !schluessel({ ...sauber, runs: [{ status: 'error', finished: vorStunden(1) }, { status: 'done', finished: vorStunden(8) }] })
    .includes('agenten_still'))
check('ohne Lauf-Daten wird nichts behauptet',
  !schluessel({ ...sauber, runs: [] }).includes('agenten_still'))

// Form der Ausgabe — daran hängen Cockpit und Session-Hook
const mehrere = pruefeWidersprueche(
  { ...mitThread, threads: [{ name: 'Steven Koller', last_from: 'them', last_synced_at: vorStunden(72) }] },
  JETZT,
)
check('mehrere Befunde werden gezählt', mehrere.anzahl >= 2)
check('die dringenden werden getrennt gezählt', mehrere.hoch >= 2)
check('jeder Befund nennt einen Handgriff', mehrere.befunde.every((b: any) => typeof b.tun === 'string' && b.tun.length > 0))
check('jeder Befund trägt eine Zahl', mehrere.befunde.every((b: any) => typeof b.zahl === 'number'))

console.log(`\n${pass} ok, ${fail} fehlen`)
process.exit(fail === 0 ? 0 : 1)
