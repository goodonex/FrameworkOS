/**
 * runner/runde.mjs — der Sync als EIN angestoßener Lauf (31.08.2026).
 *
 * **Der Anlass, wörtlich.** Kevin: *„dass jede Stunde hier mein Chrome aufgeht,
 * auch wenn ich abends im Film gucke. Geht dann der Vollbildmodus weg und dann
 * auf einmal seh ich dann wieder Chrome, LinkedIn, wie das immer wieder neu
 * lädt. […] das macht mein ganzes System langsamer. Ich muss bei jedem Klick
 * länger warten."*
 *
 * Am Log vom 31.08. nachgemessen, bevor hier etwas gebaut wurde: Der Autostart
 * war seit dem 27.08. aus, Chrome ging also nicht mehr von selbst auf. Was
 * blieb, war schlimmer zu fassen — acht Routinen mit eigenen Bremsen, alle fünf
 * Minuten geprüft, und alle zwei Stunden fasste der Postfach-Sync das offene
 * Fenster an (`Page.navigate` plus Fokus-Emulation). Vierzig Mal am Tag stand
 * dieselbe Zeile im Log, ohne dass sich etwas geändert hätte.
 *
 * **Der Tausch: Zeitplan raus, Anstoß rein.** Statt acht Uhren, die niemand
 * sieht, gibt es einen Lauf, den Kevin auslöst und dem er beim Arbeiten
 * zusehen kann. Sein Bild davon: *„dann geht halt dieser Balken los und dann
 * lädt er das einfach. Und dann weiß ich, okay, gut, der ist die nächsten
 * zwanzig Minuten dabei, Punkt."*
 *
 * Diese Datei ist reine Zustandslogik ohne Seiteneffekte — kein Chrome, kein
 * Netz, keine Uhr außer der übergebenen. Damit prüft `scripts/verify-runde.ts`
 * sie gegen Fixtures, so wie `chromeWache.mjs` es vormacht.
 */

/**
 * Die Etappen in ihrer Reihenfolge, mit dem Gewicht, das sie am Balken haben.
 *
 * **Die Gewichte sind gemessen, nicht geschätzt** (Log vom 29.–31.08.): Die
 * Einladungsliste ist mit 1.049 Einträgen die längste und braucht bei vollem
 * Durchlauf rund sieben Minuten, das Postfach knapp eine, der Wächter Sekunden.
 * Ein Balken mit gleich breiten Abschnitten stünde die halbe Zeit bei 62 % —
 * genau die Sorte Anzeige, die man nach zwei Tagen nicht mehr glaubt.
 *
 * **Reihenfolge ist keine Kosmetik.** Erst die Quellen (Postfach, Verlauf,
 * Netzwerk), dann die Verbuchung (Leads), dann die Beurteilung (Wächter), dann
 * die Agenten, die Text erzeugen. Ein Sortierer, der vor dem Postfach-Sync
 * läuft, urteilt über den Stand von gestern; die Entwürfe hingen bisher genau
 * daran fest („antwort-entwuerfe wartet — Postfach ist noch nicht frisch
 * gesynct", 40 Mal am 31.08.).
 */
export const ETAPPEN = [
  { schluessel: 'postfach', titel: 'Postfach', wieLange: 'knapp eine Minute', gewicht: 12, brauchtChrome: true },
  { schluessel: 'verlauf', titel: 'Gesprächsverläufe', wieLange: 'zwei bis drei Minuten', gewicht: 13, brauchtChrome: true },
  { schluessel: 'einladungen', titel: 'Offene Einladungen', wieLange: 'bis zu sieben Minuten', gewicht: 25, brauchtChrome: true },
  { schluessel: 'kontakte', titel: 'Angenommene Kontakte', wieLange: 'drei bis fünf Minuten', gewicht: 18, brauchtChrome: true },
  { schluessel: 'leads', titel: 'Leads verbuchen', wieLange: 'unter einer Minute', gewicht: 5, brauchtChrome: false },
  { schluessel: 'waechter', titel: 'Widersprüche prüfen', wieLange: 'Sekunden', gewicht: 2, brauchtChrome: false },
  { schluessel: 'sortierer', titel: 'Neue Kontakte vorsortieren', wieLange: 'zwei bis vier Minuten', gewicht: 11, brauchtChrome: false },
  { schluessel: 'entwuerfe', titel: 'Antwort-Entwürfe schreiben', wieLange: 'drei bis fünf Minuten', gewicht: 14, brauchtChrome: false },
]

