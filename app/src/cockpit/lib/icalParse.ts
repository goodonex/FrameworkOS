/**
 * Minimaler iCal-Parser (RFC 5545, das Nötige) für die Kalender-Sync im /termine.
 * Holt der Runner als Rohtext (CORS-Proxy); hier wird geparst — pure & testbar.
 *
 * **Serientermine (D9, seit 09.08.):** `RRULE` wird expandiert, aber bewusst nur
 * so weit, wie Kevins Alltag reicht — `FREQ=DAILY|WEEKLY|MONTHLY`, `INTERVAL`,
 * `BYDAY` (reine Wochentagsliste), `COUNT`, `UNTIL`, `EXDATE`. Alles andere
 * (BYSETPOS, YEARLY, BYMONTHDAY-Listen, Zeitzonen-Spielereien) fällt heraus:
 * lieber 95 % korrekt als 100 % versucht. Was der Parser nicht versteht, bleibt
 * ein Einzeltermin — nie eine Endlosschleife, nie ein erfundenes Datum.
 *
 * Weiterhin NICHT unterstützt: echte TZID-Umrechnung (TZID-Zeiten werden als
 * Wandzeit übernommen; nur explizite UTC-„Z"-Zeiten werden lokalisiert). Die
 * Expansion rechnet deshalb in Ortszeit auf TAGESBASIS, exakt wie die
 * Einzeltermin-Logik — sonst verschöbe eine UTC-Stunde ganztägige Termine.
 */

export interface CalendarEvent {
  id: string
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM, fehlt bei Ganztags-Terminen */
  time?: string
  allDay: boolean
}

/** RFC-5545-Line-Folding auflösen: Fortsetzungszeilen beginnen mit Space/Tab. */
function unfold(text: string): string[] {
  const raw = text.split(/\r?\n/)
  const lines: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** DTSTART-Zeile (inkl. Parameter) → date/time/allDay. */
function parseDtStart(line: string): { date: string; time?: string; allDay: boolean } | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const params = line.slice(0, colon)
  const val = line.slice(colon + 1).trim()
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/)
  if (!m) return null
  const [, y, mo, d, hh, mi, , z] = m
  const isDate = /VALUE=DATE\b/i.test(params) || !hh
  if (isDate) return { date: `${y}-${mo}-${d}`, allDay: true }
  if (z) {
    // UTC → lokale Zeit
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, 0))
    const p2 = (n: number) => String(n).padStart(2, '0')
    return {
      date: `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`,
      time: `${p2(dt.getHours())}:${p2(dt.getMinutes())}`,
      allDay: false,
    }
  }
  // Floating / TZID: als Wandzeit übernehmen (keine TZ-Bibliothek in v1)
  return { date: `${y}-${mo}-${d}`, time: `${hh}:${mi}`, allDay: false }
}

// ---------- RRULE v1 (D9) ----------

/** Harte Kappe je Termin — ein „jeden Tag, für immer" darf die Liste nicht fluten. */
export const RRULE_MAX_INSTANZEN = 300

/** Notbremse gegen Endlosschleifen, unabhängig von der Instanz-Kappe. */
const RRULE_MAX_SCHRITTE = 5000

const WOCHENTAGE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

