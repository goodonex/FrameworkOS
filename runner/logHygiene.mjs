/**
 * Log-Hygiene: Zeitstempel, Wiederholungs-Dämpfung, Größendeckel (13.08.2026)
 *
 * **Der Fehler, den das behebt.** Am 13.08. stand im `cockpit-runner.err.log`
 * 50.339 Mal „Datei-Spiegel … fehlgeschlagen: Bucket not found" — 93 % der
 * Datei, jede der rund 40 gespiegelten Dateien etwa 1265 Mal, weil der
 * 60-Sekunden-Tick den fehlenden Bucket unermüdlich neu anlief. Der Bucket war
 * längst angelegt und die Meldungen Wochen alt; ohne Zeitstempel und ohne
 * Rotation sahen sie aus wie ein akuter Ausfall. Kosten: eine komplette
 * Fehlersuche an einem Problem, das es nicht mehr gab — und daneben blieb der
 * echte Ausfall (abgelaufene Anmeldung, fünf Tage lang) unsichtbar, weil er im
 * Rauschen nicht auffiel.
 *
 * Drei Maßnahmen, jede gegen einen der drei Gründe:
 * 1. **Zeitstempel** vor jeder Zeile — ohne ihn ist keine Meldung datierbar.
 * 2. **Dämpfung** gleichartiger Meldungen — die erste sagt alles, die
 *    1264. sagt nichts mehr dazu.
 * 3. **Größendeckel** beim Start — 9,8 MB Altlast machen `tail` zur Lotterie.
 *
 * Reine Funktionen, prüfbar per `npx tsx scripts/verify-log-hygiene.ts`.
 */
import { open, rename, stat, writeFile } from 'node:fs/promises'

/**
 * Der Fingerabdruck einer Meldung — gleichartig, nicht identisch.
 *
 * Die 50.339 Bucket-Zeilen unterschieden sich nur im Dateinamen. Ein Vergleich
 * auf Gleichheit hätte sie alle durchgelassen. Deshalb fallen die beiden Teile
 * weg, die zwischen zwei Meldungen desselben Defekts typischerweise variieren:
 * was in Anführungszeichen steht (Datei-/Agentennamen) und jede Zahl (IDs,
 * Größen, Zähler).
 */
export function signatur(zeile) {
  return String(zeile ?? '')
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\d+/g, 'N')
    .trim()
    .slice(0, 200)
}

/**
 * Der Dämpfer. Gibt für jede Meldung zurück, ob sie geschrieben werden soll —
 * und wie viele gleichartige seit der letzten geschriebenen unterdrückt wurden.
 *
 * Bewusst **kein** stilles Verschlucken: nach Ablauf des Fensters kommt die
 * Meldung wieder durch, dann mit der Zahl der ausgelassenen im Rücken. Ein
 * Dauerfehler bleibt also sichtbar, er schreit nur nicht mehr im Sekundentakt.
 *
 * `jetzt` ist injizierbar, damit der Test nicht warten muss.
 */
export function macheDaempfer({ fensterMs = 60_000, jetzt = () => Date.now() } = {}) {
  const gesehen = new Map() // signatur → { zuletzt: number, unterdrueckt: number }
  return function pruefe(zeile) {
    const sig = signatur(zeile)
    const t = jetzt()
    const eintrag = gesehen.get(sig)
    if (!eintrag || t - eintrag.zuletzt >= fensterMs) {
      const unterdrueckt = eintrag?.unterdrueckt ?? 0
      gesehen.set(sig, { zuletzt: t, unterdrueckt: 0 })
      return { schreiben: true, unterdrueckt }
    }
    eintrag.unterdrueckt += 1
    return { schreiben: false, unterdrueckt: eintrag.unterdrueckt }
  }
}

/** `[14:05:43]` — lokale Uhrzeit, weil Kevin das Log neben der Uhr liest. */
export function zeitstempel(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `[${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}]`
}

/**
 * Die fertige Zeile: Zeitstempel, Meldung, und — falls welche ausgelassen
 * wurden — der Hinweis darauf.
 */
export function baueZeile(text, unterdrueckt = 0, d = new Date()) {
  const schwanz = unterdrueckt > 0 ? ` (+${unterdrueckt} gleichartige unterdrückt)` : ''
  return `${zeitstempel(d)} ${text}${schwanz}`
}

/**
 * Kürzt eine Logdatei, die über den Deckel gewachsen ist: der Schwanz bleibt,
 * der Rest geht in `<name>.1`.
 *
 * Warum kopieren-und-leeren statt umbenennen: launchd hält die Datei offen und
 * schreibt mit O_APPEND weiter. Nach einem `rename` landete alles Weitere in
 * der umbenannten Datei — das Log wäre still, obwohl der Runner protokolliert.
 * Ein `truncate` auf 0 behält dagegen das Inode, und der nächste Schreibvorgang
 * setzt vorne auf.
 */
export async function kuerzeLogDatei(pfad, { maxBytes = 5_000_000, behalteBytes = 200_000 } = {}) {
  let groesse
  try {
    groesse = (await stat(pfad)).size
  } catch {
    return { gekuerzt: false, grund: 'nicht vorhanden' }
  }
  if (groesse <= maxBytes) return { gekuerzt: false, groesse }

  const fh = await open(pfad, 'r+')
  try {
    const ab = Math.max(0, groesse - behalteBytes)
    const puffer = Buffer.alloc(groesse - ab)
    await fh.read(puffer, 0, puffer.length, ab)
    // Die Altlast bleibt eine Generation lang greifbar, falls doch jemand sucht.
    await writeFile(`${pfad}.1`, puffer)
    await fh.truncate(0)
  } finally {
    await fh.close()
  }
  return { gekuerzt: true, vorher: groesse, behalten: Math.min(groesse, behalteBytes) }
}

/**
 * Hängt Zeitstempel und Dämpfer in `console.log`/`console.error` ein.
 *
 * Global gepatcht statt an rund 200 Aufrufstellen einzeln: der Runner ist ein
 * Einzweck-Daemon, dessen gesamte Ausgabe in dieselbe Logdatei läuft — eine
 * Sonderbehandlung je Aufrufstelle wäre viel Bewegung für dieselbe Wirkung und
 * würde bei der nächsten neuen Meldung wieder vergessen.
 */
export function installiereLogHygiene({ fensterMs = 60_000, konsole = console } = {}) {
  const daempfer = macheDaempfer({ fensterMs })
  const original = { log: konsole.log.bind(konsole), error: konsole.error.bind(konsole) }

  const wickle =
    (raus) =>
    (...args) => {
      const text = args
        .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : String(a)))
        .join(' ')
      const { schreiben, unterdrueckt } = daempfer(text)
      if (schreiben) raus(baueZeile(text, unterdrueckt))
    }

  konsole.log = wickle(original.log)
  konsole.error = wickle(original.error)
  return () => {
    konsole.log = original.log
    konsole.error = original.error
  }
}
