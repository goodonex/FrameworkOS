import type { Erstnachricht } from '../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../types/db'
import { namensSchluessel } from './erstnachrichtenDedup'

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
 * Tabellen aus LinkedIn selbst, nicht aus Handeingabe.
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
    const n = namensSchluessel(t.name)
    if (!n) continue
    threadNamen.add(n)
    if (t.last_from === 'them') antwortNamen.add(n)
  }

  const offen: T[] = []
  const schonRaus: T[] = []
  const hatGeantwortet: T[] = []

  for (const l of leads) {
    if (l.status !== 'offen') continue
    const n = namensSchluessel(l.name)
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