const GEWICHT_SUMME = ETAPPEN.reduce((s, e) => s + e.gewicht, 0)

/** Kein Zustand, kein Lauf — der Ausgangspunkt und zugleich die Antwort nach einem Neustart. */
export function leereRunde() {
  return null
}

/**
 * Eine frische Runde aufsetzen.
 *
 * `nur` beschränkt den Lauf auf einzelne Etappen (der Knopf am Nachmittag
 * schickt zum Beispiel nur die Quellen los, wenn Kevin nur wissen will, ob
 * jemand geantwortet hat). Ohne Angabe laufen alle.
 */
export function neueRunde({ jetzt, ausloeser = 'kevin', nur = null } = {}) {
  const gewaehlt = nur?.length ? ETAPPEN.filter((e) => nur.includes(e.schluessel)) : ETAPPEN
  return {
    id: new Date(jetzt).toISOString(),
    gestartet: new Date(jetzt).toISOString(),
    beendet: null,
    ausloeser,
    status: 'laeuft',
    aktuell: gewaehlt[0]?.schluessel ?? null,
    etappen: gewaehlt.map((e) => ({
      schluessel: e.schluessel,
      titel: e.titel,
      wieLange: e.wieLange,
      gewicht: e.gewicht,
      status: 'wartet',
      text: '',
      /** Feinfortschritt INNERHALB der Etappe, 0–1. Bleibt null, wo es nichts zu zählen gibt. */
      anteil: null,
      /** Die beiden Zahlen für „340 von 1.049" — der Balken braucht sie nicht, Kevin schon. */
      von: null,
      bis: null,
    })),
  }
}

/**
 * Wie weit ist der Lauf insgesamt? 0–100.
 *
 * Fertige Etappen zählen voll, die laufende anteilig (soweit sie etwas zu
 * zählen hat), wartende gar nicht. Eine übersprungene Etappe zählt **voll** —
 * sie ist erledigt, nur eben ohne Arbeit. Täte sie es nicht, bliebe der Balken
 * bei einem Lauf ohne Chrome für immer unter 50 % stehen, obwohl nichts mehr
 * kommt.
 */
export function prozent(runde) {
  if (!runde) return 0
  const summe = runde.etappen.reduce((s, e) => s + e.gewicht, 0) || GEWICHT_SUMME
  let erreicht = 0
  for (const e of runde.etappen) {
    if (e.status === 'fertig' || e.status === 'uebersprungen' || e.status === 'fehler') erreicht += e.gewicht
    else if (e.status === 'laeuft') erreicht += e.gewicht * (typeof e.anteil === 'number' ? Math.min(1, Math.max(0, e.anteil)) : 0)
  }
  return Math.round((erreicht / summe) * 100)
}

/**
 * Was noch kommt, als Satz — für die Zeile unter dem Balken.
 *
 * Bewusst eine Spanne und kein Countdown: Die Dauer hängt daran, wie viel
 * LinkedIn nachlädt, und eine Sekundenzahl, die springt, ist schlechter als
 * gar keine. „Noch etwa zwölf Minuten" darf danebenliegen, ein rückwärts
 * laufender Zähler nicht.
 */
export function restText(runde) {
  if (!runde || runde.status !== 'laeuft') return ''
  const offen = runde.etappen.filter((e) => e.status === 'wartet' || e.status === 'laeuft')
  if (!offen.length) return 'gleich fertig'
  /**
   * Gegen die **volle** Gewichtssumme gerechnet, nicht gegen die dieser Runde.
   *
   * Am 31.08. beim ersten echten Lauf aufgefallen: Eine Teil-Runde mit nur dem
   * Wächter darin (Gewicht 2, Laufzeit Sekunden) meldete „noch etwa 22
   * Minuten" — relativ betrachtet waren ja 100 % der Runde offen. Die Minuten
   * hängen aber an der Arbeit, nicht am Anteil: zwei von hundert Gewichtspunkten
   * sind eine halbe Minute, egal wie klein die Runde drumherum ist.
   */
  const minuten = Math.max(1, Math.round((offen.reduce((s, e) => s + e.gewicht, 0) / GEWICHT_SUMME) * 22))
  return minuten <= 2 ? 'noch ein bis zwei Minuten' : `noch etwa ${minuten} Minuten`
}

