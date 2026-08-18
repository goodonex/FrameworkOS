/**
 * Darf jetzt überhaupt ein Agent starten? (18.08.2026)
 *
 * **Der Fehler, den das behebt.** Am Morgen des 18.08. standen in der
 * Agenten-Liste vier rote Zeilen: Morgenbrief und Antwort-Entwürfe, je zweimal,
 * „Zeitlimit erreicht (10 Min.)". In den Run-Dateien stand jedes Mal dasselbe:
 *
 *     **Mitschrift bis zum Abbruch** — 0 Ereignisse · 0 Werkzeug-Aufrufe
 *
 * Null Ereignisse heißt: Die CLI hat nicht einen einzigen Zug gemacht. Der
 * Lauf ist nicht gescheitert, er hat nie stattgefunden. Der Mac war im
 * DarkWake — kurz wach genug, damit die Timer feuern, aber ohne Netz und
 * Sekunden später wieder im Schlaf (dasselbe Muster wie am 07.08.; `caffeinate`
 * hilft nur, wenn der Mac am Netzteil hängt, nicht im Clamshell auf Batterie).
 *
 * Teuer war nicht der Fehlversuch selbst, sondern seine Buchung: Zwei davon
 * erreichen den Tagesdeckel, und der Morgenbrief war bis Mitternacht gesperrt —
 * obwohl Kevin um 9:00 mit wachem Mac und offenem Chrome davorsaß.
 *
 * Die Antwort ist nicht „mehr Versuche", sondern **erst prüfen, dann starten**:
 * Der Runner rennt nicht mehr in einen schlafenden Mac hinein, sondern wartet
 * und probiert es bei jedem Tick neu, bis der Rechner wirklich wach ist, das
 * Netz steht und — wo nötig — der Sync-Chrome antwortet.
 *
 * Die Entscheidungslogik ist rein und ohne I/O prüfbar:
 * `npx tsx scripts/verify-start-bereit.ts`.
 */

/**
 * Wie lange der Mac am Stück wach sein muss, bevor ein Agent starten darf.
 *
 * Drei Minuten, gemessen an dem, was ausgesiebt werden soll: Ein DarkWake
 * dauert Sekunden bis gut eine Minute (am 18.08. schlief der Mac zwei Sekunden
 * nach dem Start wieder ein). Wer diese Schwelle überlebt, ist wirklich wach.
 * Nach oben kostet die Zahl direkt Wartezeit am Morgen — Kevin klappt den
 * Laptop auf und will nicht zusehen, wie nichts passiert. Überschreibbar nur,
 * damit ein Integrationstest nicht drei Minuten stillsteht.
 */
export const WACH_KARENZ_MS = Number(process.env.WACH_KARENZ_MS ?? 3 * 60 * 1000)

/**
 * Ab welchem Tick-Abstand ein Schlaf angenommen wird: das 1,6-fache des
 * erwarteten Abstands. `setInterval` steht im Schlaf still — kommt der Tick
 * nach 40 statt nach 5 Minuten, lag der Mac dazwischen. Der Puffer fängt
 * normale Verspätung (Last, iCloud, langsame Platte) ab, ohne echte
 * Schlafpausen durchzulassen.
 */
export const SCHLAF_FAKTOR = 1.6

/**
 * War der Mac durchgehend wach? — reine Funktion, damit sie prüfbar ist.
 *
 * `wachSeit` ist der Zeitpunkt, ab dem ununterbrochene Wachheit belegt ist. Er
 * wandert nach vorn, sobald zwischen zwei Ticks eine Lücke klafft, die nur
 * Schlaf erklären kann. Der erste Tick nach einem Runner-Neustart hat keinen
 * Vorgänger — dann zählt der Prozessstart, und die Karenz gilt genauso: Auch
 * ein frisch gestarteter Runner darf nicht in einen DarkWake hineinstarten.
 */