function p2(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD → lokale Mitternacht. Ortszeit, damit kein Tag verrutscht. */
function zuDatum(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return Number.isNaN(d.getTime()) ? null : d
}

function zuIso(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/** „20260815" oder „20260815T090000Z" → „2026-08-15". */
function icalDatumZuIso(v: string): string | null {
  const m = v.trim().match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** EXDATE-Zeile (auch mit Komma-Liste und Parametern) → ISO-Daten. */
export function parseExdate(line: string): string[] {
  const colon = line.indexOf(':')
  if (colon === -1) return []
  return line
    .slice(colon + 1)
    .split(',')
    .map((v) => icalDatumZuIso(v))
    .filter((v): v is string => v !== null)
}

interface RRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
  byday: number[] | null
  count: number | null
  until: string | null
}

/**
 * Was v1 versteht. Alles andere lässt die Regel durchfallen — ein unbekanntes
 * `BYSETPOS` stillschweigend zu ignorieren wäre der schlimmere Fall: die Serie
 * liefe dann mit falschem Rhythmus weiter, statt sichtbar ein Einzeltermin zu
 * bleiben.
 */
const RRULE_BEKANNTE_TEILE = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL', 'WKST'])

/** RRULE-Wert lesen. `null` = nicht unterstützt → der Termin bleibt einzeln. */
function parseRRule(wert: string): RRule | null {
  const teile = new Map<string, string>()
  for (const stueck of wert.split(';')) {
    const [k, v] = stueck.split('=')
    if (!k || !v) continue
    const schluessel = k.trim().toUpperCase()
    if (!RRULE_BEKANNTE_TEILE.has(schluessel)) return null
    teile.set(schluessel, v.trim())
  }

  // WKST≠MO würde nur INTERVAL-Wochen verschieben — ohne Test lieber ablehnen.
  const wkst = teile.get('WKST')
  if (wkst && wkst.toUpperCase() !== 'MO') return null

  const freq = teile.get('FREQ')?.toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null

  const intervalRoh = teile.get('INTERVAL')
  const interval = intervalRoh ? Number(intervalRoh) : 1
  if (!Number.isFinite(interval) || interval < 1) return null

  let byday: number[] | null = null
  const bydayRoh = teile.get('BYDAY')
  // BYDAY außerhalb von WEEKLY heißt „jeden ersten Freitag im Monat" o. ä. —
  // das rechnet v1 nicht, und falsch rechnen ist schlimmer als gar nicht.
  if (bydayRoh && freq !== 'WEEKLY') return null
  if (bydayRoh) {
    const tage: number[] = []
    for (const tag of bydayRoh.split(',')) {
      // Nur reine Wochentage. „2MO" (zweiter Montag) ist bewusst NICHT drin —
      // lieber ein Einzeltermin als ein falsch berechneter Serientermin.
      const idx = WOCHENTAGE.indexOf(tag.trim().toUpperCase() as (typeof WOCHENTAGE)[number])
      if (idx === -1) return null
      tage.push(idx)
    }
    if (tage.length === 0) return null
    byday = [...new Set(tage)].sort((a, b) => a - b)
  }

  const countRoh = teile.get('COUNT')
  const count = countRoh ? Number(countRoh) : null
  if (count != null && (!Number.isFinite(count) || count < 1)) return null

  const until = teile.get('UNTIL') ? icalDatumZuIso(teile.get('UNTIL')!) : null

  return { freq, interval, byday, count, until }
}

/**
 * Alle Termine einer Serie im Fenster (D9). Rein, ohne `Date.now()`.
 *
 * Reihenfolge nach RFC 5545: erst erzeugt die Regel die Instanzen (`COUNT`
 * zählt DIESE, inklusive der ersten), danach schneiden `UNTIL` und `EXDATE`
 * heraus. Das Fenster begrenzt nur, was zurückkommt — es verschiebt die Serie
 * nicht, sonst käme bei jedem Scrollen ein anderer Rhythmus heraus.
 *
 * Gibt bei einer Regel, die v1 nicht versteht, nur den Starttermin zurück.
 */
export function expandRRule(
  start: string,
  rruleWert: string | null,
  exdates: string[],
  fensterStart: string,
  fensterEnde: string,
): string[] {
  const startDatum = zuDatum(start)
  if (!startDatum) return []

  const imFenster = (iso: string) => iso >= fensterStart && iso <= fensterEnde
  const nurStart = () => (imFenster(start) ? [start] : [])

  if (!rruleWert) return nurStart()
  const regel = parseRRule(rruleWert)
  if (!regel) return nurStart()

  const roh: string[] = []
  let schritte = 0

  const nimm = (d: Date): boolean => {
    const iso = zuIso(d)
    if (regel.until && iso > regel.until) return false
    roh.push(iso)
    return !(regel.count != null && roh.length >= regel.count) && roh.length < RRULE_MAX_INSTANZEN
  }

  if (regel.freq === 'WEEKLY' && regel.byday) {
    // Wochenweise, damit INTERVAL sich auf die WOCHE bezieht und nicht auf den
    // einzelnen Tag. Wochenanfang ist Montag (RFC-Standard WKST=MO).
    const wochenStart = new Date(startDatum)
    wochenStart.setDate(wochenStart.getDate() - ((wochenStart.getDay() + 6) % 7))
    let weiter = true
    while (weiter && schritte++ < RRULE_MAX_SCHRITTE) {
      for (const wochentag of regel.byday) {
        const tag = new Date(wochenStart)
        tag.setDate(tag.getDate() + ((wochentag + 6) % 7))
        if (tag < startDatum) continue
        if (zuIso(tag) > fensterEnde) {
          weiter = false
          break
        }
        if (!nimm(tag)) {
          weiter = false
          break
        }
      }
      wochenStart.setDate(wochenStart.getDate() + 7 * regel.interval)
      if (zuIso(wochenStart) > fensterEnde) break
    }
  } else if (regel.freq === 'MONTHLY') {
    // Über einen Monats-INDEX statt über Datums-Arithmetik: `setMonth` schiebt
    // den 31. Januar sonst auf den 3. März. Monate, die den Tag nicht haben,
    // fallen ersatzlos aus — genau das sagt der RFC für MONTHLY ohne
    // BYMONTHDAY, und die Serie bleibt danach auf ihrem Tag.
    const tagImMonat = startDatum.getDate()
    const startMonat = startDatum.getFullYear() * 12 + startDatum.getMonth()
    for (let k = 0; schritte++ < RRULE_MAX_SCHRITTE; k++) {
      const absolut = startMonat + k * regel.interval
      const jahr = Math.floor(absolut / 12)
      const monat = absolut % 12
      const letzterTag = new Date(jahr, monat + 1, 0).getDate()
      // Grenze am Monatsersten prüfen, sonst bricht ein ausgelassener Monat
      // die Schleife nie ab.
      if (zuIso(new Date(jahr, monat, 1)) > fensterEnde) break
      if (tagImMonat > letzterTag) continue
      if (!nimm(new Date(jahr, monat, tagImMonat))) break
    }
  } else {
    const schritt = regel.freq === 'WEEKLY' ? 7 * regel.interval : regel.interval
    const cursor = new Date(startDatum)
    while (schritte++ < RRULE_MAX_SCHRITTE) {
      if (zuIso(cursor) > fensterEnde) break
      if (!nimm(cursor)) break
      cursor.setDate(cursor.getDate() + schritt)
    }
  }

  const raus = new Set(exdates)
  return roh.filter((iso) => !raus.has(iso) && imFenster(iso))
}

/**
 * Wie weit die Expansion reicht. Rückwärts eine gute Woche (die Vorwoche steht
 * in /termine noch), vorwärts ein knappes Jahr — weiter zu rechnen kostet nur
 * Speicher für Termine, die niemand ansieht.
 */
export const FENSTER_RUECKWAERTS_TAGE = 31
export const FENSTER_VORWAERTS_TAGE = 366

function fensterUm(jetzt: Date): { start: string; ende: string } {
  const start = new Date(jetzt)
  start.setDate(start.getDate() - FENSTER_RUECKWAERTS_TAGE)
  const ende = new Date(jetzt)
  ende.setDate(ende.getDate() + FENSTER_VORWAERTS_TAGE)
  return { start: zuIso(start), ende: zuIso(ende) }
}

export function parseIcal(text: string, jetzt: Date = new Date()): CalendarEvent[] {
  if (!text) return []
  const lines = unfold(text)
  const events: CalendarEvent[] = []
  const fenster = fensterUm(jetzt)
  let inEvent = false
  let summary = ''
  let uid = ''
  let dtStartLine = ''
  let rrule: string | null = null
  let exdates: string[] = []

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      summary = ''
      uid = ''
      dtStartLine = ''
      rrule = null
      exdates = []
      continue
    }
    if (line === 'END:VEVENT') {
      if (inEvent && dtStartLine) {
        const dt = parseDtStart(dtStartLine)
        if (dt) {
          const titel = unescapeText(summary) || '(ohne Titel)'
          if (!rrule) {
            // Einzeltermin: unverändert, insbesondere die ID. Kein Fenster —
            // ein einzelner Termin außerhalb war bisher sichtbar und bleibt es.
            events.push({
              id: uid || `${dt.date}-${summary}`,
              title: titel,
              date: dt.date,
              time: dt.time,
              allDay: dt.allDay,
            })
          } else {
            for (const datum of expandRRule(dt.date, rrule, exdates, fenster.start, fenster.ende)) {
              events.push({
                // Je Instanz eine eigene ID — sonst kollabieren alle Termine
                // einer Serie auf dieselbe UID (React-Key, Deduplizierung).
                id: `${uid || summary}-${datum}`,
                title: titel,
                date: datum,
                time: dt.time,
                allDay: dt.allDay,
              })
            }
          }
        }
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    const colon = line.indexOf(':')
    if (colon === -1) continue
    const name = line.slice(0, colon).split(';')[0].toUpperCase()
    if (name === 'DTSTART') dtStartLine = line
    else if (name === 'SUMMARY') summary = line.slice(colon + 1)
    else if (name === 'UID') uid = line.slice(colon + 1)
    else if (name === 'RRULE') rrule = line.slice(colon + 1).trim()
    else if (name === 'EXDATE') exdates = [...exdates, ...parseExdate(line)]
  }
  return events
}
