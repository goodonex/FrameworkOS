import type { Erstnachricht } from '../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../types/db'

/**
 * Was ist bei den Erstnachrichten WIRKLICH offen? (17.08.2026)
 *
 * Der Fehler, der das nötig gemacht hat: Die Kachel meldete „117 offen", obwohl
 * 78 dieser Leads längst eine Nachricht von Kevin im Postfach hatten und 15 von
 * ihnen sogar geantwortet hatten (Steven Koller: 👍 am 13.07.). Grund war eine
 * Lücke in der Verdrahtung, nicht in den Daten: `linkedin_erstnachrichten.status`
 * kannte nur den HAKEN IM COCKPIT. Wer die Nachricht vom Handy verschickt und
 * den Haken vergisst, blieb für Uriel ewig „offen" — obwohl der Beweis
 * (`linkedin_threads`) in derselben Datenbank lag.
 *
 * `funnelStufen.angenommenOhneErstnachricht` rechnet Threads seit dem 12.08.
 * gegen; die Arbeitsliste tat es nicht. Diese Datei schließt genau diese Lücke —
 * mit derselben Regel, damit keine zweite Wahrheit entsteht.
 *
 * **Reine Funktionen, keine React-Importe** — prüfbar per
 * `npx tsx scripts/verify-erstnachrichten-offen.ts`.
 */

/**
 * Der Personen-Schlüssel für den Postfach-Abgleich (18.08.2026).
 *
 * `namensSchluessel` (Kleinschreibung + Leerzeichen) war zu streng — Kevin am
 * 18.08. an drei Namen belegt, zwei davon echte Treffer im Postfach:
 *
 *   „Célie-Hélène Helinurm"        vs. Thread „Célie-Helén Helinurm"
 *   „Jonas Jacobi & Moritz Wagner" vs. Thread „Jonas Jacobi"
 *
 * LinkedIn liefert denselben Menschen je nach Quelle mit anderen Akzenten, und
 * die Lead-Liste führt Bürogemeinschaften als Doppelnamen. Ein exakter
 * Vergleich verliert beide — und der Lead steht dann als „offen" da, obwohl
 * die Nachricht längst raus ist. Genau das kostet Kevin Vertrauen in die Zahl.
 *
 * Der Schlüssel ist deshalb **Nachname + die ersten vier Zeichen des
 * Vornamens**, akzentfrei und ohne Zweitnamen. „helene"/„helen" fallen damit
 * zusammen, „Jacobi & Wagner" auf „jacobi/jona".
 *
 * **Warum vier Zeichen und nicht weniger:** Der Fehler in diese Richtung ist
 * teurer — ein zu grober Schlüssel lässt einen echten offenen Lead
 * verschwinden, ein zu feiner zeigt ihn nur einmal zu viel. An Kevins Daten
 * (198 Threads, 118 Leads) gemessen: **null Kollisionen**, zwei zusätzliche
 * Treffer. Wer das ändert, misst es neu.
 */
export function personenSchluessel(name: string | null | undefined): string {
  const roh = String(name ?? '')
    // Akzente abtrennen und wegwerfen: é → e, ü → u.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
  // Bürogemeinschaften: „Jonas Jacobi & Moritz Wagner" ist ein Lead, aber der
  // Thread läuft auf die erste Person.
  const ersterName = roh.split(/&| und |,|\//)[0]
  const worte = ersterName.replace(/[-.]/g, ' ').split(/\s+/).filter(Boolean)
  if (worte.length === 0) return ''
  if (worte.length === 1) return worte[0]
  // Letztes Wort ist der Nachname, erstes der Rufname. Zweitnamen („Bernd Benno
  // Herrfurth") fallen bewusst heraus — sie stehen selten in beiden Quellen.
  return `${worte[worte.length - 1]}/${worte[0].slice(0, 4)}`
}

/**
 * Editierabstand mit Abbruch bei > 1 (18.08.2026).
 *
 * Braucht es, weil LinkedIn denselben Menschen mit zerschossenen Umlauten
 * ausliefern kann: Kevins Lead „Maurice Jünglin" heißt im Postfach UND in der
 * Netzwerk-Liste „Maurice Jnglin" — das ü fehlt ersatzlos. Der Schlüssel wirft
 * Akzente ab (ü → u), aber gegen ein fehlendes Zeichen hilft das nicht:
 * „junglin" ≠ „jnglin". Kevins Satz dazu: „Jetzt finde ich Maurice Jüngling
 * nicht, weil er Maurice Jnglin heißt … und außerdem hat er schon eine
 * Nachricht."
 */
function editAbstand(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  const zeile = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let davor = zeile[0]
    zeile[0] = i
    for (let j = 1; j <= b.length; j++) {
      const merk = zeile[j]
      zeile[j] = Math.min(zeile[j] + 1, zeile[j - 1] + 1, davor + (a[i - 1] === b[j - 1] ? 0 : 1))
      davor = merk
    }
  }
  return zeile[b.length]
}

/**
 * Findet den Thread-Schlüssel zu einem Lead, wenn er nicht exakt gleich heißt.
 *
 * Bedingungen bewusst eng: **derselbe Vornamen-Anfang**, ein Nachname von
 * mindestens fünf Zeichen und genau ein abweichendes Zeichen. Mehrdeutige
 * Fälle (zwei passende Threads) gelten als kein Treffer — lieber einmal zu
 * viel anzeigen als den falschen Lead abhaken.
 *
 * An Kevins Bestand gemessen (118 Leads, 198 Threads): **ein** zusätzlicher
 * Treffer (Maurice), **null** Mehrdeutigkeiten. Wer die Schwellen ändert,
 * misst das neu.
 */
