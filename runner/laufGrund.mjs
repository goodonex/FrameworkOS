/**
 * Warum ist ein Lauf gescheitert? (12.08.2026)
 *
 * **Der Fehler, den das behebt.** Die Agenten-Liste zeigte bei einem
 * Fehlschlag genau ein Wort: „FEHLER". Am 11.08. lief deshalb die Anmeldung
 * der Claude-CLI ab, alle Vault-Agenten standen still — und in der Oberfläche
 * stand einen Tag lang nur dieselbe rote Zeile wie bei jedem anderen Problem.
 * Kevin hat es zufällig am Handy gesehen, nicht weil es dort stand.
 *
 * Ein Fehlschlag ist nicht gleich ein Fehlschlag: „Anmeldung abgelaufen" muss
 * Kevin von Hand beheben, „kein Netz" erledigt sich beim nächsten Versuch
 * selbst. Diese Datei trennt genau das — und sagt im ersten Fall dazu, was zu
 * tun ist.
 *
 * Reine Funktionen, prüfbar per `npx tsx scripts/verify-lauf-grund.ts`.
 */

/**
 * Die bekannten Abbruchgründe, in Prüfreihenfolge.
 *
 * Reihenfolge ist Bedeutung: „Anmeldung abgelaufen" steht vor „Zeitlimit", weil
 * ein Login-Problem den Agenten auch ins Zeitlimit laufen lassen kann — dann
 * ist die Anmeldung die Ursache und das Zeitlimit nur ihr Schatten.
 */
const MUSTER = [
  {
    schluessel: 'anmeldung',
    test: /OAuth session expired|Failed to authenticate|authentication_error|Invalid API key|Please run .?\/login|not logged in/i,
    kurz: 'Anmeldung abgelaufen',
    hinweis: 'Im Terminal `claude` neu anmelden',
    handeln: true,
  },
  {
    schluessel: 'kontingent',
    test: /rate.?limit|usage limit|quota exceeded|insufficient credit|overloaded_error/i,
    kurz: 'Kontingent erschöpft',
    hinweis: 'Der nächste Versuch läuft wieder',
    handeln: false,
  },
  {
    schluessel: 'netz',
    test: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|network error|socket hang up/i,
    kurz: 'Kein Netz',
    hinweis: 'Erledigt sich beim nächsten Lauf von selbst',
    handeln: false,
  },
  {
    schluessel: 'zeitlimit',
    // Der Runner schreibt das selbst in die Kopfzeile („Exit 143 — Zeitlimit 10 Minuten").
    test: /Zeitlimit\s+\d+\s+Minuten|Exit 143/i,
    // Getrennt vom Test: in der Kopfzeile steht „Exit 143" VOR der Dauer, und
    // eine Alternation greift die früheste Stelle — die Fanggruppe bliebe leer.
    detail: /Zeitlimit\s+(\d+)\s+Minuten/i,
    zusatz: (wert) => `${wert} Min.`,
    kurz: 'Zeitlimit erreicht',
    hinweis: 'Der Agent war zu lange unterwegs und wurde abgebrochen',
    handeln: false,
  },
]

/** Die Kopfzeile trägt den Exit-Code: „# Run fehlgeschlagen (Exit 1)". */
function exitCode(text) {
  const m = text.match(/Exit\s+(\d+)/i)
  return m ? Number(m[1]) : null
}

/**
 * Der Grund eines gescheiterten Laufs — oder `null`, wenn keiner erkennbar ist.
 *
 * Erwartet den Mitschrift-Text der Run-Datei (ohne Frontmatter). Wird bewusst
 * beim AUSLIEFERN gerufen, nicht beim Schreiben: so sprechen auch die Läufe,
 * die schon im Vault liegen, ohne dass eine Zeile Bestand umgeschrieben wird.
 */
export function laufGrund(text) {
  if (typeof text !== 'string' || text.trim() === '') return null

  for (const m of MUSTER) {
    if (!m.test.test(text)) continue
    // Steht eine Zahl im Text, die die Meldung schärft (etwa die Dauer beim
    // Zeitlimit), gehört sie hinein — sonst rät man, ob zehn Minuten oder zwei
    // gemeint sind.
    const wert = m.detail ? text.match(m.detail)?.[1] : null
    return {
      schluessel: m.schluessel,
      kurz: wert ? `${m.kurz} (${m.zusatz(wert)})` : m.kurz,
      hinweis: m.hinweis,
      handeln: m.handeln,
    }
  }

  // Nichts Bekanntes: lieber der nackte Exit-Code als eine erfundene Erklärung.
  const code = exitCode(text)
  if (code !== null && code !== 0) {
    return {
      schluessel: 'unbekannt',
      kurz: `Abbruch (Code ${code})`,
      hinweis: 'Kein bekanntes Muster — die Mitschrift öffnen',
      handeln: false,
    }
  }
  return null
}

/**
 * Kurzfassung für eine Liste: „Anmeldung abgelaufen" statt „FEHLER".
 * Ohne erkennbaren Grund bleibt es beim allgemeinen Wort.
 */
export function grundKurz(text, ersatz = 'Fehler') {
  return laufGrund(text)?.kurz ?? ersatz
}
