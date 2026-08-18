/**
 * Der InMail-Credits-Pool — vom festgehaltenen Stand abgeleitet (18.08.2026).
 *
 * Bis heute stand auf der Kachel „150 Credits übrig", und Kevins berechtigte
 * Frage war: ist das getrackt oder einfach eine Zahl? Es war eine Zahl
 * (ui_settings, von Hand gepflegt, ohne Datum). Ab jetzt gilt: der Stand
 * bekommt beim Speichern einen Datums-Stempel, und die Anzeige zieht die
 * seither GEBUCHTEN InMails (`daily_metrics.inmails`) ab. Der Pool sinkt
 * damit von selbst mit jedem Haken im Flow.
 *
 * Bewusst eine Näherung, keine Buchhaltung: LinkedIn erstattet Credits, wenn
 * der Empfänger antwortet, und am Stand-Tag selbst gebuchte InMails stecken
 * schon im gespeicherten Wert — deshalb zählen nur Tage NACH dem Stempel.
 * Die Oberfläche sagt das dazu, statt Genauigkeit zu behaupten.
 *
 * Blatt-Modul ohne React/Supabase — prüfbar per
 * `npx tsx scripts/verify-inmail-stand.ts`.
 */

/** Wie der Stand in `ui_settings` liegt (Schlüssel `sales.inmailStand`). */
export interface InmailStand {
  wert: number
  /** Metrik-Datum (YYYY-MM-DD) des Speicherns — null bei Alt-Beständen ohne Stempel. */
  standVom: string | null
}

/** Alt-Format (Schlüssel `sales.inmailCredits`): die nackte Zahl. */
export function ausAltemWert(wert: number): InmailStand {
  return { wert, standVom: null }
}

export interface PoolAbleitung {
  /** Stand minus seither gebuchte InMails — nie unter 0. */
  pool: number
  /** Wie viele seit dem Stempel gebucht wurden (0 ohne Stempel). */
  seitherGebucht: number
  /** Wie viele Arbeitstage der Pool bei `tagesration` noch trägt — null bei Ration 0. */
  reichtTage: number | null
}

export function poolAbleitung(
  stand: InmailStand,
  zeilen: ReadonlyArray<{ datum: string; inmails?: number }>,
  tagesration: number,
): PoolAbleitung {
  const seitherGebucht = stand.standVom
    ? zeilen
        .filter((z) => stand.standVom !== null && z.datum > stand.standVom)
        .reduce((summe, z) => summe + (Number.isFinite(z.inmails) ? Math.max(0, z.inmails ?? 0) : 0), 0)
    : 0
  const pool = Math.max(0, Math.trunc(stand.wert) - seitherGebucht)
  const reichtTage = tagesration > 0 ? Math.floor(pool / tagesration) : null
  return { pool, seitherGebucht, reichtTage }
}
