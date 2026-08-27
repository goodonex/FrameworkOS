/**
 * runner/chromeWache.mjs — die Umkehrung des Chrome-Autostarts (27.08.).
 *
 * Bis heute hat der Runner das Sync-Chrome selbst hochgefahren, sobald ein
 * Agent es brauchte: hoechstens einmal pro Stunde, nur tagsueber. Kevins
 * Bilanz nach einer Woche: "Wenn ich arbeite, geht jede Stunde Chrome auf mit
 * drei Fenstern, und trotzdem ist nichts sauber synchronisiert." Beide Haelften
 * stimmten — das Fenster hat gestoert UND die Laeufe brachen ab, weil der
 * Laptop dazwischen schlief.
 *
 * Der Tausch: Der Runner macht nichts mehr von selbst auf. Er wartet, meldet
 * sich einmal, und holt alles nach, sobald Chrome da ist. Kevins Ablauf
 * morgens: Laptop auf, Meldung lesen, `chrome-sync` starten, Kaffee machen.
 * Waehrend er Vertrieb macht, arbeitet der Runner die Warteschlange ab.
 *
 * Diese Datei ist reine Urteilslogik ohne Seiteneffekte, damit
 * `scripts/verify-chrome-wache.ts` sie gegen Fixtures pruefen kann. Wer sie
 * benutzt, liefert Zeit und Zustand von aussen.
 */

/** Wie lange Ruhe ist, nachdem einmal erinnert wurde. Eine Meldung pro Kaffee, nicht pro Minute. */
export const ERINNERUNG_ABSTAND_MS = 45 * 60 * 1000

/** Ausserhalb dieser Stunden wird nicht erinnert. Nachts um drei wacht der Mac kurz auf, Kevin nicht. */
export const WACHE_AB_STUNDE = 6
export const WACHE_BIS_STUNDE = 21

/**
 * Was der Runner jetzt tun soll.
 *
 * `aufholen` gilt bewusst rund um die Uhr: Wenn Chrome um 23:40 auftaucht,
 * weil Kevin abends noch arbeitet, ist das genau der Moment fuer die
 * Warteschlange. Nur die Meldung an ihn kennt Ruhezeiten.
 *
 * @param {object} lage
 * @param {boolean} lage.chromeDa        CDP auf 9222 antwortet
 * @param {boolean} lage.warVorherDa     Stand aus der vorherigen Runde (von Platte)
 * @param {number}  lage.letzteErinnerung ms-Zeitstempel der letzten Meldung, 0 wenn nie
 * @param {number}  lage.jetzt           ms
 * @param {number}  lage.stunde          Stunde 0-23 der lokalen Zeit
 * @returns {{aufholen: boolean, erinnern: boolean, grund: string}}
 */
export function beurteileWache({ chromeDa, warVorherDa, letzteErinnerung = 0, jetzt, stunde }) {
  if (chromeDa) {
    // Der eine Uebergang, auf den alles wartet: eben war nichts, jetzt ist da.
    if (!warVorherDa) return { aufholen: true, erinnern: false, grund: 'chrome-erschienen' }
    return { aufholen: false, erinnern: false, grund: 'chrome-laeuft' }
  }

  if (stunde < WACHE_AB_STUNDE || stunde >= WACHE_BIS_STUNDE) {
    return { aufholen: false, erinnern: false, grund: 'ruhezeit' }
  }

  if (jetzt - letzteErinnerung < ERINNERUNG_ABSTAND_MS) {
    return { aufholen: false, erinnern: false, grund: 'schon-erinnert' }
  }

  return { aufholen: false, erinnern: true, grund: 'chrome-fehlt' }
}

/**
 * Der Text der Meldung. Steht hier, damit der Test ihn festnageln kann:
 * Er muss den Befehl enthalten, sonst weiss Kevin am Kaffeeautomaten nicht,
 * was er tippen soll.
 */
export function meldungsText(offeneArbeit = 0) {
  const zusatz = offeneArbeit > 0 ? ` ${offeneArbeit} Vorgaenge warten.` : ''
  return `Sync steht still.${zusatz} Im Terminal "chrome-sync" starten und das Fenster offen lassen.`
}