/** Eine Etappe anfassen, ohne den Rest zu verlieren. Gibt eine NEUE Runde zurück. */
export function setzeEtappe(runde, schluessel, aenderung) {
  if (!runde) return runde
  const etappen = runde.etappen.map((e) => (e.schluessel === schluessel ? { ...e, ...aenderung } : e))
  const laufend = etappen.find((e) => e.status === 'laeuft')
  return { ...runde, etappen, aktuell: laufend?.schluessel ?? runde.aktuell }
}

/**
 * Den Lauf abschließen.
 *
 * **Ein Fehler in einer Etappe beendet die Runde nicht als „Fehler".** Bricht
 * die Einladungsliste ab, sind Postfach und Verläufe trotzdem frisch — und
 * genau das ist der Stand, mit dem Kevin arbeiten will. Rot wird der Abschluss
 * nur, wenn NICHTS durchlief; sonst steht der Fehler an seiner Etappe, wo er
 * hingehört, und die Runde heißt „fertig, mit Lücke".
 */
export function schliesseRunde(runde, { jetzt, abgebrochen = false } = {}) {
  if (!runde) return runde
  const echt = runde.etappen.filter((e) => e.status !== 'uebersprungen')
  const gelungen = echt.filter((e) => e.status === 'fertig').length
  const status = abgebrochen ? 'abgebrochen' : gelungen === 0 && echt.length > 0 ? 'fehler' : 'fertig'
  return {
    ...runde,
    status,
    beendet: new Date(jetzt).toISOString(),
    aktuell: null,
    etappen: runde.etappen.map((e) =>
      e.status === 'laeuft' || e.status === 'wartet'
        ? { ...e, status: abgebrochen ? 'uebersprungen' : e.status === 'laeuft' ? 'fehler' : 'uebersprungen' }
        : e,
    ),
  }
}

/**
 * Der Satz, der über allem steht — die eine Zeile, die Kevin im Vorbeigehen liest.
 */
export function kopfText(runde) {
  if (!runde) return 'Noch nicht geladen'
  if (runde.status === 'laeuft') {
    const e = runde.etappen.find((x) => x.status === 'laeuft')
    return e ? e.titel : 'Wird vorbereitet'
  }
  if (runde.status === 'abgebrochen') return 'Abgebrochen'
  const fehler = runde.etappen.filter((e) => e.status === 'fehler')
  if (runde.status === 'fehler') return 'Nichts geladen'
  return fehler.length ? `Fertig — ${fehler.length} Etappe${fehler.length > 1 ? 'n' : ''} mit Lücke` : 'Alles auf dem neuesten Stand'
}

/**
 * Wie alt ist der letzte Stand, in Worten?
 *
 * Für die Frage beim Öffnen („Letzter Stand von gestern 19:40. Jetzt laden?").
 * Absolute Uhrzeit statt „vor 14 Stunden": Kevin entscheidet daran, ob der
 * Stand von VOR oder NACH seinem Feierabend ist, und das steht in der Uhrzeit,
 * nicht in der Differenz.
 */
export function standText(beendetIso, jetzt) {
  if (!beendetIso) return 'noch nie geladen'
  const d = new Date(beendetIso)
  const j = new Date(jetzt)
  if (Number.isNaN(d.getTime())) return 'noch nie geladen'
  const uhr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const tage = Math.floor((new Date(j.getFullYear(), j.getMonth(), j.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000)
  if (tage === 0) return `heute ${uhr}`
  if (tage === 1) return `gestern ${uhr}`
  if (tage < 7) return `vor ${tage} Tagen, ${uhr}`
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${uhr}`
}

/**
 * Soll beim Öffnen gefragt werden?
 *
 * **Nicht bei jedem Tab-Wechsel.** Kevin öffnet das Cockpit am Tag oft; die
 * Frage gehört an den ersten Aufschlag des Tages und danach nur, wenn der Stand
 * wirklich alt ist. Vier Stunden ist die Grenze, weil sie den Vormittag vom
 * Nachmittag trennt — genau der Rhythmus, den Kevin beschrieben hat („um
 * fünfzehn, sechzehn Uhr […] dann kann ich das manuell auslösen").
 */
export const FRAGE_AB_MS = 4 * 60 * 60 * 1000

export function frageBeimOeffnen({ letzterStand, jetzt, laeuft = false }) {
  if (laeuft) return false
  if (!letzterStand) return true
  const alter = new Date(jetzt).getTime() - new Date(letzterStand).getTime()
  if (!Number.isFinite(alter)) return true
  return alter >= FRAGE_AB_MS
}