export function bewerteWachheit({ jetzt, letzterTick, wachSeit, tickAbstandMs, karenzMs = WACH_KARENZ_MS }) {
  const grenze = tickAbstandMs * SCHLAF_FAKTOR
  const luecke = letzterTick == null ? 0 : jetzt - letzterTick
  const schlafErkannt = letzterTick != null && luecke > grenze
  const neuWachSeit = schlafErkannt || wachSeit == null ? jetzt : wachSeit
  const wachSeitMs = jetzt - neuWachSeit
  return {
    wachSeit: neuWachSeit,
    schlafErkannt,
    luecke,
    wachSeitMs,
    wach: wachSeitMs >= karenzMs,
  }
}

/**
 * Fasst die Einzelbefunde zu einer Startfreigabe zusammen — rein, ohne I/O.
 *
 * **Kaskade statt Sammelliste.** Geprüft wird der Reihe nach, und was nach dem
 * ersten Nein gar nicht mehr geprüft wurde, darf auch nicht gemeldet werden.
 * Im ersten Live-Lauf am 18.08. stand sonst „Mac gerade erst aufgewacht · kein
 * Netz" im Log, während das WLAN einwandfrei lief — ein zweiter Befund, den
 * niemand erhoben hatte und der bei der nächsten Störung in die falsche
 * Richtung schickt.
 *
 * Die Reihenfolge trägt dieselbe Bedeutung: „Mac wacht auf" erklärt fehlendes
 * Netz mit, umgekehrt gilt das nicht.
 */
export function startBereitAus({ wach, netz, chrome, brauchtChrome = false }) {
  const fehlt = []
  if (!wach) fehlt.push('Mac gerade erst aufgewacht')
  else if (!netz) fehlt.push('kein Netz')
  else if (brauchtChrome && !chrome) fehlt.push('Sync-Chrome nicht erreichbar')
  return { bereit: fehlt.length === 0, fehlt, grund: fehlt.join(' · ') }
}

/**
 * Antwortet das Netz? Nicht „ist WLAN verbunden", sondern: kommt die Gegenstelle,
 * die der Agent braucht, tatsächlich ans Telefon.
 *
 * Ein Fehlschlag ist hier ein normales Ergebnis, kein Ausnahmefall — deshalb
 * schluckt die Funktion alles und antwortet mit `false`. Vier Sekunden Deckel:
 * Steht das Netz nach einem Aufwacher noch nicht, hilft längeres Warten im
 * Check nichts; der nächste Tick fragt ohnehin erneut.
 */
export async function netzErreichbar({
  url = 'https://api.anthropic.com/v1/models',
  timeoutMs = 4000,
  fetchImpl = fetch,
} = {}) {
  try {
    const ab = new AbortController()
    const t = setTimeout(() => ab.abort(), timeoutMs)
    try {
      // Jede HTTP-Antwort zählt — auch 401/404. Geprüft wird die Leitung, nicht
      // die Berechtigung: Die Anmeldung steckt in der CLI, nicht in diesem Ping.
      await fetchImpl(url, { method: 'GET', signal: ab.signal })
      return true
    } finally {
      clearTimeout(t)
    }
  } catch {
    return false
  }
}

/**
 * Läuft der Sync-Chrome (Profil `~/.uriel-chrome`, CDP auf 9222)?
 *
 * Nur eine Erreichbarkeitsfrage. Ob LinkedIn in diesem Profil noch angemeldet
 * ist, weiß erst der Lauf selbst — das bleibt bei `sync.mjs`, das dafür seine
 * eigene, klare Fehlermeldung hat.
 */
export async function chromeErreichbar({ cdpUrl = 'http://127.0.0.1:9222', timeoutMs = 2000, fetchImpl = fetch } = {}) {
  try {
    const ab = new AbortController()
    const t = setTimeout(() => ab.abort(), timeoutMs)
    try {
      const res = await fetchImpl(`${cdpUrl}/json/version`, { signal: ab.signal })
      return res.ok
    } finally {
      clearTimeout(t)
    }
  } catch {
    return false
  }
}
