import type { LinkedinThread } from '../../types/db'
import type { PostenEntwurf } from './prioritaet'

/**
 * Die drei festen Follow-up-Texte für Leads, die nie geantwortet haben.
 *
 * **Kevins Frage vom 25.08.2026, die das ausgelöst hat:** *„So ein kurzer
 * Follow-up muss doch nicht individuell gemacht werden. Reicht da nicht immer
 * derselbe Satz?"* — Er hat recht, und der Grund ist härter als gedacht: Bei
 * diesen Leuten gibt es **nichts zu individualisieren.** Sie haben auf die
 * Erstnachricht nie geantwortet, es existiert also kein Gesprächsverlauf, auf
 * den ein Agent eingehen könnte. Der einzige individuelle Anker wäre die
 * Headline — und die ist in der Erstnachricht bereits verbraucht. Ein Agent
 * produziert hier Pseudo-Individualität und kostet dafür Zeit und Token.
 *
 * Was das praktisch ändert: Am Morgen des 25.08. standen 177 fällige
 * Follow-ups ohne einen einzigen Entwurf. Ein Agent hätte davon zwanzig am Tag
 * bedient. Diese Datei bedient **alle**, sofort, ohne Lauf, ohne Latenz und
 * ohne Ausfallrisiko.
 *
 * **Diese Datei ist Kevins Stimme und keine Spielwiese.** Änderungen am Wortlaut
 * gehören vorher besprochen und danach in die Quelle der Wahrheit im Vault
 * (`03 Bereiche/Vertrieb & Outreach/Outbound-Skripte 1b`). Die Regeln aus dem
 * Skill `herrmann-outreach` gelten: keine Emojis, kein Weichspüler, CTA als
 * letzter Satz, und vor allem keine Rückzugsfloskeln („dann lass ich dich in
 * Ruhe", „du weißt ja, wo du mich findest") — Kevin ist der Anbieter, nicht
 * der Bittsteller.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-followup-vorlagen.ts`.
 */

/**
 * Ein Text je Follow-up-Stufe, in der Reihenfolge von
 * `FOLLOWUP_THRESHOLDS_DAYS` (3 / 7 / 14 Tage). `[Vorname]` ist der einzige
 * Platzhalter.
 *
 * Der Aufbau folgt Kevins Kaskade: erst der harmlose Anstupser, dann ein
 * echter Befund, dann eine Frage.
 */
export const FOLLOWUP_VORLAGEN: readonly string[] = [
  // Stufe 0 — drei Tage nach der Erstnachricht. Bewusst harmlos: Der
  // wahrscheinlichste Grund für das Schweigen ist nicht Ablehnung, sondern
  // dass die Nachricht untergegangen ist. Keine Entschuldigung, kein neuer
  // Pitch — nur nach oben holen und das Angebot wiederholen.
  `Moin [Vorname],

falls das untergegangen ist, hol ich es kurz hoch.

Ich nehme dir eine Analyse zu eurer Website auf, dreieinhalb Minuten, konkret auf die Eigentümer-Ansprache. Soll ich sie dir schicken?`,

  // Stufe 1 — eine Woche später. Hier steht ein Befund, der für praktisch jede
  // Maklerseite stimmt. Das ist der Trick dieser Stufe: Sie fühlt sich
  // individuell an, ohne es zu sein, weil die Beobachtung wirklich zutrifft.
  // Und sie ist eine Diagnose, kein weiterer Satz über Kevin (Experten-Frame).
  `Moin [Vorname],

eine Sache, die mir bei fast jeder Maklerseite auffällt: Sie ist für Käufer gebaut. Der Eigentümer, der überlegt zu verkaufen, findet darauf keinen einzigen Grund, genau euch anzurufen.

Darum geht es in der Analyse. Willst du sie sehen?`,

  // Stufe 2 — die letzte Nachricht auf LinkedIn, aber ausdrücklich KEIN
  // Break-up: Danach geht es auf Instagram weiter (`leadStation.lauteKette`).
  // Ein Abschiedssatz wäre schlicht gelogen. Stattdessen eine einzelne Frage
  // mit minimalem Antwortaufwand, die zugleich qualifiziert.
  `Moin [Vorname],

mal anders gefragt: Kommen eure Eigentümer-Mandate über Empfehlung und Zufall, oder steht dahinter ein System?`,
]

/** Führende Titel, die vor dem Vornamen stehen können. */
const TITEL = /^(dr|prof|dipl|ing|mag|med|rer|nat|h\.?c)\.?$/i

/**
 * Den Vornamen aus dem LinkedIn-Namen lösen.
 *
 * Gibt `null` zurück, wenn nichts Brauchbares übrig bleibt. Das ist wichtiger
 * als es klingt: Im Bestand stehen Zeilen wie `--` und `BizBuilder`. „Moin --,"
 * ist schlimmer als gar kein Entwurf, weil Kevin es womöglich abschickt, ohne
 * hinzusehen. Lieber kein Text als ein peinlicher.
 */
export function vornameAus(name: string | null | undefined): string | null {
  const roh = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!roh) return null
  for (const teil of roh.split(' ')) {
    const sauber = teil.replace(/[.,;:]+$/, '')
    if (!sauber || TITEL.test(sauber)) continue
    // Mindestens zwei Zeichen und ein Buchstabe — sonst ist es Zierrat
    // (`--`, `|`, ein Emoji im Namensfeld) und kein Vorname.
    if (sauber.length < 2) continue
    if (!/\p{L}/u.test(sauber)) continue
    return sauber
  }
  return null
}

/**
 * Der fertige Follow-up-Text für diesen Thread — oder `undefined`, wenn keiner
 * passt.
 *
 * Kein Text gibt es in drei Fällen: kein brauchbarer Vorname, eine Stufe
 * jenseits der drei Vorlagen (ab Stufe 3 übernimmt die laute Kette mit anderen
 * Kanälen), oder eine unplausible Stufe.
 */
export function followupVorlage(
  thread: Pick<LinkedinThread, 'name' | 'followup_stage'>,
): PostenEntwurf | undefined {
  const stufe = thread.followup_stage
  if (!Number.isInteger(stufe) || stufe < 0 || stufe >= FOLLOWUP_VORLAGEN.length) return undefined
  const vorname = vornameAus(thread.name)
  if (!vorname) return undefined
  return {
    text: FOLLOWUP_VORLAGEN[stufe].replaceAll('[Vorname]', vorname),
    // Eine Vorlage kann nicht veralten — sie nimmt auf nichts Bezug, was der
    // Lead gesagt hat. Genau das ist ihr Vorteil.
    veraltet: false,
    // Kein Zeitstempel: Der Text ist nicht „von gestern", er entsteht beim
    // Anzeigen. Eine Datumszeile darunter wäre eine Behauptung über nichts.
    erstelltAm: null,
  }
}
