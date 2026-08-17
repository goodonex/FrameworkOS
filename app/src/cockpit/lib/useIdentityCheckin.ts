import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useActiveBrand } from './activeBrand'
import type { StreakTag } from './identityStreak'
import { toIsoDate } from './metricsDates'

/**
 * Der tägliche Identitäts-Check-in (Migration 0072).
 *
 * Gebaut nach demselben Muster wie `useDailyMetrics`: eine synchron gepflegte
 * Ref-Kopie als Wahrheit, optimistische Anzeige, gebündelter Upsert und
 * Retries bei transienten Fehlern. Der Grund ist derselbe — wer morgens drei
 * Haken schnell hintereinander setzt, darf keinen davon verlieren, und ein
 * abgelaufenes Token soll die Eingabe nicht verwerfen.
 *
 * **Kein zweiter Ladelauf für `daily_metrics`.** Dieser Hook liest nur seine
 * eigene Tabelle; wo beide Zahlen zusammen gebraucht werden (Vertriebsblock
 * neben Anfragen), reicht die aufrufende Seite den bereits geladenen Stand
 * durch.
 */

export interface CheckinRow {
  datum: string // YYYY-MM-DD
  vertriebsblock: boolean
  clean: boolean
  sport: boolean
  /** Morgenlese komplett gelesen (Migration 0073). */
  morgenlese: boolean
  energie: number | null
  dankbar_1: string | null
  dankbar_2: string | null
  dankbar_3: string | null
}

/**
 * Ladefenster. Deutlich größer als die 45 Tage von `daily_metrics`: dort geht
 * es um rückwirkendes Tracking, hier um Serien — eine Clean-Serie über ein
 * halbes Jahr muss auch nach einem halben Jahr noch vollständig zählbar sein.
 * Eine Zeile pro Tag, also selbst nach einem Jahr eine kleine Menge.
 */
export const CHECKIN_FENSTER_TAGE = 370

export function leererCheckin(datum: string): CheckinRow {
  return {
    datum,
    vertriebsblock: false,
    clean: false,
    sport: false,
    morgenlese: false,
    energie: null,
    dankbar_1: null,
    dankbar_2: null,
    dankbar_3: null,
  }
}

export interface UseIdentityCheckinResult {
  /** Alle geladenen Zeilen (aufsteigend nach Datum) — Quelle der Serien. */
  zeilen: CheckinRow[]
  /** Die Zeilen in der Form, die `identityStreak` erwartet. */
  streakZeilen: StreakTag[]
  /** Heutige Zeile (leer, wenn noch nichts eingetragen). */
  heute: CheckinRow
  /** Heutiges Datum als ISO-Tag — damit Seite und Serien dieselbe Uhr lesen. */
  heuteIso: string
  laedt: boolean
  /** Tabelle fehlt → Migration 0072 noch nicht gepusht. */
  tabelleFehlt: boolean
  fehler: string | null
  /** Ein oder mehrere Felder des HEUTIGEN Tages setzen. */
  setzen: (patch: Partial<Omit<CheckinRow, 'datum'>>) => void
  /** Einen Haken umlegen. */
  umschalten: (feld: 'vertriebsblock' | 'clean' | 'sport' | 'morgenlese') => void
  neuLaden: () => Promise<void>
}