function fastGleich(schluessel: string, kandidaten: Iterable<string>): string | null {
  const [nach, vor] = schluessel.split('/')
  if (!nach || !vor || nach.length < 5) return null
  let treffer: string | null = null
  for (const k of kandidaten) {
    const [kn, kv] = k.split('/')
    if (kv !== vor || !kn || kn.length < 5) continue
    if (editAbstand(nach, kn) > 1) continue
    if (treffer) return null // mehrdeutig → lieber offen lassen
    treffer = k
  }
  return treffer
}

/** Das Minimum, das ein Thread zum Abgleich beitragen muss. */
export interface AbgleichThread {
  name: string
  last_from: LinkedinThread['last_from']
}

export interface Aufteilung<T> {
  /** Kein Thread im Postfach und kein Haken — hier ist wirklich noch nichts raus. */
  offen: T[]
  /** Thread vorhanden, Kevin hat zuletzt geschrieben → die Nachricht IST raus. */
  schonRaus: T[]
  /** Thread vorhanden und der Lead hat zuletzt geschrieben → gehört zu „Antworten". */
  hatGeantwortet: T[]
}

/**
 * Teilt die als `offen` verbuchten Leads anhand des Postfachs auf.
 *
 * Abgeglichen wird über den Namen: `linkedin_erstnachrichten` führt kein
 * Profil-Feld (Migration 0060), nur eine Website. Ein Namenstreffer ist damit
 * der beste verfügbare Beleg — und ein sicherer: Der Name stammt in beiden
 * Tabellen aus LinkedIn selbst, nicht aus Handeingabe. Verglichen wird über
 * {@link personenSchluessel}, weil dieselbe Person je nach Quelle anders
 * geschrieben ankommt (18.08.2026).
 *
 * **Was dieser Abgleich NICHT heilen kann:** einen Thread, der gar nicht in
 * `linkedin_threads` steht. Am 18.08. fehlten 39 Threads aus Kevins Postfach,
 * weil der Alltags-Sync nur 30 Tage zurückblättert — für die Leads dieser
 * Threads sieht jede Abgleich-Logik zwangsläufig „nichts raus". Die Abdeckung
 * ist Aufgabe des Syncs (`runner/linkedin/sync.mjs`), nicht dieser Datei.
 *
 * Die Richtung des Fehlers ist bewusst gewählt. Fehlt ein Thread (Sync hängt,
 * Postfach nicht geöffnet), bleibt der Lead `offen` — Kevin sieht ihn einmal zu
 * viel statt ihn zu verlieren. Bereits abgehakte Zeilen (`gesendet`,
 * `uebersprungen`) fasst diese Funktion nicht an.
 */
export function teileErstnachrichten<T extends Pick<Erstnachricht, 'name' | 'status'>>(
  leads: T[],
  threads: AbgleichThread[],
): Aufteilung<T> {
  const antwortNamen = new Set<string>()
  const threadNamen = new Set<string>()
  for (const t of threads) {
    const n = personenSchluessel(t.name)
    if (!n) continue
    threadNamen.add(n)
    if (t.last_from === 'them') antwortNamen.add(n)
  }

  const offen: T[] = []
  const schonRaus: T[] = []
  const hatGeantwortet: T[] = []

  for (const l of leads) {
    if (l.status !== 'offen') continue
    const roh = personenSchluessel(l.name)
    // Exakt zuerst; nur wenn nichts passt, der tolerante Zweitversuch.
    const n = threadNamen.has(roh) ? roh : (fastGleich(roh, threadNamen) ?? roh)
    if (antwortNamen.has(n)) hatGeantwortet.push(l)
    else if (threadNamen.has(n)) schonRaus.push(l)
    else offen.push(l)
  }

  return { offen, schonRaus, hatGeantwortet }
}

/** Kurzform für Aufrufer, die nur den echten Arbeitsvorrat brauchen. */
export function echtOffeneErstnachrichten<T extends Pick<Erstnachricht, 'name' | 'status'>>(
  leads: T[],
  threads: AbgleichThread[],
): T[] {
  return teileErstnachrichten(leads, threads).offen
}

/**
 * Baut eine Nachschlagefunktion Name → LinkedIn-Profil aus der Netzwerk-Liste
 * (18.08.2026).
 *
 * Der Grund steht in Kevins Satz „Jetzt finde ich Maurice Jüngling nicht, weil
 * er Maurice Jnglin heißt": Er kopiert den Namen aus der Arbeitsliste in die
 * LinkedIn-Suche — und findet niemanden, sobald die beiden Schreibweisen
 * auseinandergehen. Ein Profil-Link umgeht die Suche ganz.
 *
 * `linkedin_erstnachrichten` führt kein Profil-Feld (Migration 0060), aber
 * `linkedin_netzwerk` (0070) tut es. Verglichen wird über denselben
 * {@link personenSchluessel} inklusive des toleranten Zweitversuchs, damit
 * genau der Fall trägt, der den Anlass gab.
 */
export function profilNachName(
  netzwerk: { name: string; profile_url: string }[],
): (name: string | null | undefined) => string | undefined {
  const nachSchluessel = new Map<string, string>()
  for (const n of netzwerk) {
    const k = personenSchluessel(n.name)
    if (!k || !n.profile_url) continue
    // Erster Treffer gewinnt: Ein zweiter Eintrag mit demselben Schlüssel ist
    // fast immer dieselbe Person aus einem älteren Lauf.
    if (!nachSchluessel.has(k)) nachSchluessel.set(k, n.profile_url)
  }
  return (name) => {
    const roh = personenSchluessel(name)
    if (!roh) return undefined
    const direkt = nachSchluessel.get(roh)
    if (direkt) return direkt
    const fast = fastGleich(roh, nachSchluessel.keys())
    return fast ? nachSchluessel.get(fast) : undefined
  }
}
