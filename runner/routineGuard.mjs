/**
 * Wann darf eine Tages-Routine starten? (O17 Schritt 4, 07.08.2026)
 *
 * **Der Fehler, den das behebt.** Der alte Guard prüfte nur, ob im Run-Ordner
 * eine Datei mit heutigem Datum und dem Agentennamen liegt:
 *
 *     names.some((n) => n.startsWith(heute) && n.includes('morgenbrief'))
 *
 * Ein um 7:00 gescheiterter Lauf erzeugt aber genau so eine Datei. Der
 * Fehlschlag zählte damit als „heute schon gelaufen" und deckte sich selbst zu —
 * neun Mal zwischen dem 03. und 07.08., ohne dass der Morgenbrief je entstand.
 *
 * Die Entscheidung hängt jetzt am **Status**, nicht am Dateinamen. Reine
 * Funktionen, damit sie prüfbar sind, ohne den Runner zu starten:
 * `npx tsx scripts/verify-routine-guard.ts`.
 */

/**
 * Was ein Agent heute schon getan hat.
 *
 * `metas` sind geparste Frontmatter-Köpfe (`{ agent, status }`). Der Vergleich
 * ist **exakt**: `linkedin-antwort-entwuerfe` und ein künftiges
 * `antwort-entwuerfe` dürfen sich nicht gegenseitig abschalten — der alte
 * `includes`-Test hätte genau das getan.
 */
export function bewerteTagesLaeufe(metas, agent) {
  let erfolg = false
  let fehlschlaege = 0
  let anmeldungFehler = 0
  for (const m of metas ?? []) {
    if (!m || m.agent !== agent) continue
    if (m.status === 'done') erfolg = true
    else if (m.status === 'error') {
      // 13.08.: Eine abgelaufene Anmeldung ist kein gescheiterter Agent, sondern
      // ein Lauf, der nie stattgefunden hat — die CLI bricht nach zwei Sekunden
      // ohne einen einzigen Zug ab. Zählte das aufs normale Kontingent, wäre der
      // Agent nach Kevins Neu-Anmeldung trotzdem bis Mitternacht gesperrt: genau
      // das ist am 12./13.08. passiert. Eigener Zähler, eigener Deckel.
      if (m.grund?.schluessel === 'anmeldung') anmeldungFehler += 1
      else fehlschlaege += 1
    }
    // 'running' zählt weder als Erfolg noch als Fehlschlag — der Lauf ist offen.
  }
  return { erfolg, fehlschlaege, anmeldungFehler }
}

/**
 * Startfreigabe. Vier Gründe zu schweigen, in dieser Reihenfolge:
 * 1. Der Agent läuft schon (der Tick darf keinen zweiten danebenstellen).
 * 2. Es gibt heute bereits einen erfolgreichen Lauf.
 * 3. Der Tagesdeckel an Versuchen ist erreicht — sonst startet der
 *    5-Minuten-Tick einen dauerhaft scheiternden Agenten den ganzen Tag neu.
 * 4. Auch die Anmelde-Fehlversuche haben einen Deckel, nur einen höheren
 *    (13.08.). Er ist großzügiger, weil ein Neu-Login den Lauf sofort wieder
 *    gelingen lässt — aber es MUSS einer sein: ohne ihn hämmert der Tick bei
 *    dauerhaft abgelaufener Anmeldung alle fünf Minuten los und legt dabei
 *    knapp 300 nutzlose Run-Dateien pro Tag im Vault ab.
 */
export function darfRoutineStarten({
  erfolg,
  fehlschlaege,
  anmeldungFehler = 0,
  laeuft,
  maxVersuche = 2,
  maxAnmeldung = 4,
}) {
  if (laeuft) return false
  if (erfolg) return false
  if (fehlschlaege >= maxVersuche) return false
  if (anmeldungFehler >= maxAnmeldung) return false
  return true
}