export function useIdentityCheckin(): UseIdentityCheckinResult {
  const { user } = useAuth()
  const { activeBrand } = useActiveBrand()
  const [zeilen, setZeilen] = useState<CheckinRow[]>([])
  const [laedt, setLaedt] = useState(true)
  const [tabelleFehlt, setTabelleFehlt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  /**
   * „Heute" kommt aus `toIsoDate` — derselben Uhr wie `daily_metrics`, und
   * die rechnet LOKAL. `isoTag` aus identityStreak rechnet dagegen in UTC
   * (bewusst, für die DST-sichere Serien-Arithmetik): zwischen Mitternacht
   * und 2 Uhr deutscher Zeit wäre „heute" darüber noch der Vortag, und der
   * Abend-Check-in (Dankbarkeit!) wäre auf dem falschen Tag gelandet —
   * neben einer daily_metrics-Zeile, die längst auf dem neuen steht.
   */
  const heuteIso = toIsoDate(new Date())
  const fensterStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - CHECKIN_FENSTER_TAGE)
    return toIsoDate(d)
  }, [heuteIso])

  const zeilenRef = useRef<CheckinRow[]>([])
  const userRef = useRef(user)
  userRef.current = user
  const brandRef = useRef(activeBrand)
  brandRef.current = activeBrand
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uebernehmen = useCallback((rows: CheckinRow[]) => {
    zeilenRef.current = rows
    setZeilen(rows)
  }, [])

  const neuLaden = useCallback(async () => {
    const u = userRef.current
    const b = brandRef.current
    if (!supabase || !u || !b) {
      setLaedt(false)
      return
    }
    setLaedt(true)
    const { data, error } = await supabase
      .from('identity_checkins')
      .select('datum, vertriebsblock, clean, sport, morgenlese, energie, dankbar_1, dankbar_2, dankbar_3')
      .eq('user_id', u.id)
      .eq('brand_id', b.id)
      .gte('datum', fensterStart)
      .order('datum', { ascending: true })

    if (error) {
      // Dieselbe Erkennung wie in useDailyMetrics: Direkt-SQL 42P01,
      // PostgREST PGRST205.
      const fehlt =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message.includes('does not exist') ||
        error.message.includes('Could not find the table')
      if (fehlt) setTabelleFehlt(true)
      else setFehler(error.message)
      uebernehmen([])
    } else {
      setTabelleFehlt(false)
      setFehler(null)
      uebernehmen((data as CheckinRow[]) ?? [])
    }
    setLaedt(false)
  }, [fensterStart, uebernehmen])

  useEffect(() => {
    void neuLaden()
  }, [neuLaden, user?.id, activeBrand?.id])

  // Wortgleich zur Regel in useDailyMetrics: Auth-Lock, Token-Refresh und
  // Netz-Aussetzer sind retrybar und dürfen die Eingabe nicht verwerfen.
  const istTransient = (msg: string, name?: string): boolean => {
    const m = `${msg} ${name ?? ''}`.toLowerCase()
    return (
      m.includes('stole') ||
      m.includes('lock') ||
      m.includes('abort') ||
      m.includes('jwt') ||
      m.includes('token') ||
      m.includes('refresh') ||
      m.includes('fetch') ||
      m.includes('network') ||
      m.includes('timeout')
    )
  }

  const schreibenRef = useRef<(datum: string) => Promise<void>>(async () => {})
  const schreiben = useCallback(
    async (datum: string) => {
      const u = userRef.current
      const b = brandRef.current
      if (!supabase || !u || !b) return

      const pausen = [0, 350, 900, 1800]
      for (let versuch = 0; versuch < pausen.length; versuch++) {
        if (pausen[versuch] > 0) await new Promise((r) => setTimeout(r, pausen[versuch]))

        const zeile = zeilenRef.current.find((z) => z.datum === datum)
        if (!zeile) return

        const { error } = await supabase
          .from('identity_checkins')
          .upsert({ ...zeile, user_id: u.id, brand_id: b.id }, { onConflict: 'user_id,brand_id,datum' })

        if (!error) {
          setFehler(null)
          return
        }
        if (!istTransient(error.message, (error as { name?: string }).name)) {
          setFehler(error.message)
          void neuLaden()
          return
        }
        if (/jwt|token|refresh/i.test(error.message)) {
          try {
            await supabase.auth.refreshSession()
          } catch {
            /* egal — der nächste Versuch zieht die frische Session */
          }
        }
      }

      setFehler('Speichern hakt kurz (Verbindung/Session) — dein Eintrag bleibt erhalten und wird automatisch nachgezogen.')
      setTimeout(() => void schreibenRef.current(datum), 4000)
    },
    [neuLaden],
  )
  schreibenRef.current = schreiben

  /**
   * 700 ms statt der 350 ms von `useDailyMetrics`: hier wird auch getippt
   * (Dankbarkeit), und jeder Buchstabe soll keinen Upsert auslösen.
   */
  const spaeterSchreiben = useCallback(
    (datum: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void schreiben(datum)
      }, 700)
    },
    [schreiben],
  )

  const setzen = useCallback(
    (patch: Partial<Omit<CheckinRow, 'datum'>>) => {
      const b = brandRef.current
      if (b && b.id.startsWith('local-fallback-')) {
        setFehler('Marke lädt noch — bitte 1–2 Sekunden warten und erneut tippen.')
        return
      }
      const jetzt = zeilenRef.current.find((z) => z.datum === heuteIso) ?? leererCheckin(heuteIso)
      const neu = { ...jetzt, ...patch }
      const andere = zeilenRef.current.filter((z) => z.datum !== heuteIso)
      uebernehmen([...andere, neu].sort((a, c) => a.datum.localeCompare(c.datum)))
      spaeterSchreiben(heuteIso)
    },
    [heuteIso, uebernehmen, spaeterSchreiben],
  )

  const umschalten = useCallback(
    (feld: 'vertriebsblock' | 'clean' | 'sport' | 'morgenlese') => {
      const jetzt = zeilenRef.current.find((z) => z.datum === heuteIso) ?? leererCheckin(heuteIso)
      setzen({ [feld]: !jetzt[feld] } as Partial<CheckinRow>)
    },
    [heuteIso, setzen],
  )

  // Ausstehenden Schreibvorgang beim Verlassen sofort rausschicken.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        void schreiben(heuteIso)
      }
    }
  }, [schreiben, heuteIso])

  const heute = useMemo(
    () => zeilen.find((z) => z.datum === heuteIso) ?? leererCheckin(heuteIso),
    [zeilen, heuteIso],
  )

  const streakZeilen = useMemo<StreakTag[]>(
    () =>
      zeilen.map((z) => ({
        datum: z.datum,
        vertriebsblock: z.vertriebsblock,
        clean: z.clean,
        sport: z.sport,
        morgenlese: z.morgenlese,
      })),
    [zeilen],
  )

  return {
    zeilen,
    streakZeilen,
    heute,
    heuteIso,
    laedt,
    tabelleFehlt,
    fehler,
    setzen,
    umschalten,
    neuLaden,
  }
}
